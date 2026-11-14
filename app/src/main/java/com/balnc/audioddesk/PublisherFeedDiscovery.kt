package com.balnc.audioddesk

import android.text.Html
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Discover RSS/Atom feeds on a small curated list of publisher homepages.
 * Every URL is HTTPS, public-address checked, same-publisher, bounded and verified.
 * Network work happens off the WebView thread.
 */
class PublisherFeedDiscovery(private val userAgent: String) {
    private val executor = Executors.newSingleThreadExecutor()
    private data class Site(val name: String, val url: URL, val category: String)
    private data class Document(val url: URL, val text: String)
    private val tagPattern = Regex("""(?is)<link\b[^>]{0,1800}>""")
    private val attributes = Regex("""([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))""", RegexOption.IGNORE_CASE)

    fun discover(raw: String, callback: (JSONArray) -> Unit) {
        val sites = mutableListOf<Site>()
        try {
            val seeds = JSONArray(raw)
            for (i in 0 until minOf(seeds.length(), 12)) {
                val obj = seeds.optJSONObject(i) ?: continue
                val url = URL(obj.optString("site"))
                val name = obj.optString("name").take(90)
                val category = obj.optString("cat").take(50)
                if (name.isBlank() || category.isBlank() || !isSafeUrl(url)) continue
                sites.add(Site(name, url, category))
            }
        } catch (_: Exception) { callback(JSONArray()); return }
        executor.execute {
            val results = JSONArray()
            for (site in sites) {
                try {
                    for (candidate in findFeeds(site).take(2)) {
                        results.put(JSONObject()
                            .put("name", site.name + " — RSS")
                            .put("url", candidate)
                            .put("cat", site.category))
                    }
                } catch (_: Exception) { /* Publisher offline or blocking robots */ }
            }
            callback(results)
        }
    }

    fun close() = executor.shutdownNow()

    private fun findFeeds(site: Site): List<String> {
        val page = fetch(site.url, false) ?: return emptyList()
        val options = LinkedHashSet<URL>()
        for (tag in tagPattern.findAll(page.text.take(160_000))) {
            val attrs = mutableMapOf<String, String>()
            for (match in attributes.findAll(tag.value)) {
                val value = match.groupValues.drop(2).firstOrNull { it.isNotEmpty() } ?: ""
                attrs[match.groupValues[1].lowercase(Locale.US)] = Html.fromHtml(value).toString().trim()
            }
            val rel = attrs["rel"].orEmpty().lowercase(Locale.US)
            val type = attrs["type"].orEmpty().lowercase(Locale.US)
            if (!rel.split(Regex("""\s+""")).contains("alternate")) continue
            if (!type.contains("rss+xml") && !type.contains("atom+xml")) continue
            val href = attrs["href"] ?: continue
            try { options.add(URL(page.url, href)) } catch (_: Exception) {}
        }
        for (suffix in listOf("/feed/", "/rss.xml", "/feed.xml")) {
            options.add(URL(site.url, suffix))
        }
        val verified = LinkedHashSet<String>()
        var checked = 0
        for (candidate in options) {
            if (checked >= 5) break
            if (!samePublisher(site.url, candidate) || !isSafeUrl(candidate)) continue
            checked++
            val doc = fetch(candidate, true) ?: continue
            if (!samePublisher(site.url, doc.url)) continue
            val text = doc.text.trimStart('\uFEFF', ' ', '\n', '\r', '\t')
            val isRss = Regex("""(?is)^<\?xml[^>]*>\s*<rss\b|^<rss\b|<rdf:RDF\b""").containsMatchIn(text)
            val isAtom = Regex("""(?is)^<\?xml[^>]*>\s*<feed\b|^<feed\b""").containsMatchIn(text)
            if ((isRss || isAtom) &&
                (text.contains("<item", true) || text.contains("<entry", true))) {
                verified.add(doc.url.toString())
            }
        }
        return verified.toList()
    }

    private fun fetch(source: URL, feed: Boolean): Document? {
        var url = source
        repeat(4) {
            if (!isSafeUrl(url)) return null
            val connection = url.openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = 2500
                connection.readTimeout = 2500
                connection.instanceFollowRedirects = false
                connection.setRequestProperty("User-Agent", userAgent)
                connection.setRequestProperty("Accept", if (feed) "application/rss+xml,application/atom+xml,text/xml,application/xml" else "text/html")
                connection.setRequestProperty("Accept-Encoding", "identity")
                when (connection.responseCode) {
                    301, 302, 303, 307, 308 -> {
                        url = URL(url, connection.getHeaderField("Location") ?: return null)
                        if (!samePublisher(source, url)) return null
                        return@repeat
                    }
                    200 -> {
                        val type = connection.contentType.orEmpty().lowercase(Locale.US)
                        if (feed && !type.contains("xml") && !type.contains("rss") && !type.contains("atom")) return null
                        if (!feed && type.isNotBlank() && !type.contains("html")) return null
                        val limit = if (feed) 96_000 else 160_000
                        if (connection.contentLength > limit) return null
                        val text = connection.inputStream.use { input ->
                            val buffer = ByteArray(4096)
                            val output = java.io.ByteArrayOutputStream()
                            while (output.size() < limit && !Thread.currentThread().isInterrupted) {
                                val n = input.read(buffer, 0, minOf(buffer.size, limit - output.size()))
                                if (n <= 0) break
                                output.write(buffer, 0, n)
                            }
                            output.toString("UTF-8")
                        }
                        return Document(url, text)
                    }
                    else -> return null
                }
            } finally { connection.disconnect() }
        }
        return null
    }

    companion object {
        private fun normalizedHost(url: URL) = url.host.lowercase(Locale.US).removePrefix("www.")
        internal fun samePublisher(first: URL, second: URL): Boolean {
            val domain = normalizedHost(first)
            val other = normalizedHost(second)
            return other == domain || other.endsWith(".$domain")
        }
        internal fun isSafeUrl(url: URL): Boolean =
            url.protocol == "https" && url.userInfo == null && (url.port == -1 || url.port == 443) &&
                try { ArticleImageFinder.isPublicHttpsUrl(url) } catch (_: Exception) { false }
    }
}
