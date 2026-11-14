package com.balnc.audioddesk

import android.text.Html
import android.util.LruCache
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLDecoder
import java.util.Locale
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

/**
 * Finds publisher-provided audio demos; does not download, synthesize or redistribute audio.
 * Runs off the UI thread and limits untrusted article pages and redirects.
 */
class SampleDemoFinder(private val userAgent: String) {
    data class Demo(val kind: String, val url: String) // audio or external
    private val cache = LruCache<String, Demo>(64)
    private val unavailable = Demo("none", "")
    private val workers = ThreadPoolExecutor(2, 2, 20, TimeUnit.SECONDS,
        ArrayBlockingQueue<Runnable>(24), ThreadPoolExecutor.AbortPolicy())

    fun find(pageUrl: String, callback: (Demo?) -> Unit) {
        if (pageUrl.length > 4096 || !pageUrl.startsWith("https://", ignoreCase = true)) {
            callback(null); return
        }
        val cached = cache.get(pageUrl)
        if (cached != null) {
            callback(cached.takeUnless { it.kind == "none" }); return
        }
        try {
            workers.execute {
                val demo = try { lookup(pageUrl) } catch (_: Exception) { null }
                cache.put(pageUrl, demo ?: unavailable)
                callback(demo)
            }
        } catch (_: RejectedExecutionException) { callback(null) }
    }

    fun close() { workers.shutdownNow() }

    private fun lookup(pageUrl: String): Demo? {
        var url = URL(pageUrl)
        repeat(5) {
            if (!ArticleImageFinder.isPublicHttpsUrl(url)) return null
            val c = url.openConnection() as HttpURLConnection
            try {
                c.connectTimeout = 3500
                c.readTimeout = 3500
                c.instanceFollowRedirects = false
                c.setRequestProperty("User-Agent", userAgent)
                c.setRequestProperty("Accept", "text/html,application/xhtml+xml")
                c.setRequestProperty("Accept-Encoding", "identity")
                when (c.responseCode) {
                    301, 302, 303, 307, 308 -> {
                        url = URL(url, c.getHeaderField("Location") ?: return null)
                        return@repeat
                    }
                    200 -> {
                        val contentType = c.contentType.orEmpty().lowercase(Locale.US)
                        if (contentType.isNotBlank() && !contentType.contains("html")) return null
                        val output = ByteArrayOutputStream()
                        c.inputStream.use { stream ->
                            val buffer = ByteArray(8192)
                            while (output.size() < 300_000 && !Thread.currentThread().isInterrupted) {
                                val n = stream.read(buffer, 0, minOf(buffer.size, 300_000 - output.size()))
                                if (n <= 0) break
                                output.write(buffer, 0, n)
                            }
                        }
                        return extractDemoFromHtml(output.toString("UTF-8"), url.toString())
                    }
                    else -> return null
                }
            } finally { c.disconnect() }
        }
        return null
    }

    companion object {
        private val tags = Regex("""(?is)<(meta|audio|source|a|iframe)\b[^>]{0,2200}>""")
        private val attrs = Regex("""([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))""", RegexOption.IGNORE_CASE)
        private val audioFile = Regex("""(?i)\.(?:mp3|m4a|aac|ogg|oga|wav|opus)(?:$|[?#])""")
        private val demoWords = Regex("""(?i)\b(?:preview|demo|listen|play|audition|audio|sample|stream)\b""")

        private fun urlFor(raw: String, base: String): URL? = try {
            URL(URL(base), raw.trim()).takeIf {
                it.protocol == "https" && it.userInfo == null && (it.port == -1 || it.port == 443)
                    && it.host.isNotBlank()
            }
        } catch (_: Exception) { null }

        /** Parses only links supplied by the publisher. It never invents a demo. */
        internal fun extractDemoFromHtml(html: String, articleUrl: String): Demo? {
            data class Candidate(val demo: Demo, val priority: Int)
            val found = mutableListOf<Candidate>()
            for (tag in tags.findAll(html.take(300_000))) {
                val tagName = tag.groupValues[1].lowercase(Locale.US)
                val properties = mutableMapOf<String, String>()
                for (match in attrs.findAll(tag.value)) {
                    val value = match.groupValues.drop(2).firstOrNull { it.isNotEmpty() } ?: ""
                    properties[match.groupValues[1].lowercase(Locale.US)] =
                        Html.fromHtml(value).toString().trim()
                }
                val name = (properties["property"] ?: properties["name"] ?: "").lowercase(Locale.US)
                val type = properties["type"].orEmpty().lowercase(Locale.US)
                val candidate = when {
                    tagName == "meta" && name in setOf("og:audio:secure_url", "og:audio", "og:audio:url") ->
                        Triple(properties["content"], "audio", 140)
                    tagName == "meta" && name == "twitter:player:stream" ->
                        Triple(properties["content"], "audio", 125)
                    tagName == "audio" ->
                        Triple(properties["src"], "audio", 135)
                    tagName == "source" && type.startsWith("audio/") ->
                        Triple(properties["src"], "audio", 130)
                    tagName == "source" ->
                        Triple(properties["src"], "audio", 100)
                    tagName == "a" && (demoWords.containsMatchIn(tag.value) ||
                        demoWords.containsMatchIn(html.substring(tag.range.last + 1, minOf(html.length, tag.range.last + 90)))) ->
                        Triple(properties["href"], "audio", 80)
                    tagName == "iframe" -> Triple(properties["src"], "external", 55)
                    else -> null
                } ?: continue
                val target = urlFor(candidate.first ?: continue, articleUrl) ?: continue
                if (candidate.second == "audio") {
                    if (!audioFile.containsMatchIn(target.toString()) && !type.startsWith("audio/")) continue
                    found.add(Candidate(Demo("audio", target.toString()), candidate.third))
                } else {
                    val host = target.host.lowercase(Locale.US).removePrefix("www.")
                    val external = when {
                        host == "w.soundcloud.com" && target.path.startsWith("/player") -> {
                            val query = target.query.orEmpty()
                            val encoded = Regex("""(?:^|&)url=([^&]+)""").find(query)?.groupValues?.get(1)
                            val decoded = encoded?.let { URLDecoder.decode(it, "UTF-8") }
                            val track = decoded?.let { urlFor(it, articleUrl) }
                            if (track?.host?.lowercase(Locale.US)?.removePrefix("www.") == "soundcloud.com")
                                track.toString() else target.toString()
                        }
                        host == "youtube.com" && target.path.startsWith("/embed/") -> {
                            val id = target.path.removePrefix("/embed/").substringBefore('/')
                            if (!id.matches(Regex("""[a-zA-Z0-9_-]{6,20}"""))) null
                            else "https://www.youtube.com/watch?v=$id"
                        }
                        else -> null
                    }
                    if (external != null) found.add(Candidate(Demo("external", external), candidate.third))
                }
            }
            return found.maxByOrNull { it.priority }?.demo
        }
    }
}
