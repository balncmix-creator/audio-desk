package com.balnc.audioddesk

import android.text.Html
import android.util.LruCache
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLDecoder
import java.net.URLEncoder
import java.util.Locale
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

/** Publisher previews only. Search results are checked against the pack title before use. */
class SampleDemoFinder(private val userAgent: String) {
    data class Demo(val kind: String, val url: String) // audio, external, or page
    internal data class Hit(val url: URL, val title: String, val score: Int)
    private data class Page(val url: URL, val html: String)
    private data class CacheEntry(val value: Demo?, val time: Long)

    private val cache = LruCache<String, CacheEntry>(96)
    private val workers = ThreadPoolExecutor(2, 2, 20, TimeUnit.SECONDS,
        ArrayBlockingQueue<Runnable>(24), ThreadPoolExecutor.AbortPolicy())

    fun find(articleUrl: String, packTitle: String, callback: (Demo?) -> Unit) {
        if (articleUrl.length !in 9..4096 || !articleUrl.startsWith("https://", true)
            || packTitle.length !in 3..240) { callback(null); return }
        val key = articleUrl + "\n" + packTitle
        val old = cache.get(key)
        // Failed lookups can recover when a publisher adds the demo later.
        if (old != null && System.currentTimeMillis() - old.time <
            (if (old.value == null) 10 * 60_000L else 24 * 60 * 60_000L)) {
            callback(old.value); return
        }
        try {
            workers.execute {
                val result = try { findInternal(articleUrl, packTitle) } catch (_: Exception) { null }
                cache.put(key, CacheEntry(result, System.currentTimeMillis()))
                callback(result)
            }
        } catch (_: RejectedExecutionException) { callback(null) }
    }

    fun close() = workers.shutdownNow()

    private fun findInternal(articleUrl: String, title: String): Demo? {
        val original = try { readPage(URL(articleUrl)) } catch (_: Exception) { null }
        if (original != null) {
            extractDemoFromHtml(original.html, original.url.toString())?.let { return it }
            for (hit in linkedProductPages(original, title).take(2)) {
                val page = try { readPage(hit.url) } catch (_: Exception) { null } ?: continue
                if (!pageMatches(title, page.html, hit.title, page.url.toString())) continue
                extractDemoFromHtml(page.html, page.url.toString())?.let { return it }
            }
        }
        // The article may be an announcement with no audio. Search the product by name.
        val hits = searchPages(title).filter { it.url.toString() != articleUrl }
        var matchingProduct: String? = null
        var visited = 0
        for (hit in hits) {
            if (hit.score < 58 || visited++ >= 4) break
            if (isTrustedPlayer(hit.url)) return Demo("external", hit.url.toString())
            if (audioFile.containsMatchIn(hit.url.toString())) return Demo("audio", hit.url.toString())
            val page = try { readPage(hit.url) } catch (_: Exception) { null } ?: continue
            if (!pageMatches(title, page.html, hit.title, page.url.toString())) continue
            extractDemoFromHtml(page.html, page.url.toString())?.let { return it }
            if (matchingProduct == null && hit.score >= 70) matchingProduct = page.url.toString()
        }
        // Never claim the page contains a demo, but offer the best verified product page.
        return matchingProduct?.let { Demo("page", it) }
    }

    private fun linkedProductPages(page: Page, title: String): List<Hit> {
        val matches = mutableListOf<Hit>()
        for (tag in anchorTags.findAll(page.html.take(280_000))) {
            val raw = attribute(tag.groupValues[1], "href") ?: continue
            val url = resolveUrl(raw, page.url.toString()) ?: continue
            val label = plain(tag.groupValues[2])
            val score = matchScore(title, label)
            if (score >= 60 && url.toString() != page.url.toString() &&
                !isSearchHost(url.host)) matches.add(Hit(url, label, score))
        }
        return matches.distinctBy { it.url.toString() }.sortedByDescending { it.score }
    }

