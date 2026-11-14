package com.balnc.audioddesk

import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class SampleDemoFinderTest {
    @Test fun findsPublisherOgAudioEvenWhenAttributesAreReversed() {
        val html = """<meta content="https://cdn.publisher.test/demo.mp3?x=1&amp;y=2" property="og:audio">
                      <meta property="og:image" content="https://cdn.publisher.test/art.jpg">"""
        assertEquals("audio", SampleDemoFinder.extractDemoFromHtml(html, "https://publisher.test/pack")?.kind)
        assertEquals("https://cdn.publisher.test/demo.mp3?x=1&y=2",
            SampleDemoFinder.extractDemoFromHtml(html, "https://publisher.test/pack")?.url)
    }
    @Test fun findsDirectAudioAndSourceTags() {
        val html = """<audio controls><source type='audio/mpeg' src='/previews/demo.mp3'></audio>"""
        assertEquals("https://publisher.test/previews/demo.mp3",
            SampleDemoFinder.extractDemoFromHtml(html, "https://publisher.test/pack/")?.url)
    }
    @Test fun findsOfficialEmbeddedSoundcloudAsExternal() {
        val html = """<iframe src="https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Flabel%2Fpackdemo"></iframe>"""
        val demo = SampleDemoFinder.extractDemoFromHtml(html, "https://publisher.test/pack/")
        assertEquals("external", demo?.kind)
        assertEquals("https://soundcloud.com/label/packdemo", demo?.url)
    }
    @Test fun neverMislabelsArtworkAsAudio() {
        val html = """<meta property="og:image" content="/header.jpg">
                      <a href="/sample-pack">Download sample pack</a>"""
        assertNull(SampleDemoFinder.extractDemoFromHtml(html, "https://publisher.test/pack/"))
    }
    @Test fun rejectsInsecureOrScriptAudio() {
        val html = """<audio src="http://localhost/private.mp3"></audio>
                      <meta property="og:audio" content="javascript:alert(1)">"""
        assertNull(SampleDemoFinder.extractDemoFromHtml(html, "https://publisher.test/pack/"))
    }
}
