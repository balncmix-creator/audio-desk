package com.balnc.audioddesk

import android.text.Html
import android.util.LruCache
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.URL
import java.util.Locale
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

/** Bounded, background-only retrieval of the image declared by a public article page. */
class ArticleImageFinder(private val userAgent: String) {
    private val cache = LruCache<String, String>(128)
    private val workers = ThreadPoolExecutor(2, 2, 20, TimeUnit.SECONDS,
        ArrayBlockingQueue<Runnable>(32), ThreadPoolExecutor.AbortPolicy())

    fun find(url: String, callback: (String?) -> Unit) {
        if (url.length > 4096 || !url.startsWith("https://", ignoreCase = true)) {
            callback(null)
            return
        }
        val cached = cache.get(url)
        if (cached != null) {
            callback(cached.takeUnless { it == NONE })
            return
        }
        try {
            workers.execute {
                val resolved = try { fetchMetadata(url) } catch (_: Exception) { null }
                cache.put(url, resolved ?: NONE)
                callback(resolved)
            }
        } catch (_: RejectedExecutionException) {
            callback(null)
        }
    }

    fun close() { workers.shutdownNow() }

    private fun fetchMetadata(source: String): String? {
        var url = URL(source)
        repeat(5) {
            if (!isPublicHttpsUrl(url)) return null
            val connection = url.openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = 3500
                connection.readTimeout = 3500
                connection.instanceFollowRedirects = false
                connection.setRequestProperty("Accept", "text/html,application/xhtml+xml")
                connection.setRequestProperty("Accept-Encoding", "identity")
                connection.setRequestProperty("User-Agent", userAgent)
                when (connection.responseCode) {
                    301, 302, 303, 307, 308 -> {
                        url = URL(url, connection.getHeaderField("Location") ?: return null)
                        return@repeat
                    }
                    200 -> {
                        val contentType = connection.contentType?.lowercase(Locale.US) ?: ""
                        if (contentType.isNotEmpty() && !contentType.contains("html")) return null
                        val bytes = ByteArrayOutputStream()
                        connection.inputStream.use { input ->
                            val chunk = ByteArray(8192)
                            while (!Thread.currentThread().isInterrupted && bytes.size() < MAX_HTML_BYTES) {
                                val count = input.read(chunk, 0, minOf(chunk.size, MAX_HTML_BYTES - bytes.size()))
                                if (count <= 0) break
                                bytes.write(chunk, 0, count)
                            }
                        }
                        return extractImageFromHtml(bytes.toString("UTF-8"), url.toString())
                    }
                    else -> return null
                }
            } finally {
                connection.disconnect()
            }
        }
        return null
    }

    companion object {
        private const val NONE = "<none>"
        private const val MAX_HTML_BYTES = 300 * 1024
        private val tags = Regex("""(?is)<(?:meta|link)\b[^>]{0,2000}>""")
        private val attributes = Regex("""([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))""", RegexOption.IGNORE_CASE)

        internal fun isPublicHttpsUrl(url: URL): Boolean {
            if (url.protocol != "https" || url.userInfo != null || (url.port != -1 && url.port != 443)) return false
            if (url.host.equals("localhost", true) || url.host.endsWith(".local", true)) return false
            val addresses = InetAddress.getAllByName(url.host)
            return addresses.isNotEmpty() && addresses.none {
                it.isAnyLocalAddress || it.isLoopbackAddress || it.isLinkLocalAddress ||
                    it.isSiteLocalAddress || it.isMulticastAddress ||
                    (it.address.size == 16 && ((it.address[0].toInt() and 255) and 254) == 252)
            }
        }

        /** No HTML parser dependency: only explicit publisher preview metadata is read. */
        internal fun extractImageFromHtml(html: String, pageUrl: String): String? {
            data class Choice(val url: String, val score: Int)
            val found = mutableListOf<Choice>()
            for (tag in tags.findAll(html)) {
                val attrs = mutableMapOf<String, String>()
                for (match in attributes.findAll(tag.value)) {
                    val value = match.groupValues.drop(2).firstOrNull { it.isNotEmpty() } ?: ""
                    attrs[match.groupValues[1].lowercase(Locale.US)] =
                        Html.fromHtml(value).toString().trim()
                }
                val key = (attrs["property"] ?: attrs["name"] ?: attrs["rel"] ?: "").lowercase(Locale.US)
                val priority = when {
                    key == "og:image:secure_url" -> 130
                    key == "og:image" || key == "og:image:url" -> 120
                    key == "twitter:image" || key == "twitter:image:src" -> 105
                    key.split(Regex("""\s+""")).contains("image_src") -> 90
                    key == "image" -> 65
                    else -> 0
                }
                if (priority == 0) continue
                val raw = attrs["content"] ?: attrs["href"] ?: continue
                val candidate = try { URL(URL(pageUrl), raw) } catch (_: Exception) { continue }
                if (candidate.protocol != "https" || candidate.userInfo != null || candidate.port !in listOf(-1, 443)) continue
                val address = candidate.toString()
                val lowQuality = Regex("""(?i)(?:thumb(?:nail)?|avatar|favicon|logo|(?:^|[-_/])\d{2,3}x\d{2,3}(?:[._/-]|$))""").containsMatchIn(candidate.path)
                found.add(Choice(address, priority - if (lowQuality) 100 else 0))
            }
            return found.maxByOrNull { it.score }?.takeIf { it.score >= 50 }?.url
        }
    }
}