    private fun searchPages(title: String): List<Hit> {
        val q = URLEncoder.encode(title.replace('"', ' ').take(140) + " sample pack demo listen preview", "UTF-8")
        val sources = listOf(
            "https://html.duckduckgo.com/html/?q=$q",
            "https://www.bing.com/search?q=$q&count=10",
            "https://www.bing.com/search?q=$q&format=rss"
        )
        val matches = mutableListOf<Hit>()
        for (source in sources) {
            val html = try { readPage(URL(source), isSearch = true)?.html } catch (_: Exception) { null } ?: continue
            matches += parseSearchResults(html, title)
            if (matches.count { it.score >= 65 } >= 4) break
        }
        return matches.distinctBy { it.url.toString() }.sortedByDescending { it.score }.take(8)
    }

    private fun readPage(start: URL, isSearch: Boolean = false): Page? {
        var url = start
        repeat(4) {
            if (!ArticleImageFinder.isPublicHttpsUrl(url)) return null
            val connection = url.openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = 2800
                connection.readTimeout = 2800
                connection.instanceFollowRedirects = false
                connection.setRequestProperty("User-Agent", userAgent)
                connection.setRequestProperty("Accept", "text/html,application/xhtml+xml")
                connection.setRequestProperty("Accept-Encoding", "identity")
                when (connection.responseCode) {
                    301, 302, 303, 307, 308 -> {
                        url = URL(url, connection.getHeaderField("Location") ?: return null)
                        if (isSearch && !isSearchHost(url.host)) return null
                        return@repeat
                    }
                    200 -> {
                        val type = connection.contentType.orEmpty().lowercase(Locale.US)
                        if (type.isNotBlank() && !type.contains("html") && !(isSearch && (type.contains("xml") || type.contains("rss")))) return null
                        if (connection.contentLength > MAX_BYTES) return null
                        val output = ByteArrayOutputStream()
                        connection.inputStream.use { input ->
                            val buffer = ByteArray(8192)
                            while (output.size() < MAX_BYTES && !Thread.currentThread().isInterrupted) {
                                val n = input.read(buffer, 0, minOf(buffer.size, MAX_BYTES - output.size()))
                                if (n <= 0) break
                                output.write(buffer, 0, n)
                            }
                        }
                        return Page(url, output.toString("UTF-8"))
                    }
                    else -> return null
                }
            } finally { connection.disconnect() }
        }
        return null
    }

    companion object {
        private const val MAX_BYTES = 320_000
        private val tags = Regex("""(?is)<(meta|audio|source|a|iframe)\b[^>]{0,2200}>""")
        private val anchorTags = Regex("""(?is)<a\b([^>]{0,2000})>(.{0,550}?)</a>""")
        private val attributes = Regex("""([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))""", RegexOption.IGNORE_CASE)
        private val titleTag = Regex("""(?is)<title[^>]*>(.{1,300}?)</title>""")
        private val audioFile = Regex("""(?i)\.(?:mp3|m4a|aac|ogg|oga|wav|opus)(?:$|[?#])""")
        private val demoWords = Regex("""(?i)(?:preview|demo|listen|play|audition|audio|stream)""")
        private val stop = setOf("new","sample","samples","pack","packs","library","libraries",
            "sound","sounds","audio","release","released","available","now","the","and",
            "with","for","from","free","latest","official","demo","listen","preview","music",
            "instrument","instruments","announces","launches","download","this","of","is",
            "review","first","look","sounds","out","producer","software")
        private val trusted = listOf("loopmasters.com","producerloops.com","splice.com","loopcloud.com",
            "samplephonics.com","boomlibrary.com","soundcloud.com","youtube.com",
            "bandcamp.com","pianobook.co.uk","sonniss.com","kvraudio.com",
            "samplelibraryreview.com","asoundeffect.com","rekkerd.org")

        private fun attribute(tag: String, name: String): String? {
            val attrs = mutableMapOf<String, String>()
            for (m in attributes.findAll(tag)) {
                val value = m.groupValues.drop(2).firstOrNull { it.isNotEmpty() } ?: ""
                attrs[m.groupValues[1].lowercase(Locale.US)] = Html.fromHtml(value).toString().trim()
            }
            return attrs[name]
        }
        private fun plain(s: String): String =
            Html.fromHtml(s.replace(Regex("""(?s)<[^>]*>"""), " ")).toString().replace(Regex("""\s+""")," ").trim()
        private fun resolveUrl(raw: String, base: String): URL? = try {
            URL(URL(base), raw.trim()).takeIf {
                it.protocol == "https" && it.userInfo == null &&
                    (it.port == -1 || it.port == 443) && it.host.isNotBlank()
            }
        } catch (_: Exception) { null }
        private fun isSearchHost(host: String) =
            host == "www.bing.com" || host == "bing.com" ||
                host == "html.duckduckgo.com" || host == "duckduckgo.com"
        private fun isTrustedPlayer(url: URL): Boolean {
            val host = url.host.lowercase(Locale.US).removePrefix("www.")
            return host == "soundcloud.com" || host == "youtube.com" && (
                url.path == "/watch" || url.path.startsWith("/shorts/"))
        }
        private fun scoreTokens(raw: String): Set<String> =
            Regex("""[a-z0-9]+""").findAll(raw.lowercase(Locale.US))
                .map { it.value }.filter { it.length >= 3 && it !in stop }.toSet()

        /** Reject unrelated similarly themed packs. Preserve distinguishing title words. */
        internal fun matchScore(articleTitle: String, candidateTitle: String): Int {
            val tokens = scoreTokens(articleTitle)
            val words = scoreTokens(candidateTitle)
            if (tokens.size < 2 || words.isEmpty()) return 0
            val hits = tokens.intersect(words).size
            if (hits < 2) return 0
            return (100.0 * hits / tokens.size).toInt()
        }

        internal fun parseSearchResults(html: String, articleTitle: String): List<Hit> {
            val hits = mutableListOf<Hit>()
            // Bing web search can return RSS XML. These are search result links,
            // not newly published audio samples.
            val entries = Regex("""(?is)<item>(.{1,16000}?)</item>""")
            for (entry in entries.findAll(html.take(MAX_BYTES))) {
                val title = Regex("""(?is)<title>(.*?)</title>""").find(entry.groupValues[1])?.groupValues?.get(1)?.let(::plain) ?: continue
                val link = Regex("""(?is)<link>(.*?)</link>""").find(entry.groupValues[1])?.groupValues?.get(1)?.trim() ?: continue
                val url = resolveUrl(link, "https://www.bing.com/") ?: continue
                if (isSearchHost(url.host)) continue
                val score = matchScore(articleTitle, title)
                if (score >= 50) hits.add(Hit(url, title, score))
            }
            for (tag in anchorTags.findAll(html.take(MAX_BYTES))) {
                val attributes = tag.groupValues[1]
                val link = attribute(attributes,"href") ?: continue
                val label = plain(tag.groupValues[2])
                if (label.length < 6) continue
                // DuckDuckGo HTML and Bing regular search result anchors.
                // Restrict to search-result headlines where possible, but also
                // accept Bing's plain result anchors after exact title scoring.
                if (!attributes.contains("href")) continue
                val url = if (link.contains("uddg=")) {
                    val encoded = Regex("""[?&]uddg=([^&]+)""").find(link)?.groupValues?.get(1)
                    encoded?.let { try { URLDecoder.decode(it, "UTF-8") } catch (_: Exception) { null } }
                } else link
                val resolved = url?.let { resolveUrl(it, "https://html.duckduckgo.com/html/") } ?: continue
                if (isSearchHost(resolved.host)) continue
                val score = matchScore(articleTitle,label)
                if (score < 50) continue
                val host = resolved.host.lowercase(Locale.US).removePrefix("www.")
                val publisher = trusted.any { host == it || host.endsWith(".$it") }
                hits.add(Hit(resolved,label,score+if(publisher) 10 else 0))
            }
            return hits.distinctBy { it.url.toString() }.sortedByDescending { it.score }
        }

        private fun pageMatches(articleTitle: String, html: String, resultTitle: String, url: String): Boolean {
            val title = titleTag.find(html.take(70_000))?.groupValues?.get(1)?.let(::plain).orEmpty()
            return matchScore(articleTitle,title) >= 50 ||
                matchScore(articleTitle,resultTitle) >= 80 && matchScore(articleTitle,plain(html.take(5000))) >= 50
        }

        /** Accept only player or audio links actually declared on the publisher page. */
        internal fun extractDemoFromHtml(html: String, articleUrl: String): Demo? {
            data class Candidate(val demo: Demo, val priority: Int)
            val results = mutableListOf<Candidate>()
            for (tag in tags.findAll(html.take(MAX_BYTES))) {
                val attrs = mutableMapOf<String, String>()
                for (m in attributes.findAll(tag.value)) {
                    val value = m.groupValues.drop(2).firstOrNull { it.isNotEmpty() } ?: ""
                    attrs[m.groupValues[1].lowercase(Locale.US)] = Html.fromHtml(value).toString().trim()
                }
                val tagName = tag.groupValues[1].lowercase(Locale.US)
                val key = (attrs["property"] ?: attrs["name"] ?: "").lowercase(Locale.US)
                val type = attrs["type"].orEmpty().lowercase(Locale.US)
                val raw: String?
                val priority: Int
                val external: Boolean
                when {
                    tagName == "meta" && key in setOf("og:audio","og:audio:secure_url","og:audio:url") ->
                        { raw=attrs["content"]; priority=145;external=false }
                    tagName == "meta" && key=="twitter:player:stream" ->
                        { raw=attrs["content"];priority=130;external=false }
                    tagName == "audio" -> {raw=attrs["src"];priority=140;external=false}
                    tagName == "source" -> {raw=attrs["src"];priority=130;external=false}
                    tagName == "a" && (demoWords.containsMatchIn(tag.value) ||
                        demoWords.containsMatchIn(html.substring(tag.range.last+1,minOf(html.length,tag.range.last+90)))) ->
                        {raw=attrs["href"];priority=85;external=false}
                    tagName == "iframe" -> {raw=attrs["src"];priority=75;external=true}
                    else -> continue
                }
                val target=resolveUrl(raw ?: continue,articleUrl) ?: continue
                if (!external && (audioFile.containsMatchIn(target.toString()) || type.startsWith("audio/"))) {
                    results.add(Candidate(Demo("audio",target.toString()),priority))
                } else if (external) {
                    val host=target.host.lowercase(Locale.US).removePrefix("www.")
                    val link=when {
                        host=="w.soundcloud.com" && target.path.startsWith("/player") -> {
                            val encoded=Regex("""(?:^|&)url=([^&]+)""").find(target.query.orEmpty())?.groupValues?.get(1)
                            val decoded=encoded?.let { try { URLDecoder.decode(it,"UTF-8") } catch (_: Exception) { null } }
                            val track=decoded?.let { resolveUrl(it,articleUrl) }
                            if(track?.host?.lowercase(Locale.US)?.removePrefix("www.")=="soundcloud.com")
                                track.toString() else target.toString()
                        }
                        host=="youtube.com" && target.path.startsWith("/embed/") -> {
                            val id=target.path.removePrefix("/embed/").substringBefore('/')
                            if(id.matches(Regex("""[a-zA-Z0-9_-]{6,20}"""))) "https://www.youtube.com/watch?v=$id" else null
                        }
                        else -> null
                    }
                    if(link!=null)results.add(Candidate(Demo("external",link),priority))
                }
            }
            return results.maxByOrNull { it.priority }?.demo
        }
    }
}
