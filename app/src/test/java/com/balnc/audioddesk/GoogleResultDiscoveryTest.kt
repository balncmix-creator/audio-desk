package com.balnc.audioddesk
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
class GoogleResultDiscoveryTest {
    @Test fun onlyGoogleSearchPageIsEligible() {
        assertTrue(GoogleResultDiscovery.isGoogleResults("https://www.google.com/search?q=audio"))
        assertFalse(GoogleResultDiscovery.isGoogleResults("https://www.google.com.evil.example/search?q=audio"))
        assertFalse(GoogleResultDiscovery.isGoogleResults("https://accounts.google.com/search"))
        assertFalse(GoogleResultDiscovery.isGoogleResults("https://www.google.com/"))
        assertFalse(GoogleResultDiscovery.isGoogleResults("http://www.google.com/search"))
    }
    @Test fun onlyBoundedPublicLinkRecordsAreReturned() {
        val rows=GoogleResultDiscovery.decodeRows("""[{"title":"New audio plugin","url":"https://publisher.example/news"},{"title":"Local","url":"file:///private"},{"title":"","url":"https://publisher.example/"}]""")
        assertEquals(1, rows.length())
        assertEquals("New audio plugin",rows.getJSONObject(0).getString("title"))
        assertEquals(0,GoogleResultDiscovery.decodeRows("null").length())
    }
}
