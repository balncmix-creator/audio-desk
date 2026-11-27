package com.balnc.audioddesk
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
class NativeNewsTest {
    @Test fun parseAndClassify(){
        val xml="""<rss version="2.0"><channel><item><title>New REAPER ReaScript</title><link>https://example.org/news</link><pubDate>Wed, 25 Nov 2026 08:00:00 GMT</pubDate></item></channel></rss>"""
        val rows=NativeNews.parse(xml.byteInputStream(),Feed("Test","https://example.org/feed","Plugin releases"))
        assertEquals(1,rows.size);assertEquals("REAPER",rows[0].category)
    }
    @Test fun atomAndOrder(){
        val xml="""<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>New sample pack</title><link href="https://example.org/new"/><updated>2020-01-01T09:30:00Z</updated></entry></feed>"""
        val rows=NativeNews.parse(xml.byteInputStream(),Feed("Test","https://example.org/feed","Production"))
        assertEquals("Sample packs",rows.single().category);assertTrue(rows.single().date>0)
        assertEquals(1,NativeNews.ordered(rows+rows).size)
        assertEquals(rows,NativeNews.decode(NativeNews.encode(rows)))
    }
    @Test fun invalidDatesAndUrls(){
        assertEquals(0L,NativeNews.date("2026-02-30"))
        assertFalse(NativeNews.urlAllowed("http://example.org"))
        assertFalse(NativeNews.urlAllowed("https://127.0.0.1"))
    }
}
