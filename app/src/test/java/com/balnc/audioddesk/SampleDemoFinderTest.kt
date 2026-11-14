package com.balnc.audioddesk

import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class SampleDemoFinderTest {
    @Test fun publisherAudioMetadata() {
        val html = """<meta content="https://cdn.publisher.test/demo.mp3?x=1&amp;y=2" property="og:audio">"""
        val demo = SampleDemoFinder.extractDemoFromHtml(html,"https://publisher.test/pack")
        assertEquals("audio", demo?.kind)
        assertEquals("https://cdn.publisher.test/demo.mp3?x=1&y=2",demo?.url)
    }
    @Test fun directAudio() {
        val html = """<audio controls><source type='audio/mpeg' src='/previews/demo.mp3'></audio>"""
        assertEquals("https://publisher.test/previews/demo.mp3",
            SampleDemoFinder.extractDemoFromHtml(html,"https://publisher.test/pack/")?.url)
    }
    @Test fun officialSoundCloudEmbed() {
        val html = """<iframe src="https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Flabel%2Fpackdemo"></iframe>"""
        val demo = SampleDemoFinder.extractDemoFromHtml(html,"https://publisher.test/pack/")
        assertEquals("external",demo?.kind)
        assertEquals("https://soundcloud.com/label/packdemo",demo?.url)
    }
    @Test fun noMadeUpDemo() {
        val html = """<meta property="og:image" content="/header.jpg"><a href="/pack">Download sample pack</a>"""
        assertNull(SampleDemoFinder.extractDemoFromHtml(html,"https://publisher.test/pack/"))
    }
    @Test fun unsafeDemoRejected() {
        assertNull(SampleDemoFinder.extractDemoFromHtml(
            """<audio src="http://localhost/demo.mp3"></audio><meta property="og:audio" content="javascript:alert(1)">""",
            "https://publisher.test/pack/"))
    }
    @Test fun matchingUsesDistinctiveTitleWords() {
        assertTrue(SampleDemoFinder.matchScore("SoundMorph First Contact Sound Library",
            "SoundMorph First Contact - cinematic effects")>=65)
        assertEquals(0,SampleDemoFinder.matchScore("SoundMorph First Contact Sound Library",
            "Random thunder and rain sample pack"))
    }
    @Test fun duckDuckGoSearchReturnsOriginalPackPage() {
        val html = """<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.loopmasters.com%2Fgenres%2F103-Sound-Effects%2Fproducts%2F9000-SoundMorph-First-Contact">SoundMorph First Contact - Loopmasters</a>"""
        val hits=SampleDemoFinder.parseSearchResults(html,"SoundMorph First Contact Sample Library")
        assertEquals(1,hits.size)
        assertEquals("loopmasters.com",hits[0].url.host.removePrefix("www."))
    }
    @Test fun bingRssSearchMatchesExactProduct() {
        val xml = """<rss><channel><item><title>SoundMorph First Contact cinematic sample library</title>
            <link>https://www.loopmasters.com/product/first-contact</link></item></channel></rss>"""
        val hits=SampleDemoFinder.parseSearchResults(xml, "SoundMorph First Contact Sample Library")
        assertEquals(1,hits.size)
        assertEquals("https://www.loopmasters.com/product/first-contact",hits[0].url.toString())
    }
    @Test fun rejectsIrrelevantSearchResult() {
        val html = """<a class="result__a" href="https://www.loopmasters.com/other">Random Drum Loops Collection</a>"""
        assertTrue(SampleDemoFinder.parseSearchResults(html,"SoundMorph First Contact Sample Library").isEmpty())
    }
}
