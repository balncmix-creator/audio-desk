package com.balnc.audioddesk

import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.net.URL

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class PublisherFeedDiscoveryTest {
    @Test fun limitsFeedHostsToPublisherAndSubdomains() {
        val source = URL("https://rekkerd.org/")
        assertTrue(PublisherFeedDiscovery.samePublisher(source, URL("https://www.rekkerd.org/feed/")))
        assertTrue(PublisherFeedDiscovery.samePublisher(source, URL("https://blog.rekkerd.org/rss.xml")))
        assertFalse(PublisherFeedDiscovery.samePublisher(source, URL("https://rekkerd.org.attacker.com/feed/")))
        assertFalse(PublisherFeedDiscovery.samePublisher(source, URL("https://notrekkerd.org/feed/")))
    }
    @Test fun rejectsNonHttpsAndPrivateHosts() {
        assertFalse(PublisherFeedDiscovery.isSafeUrl(URL("http://rekkerd.org/feed/")))
        assertFalse(PublisherFeedDiscovery.isSafeUrl(URL("https://127.0.0.1/")))
        assertFalse(PublisherFeedDiscovery.isSafeUrl(URL("https://localhost/")))
    }
}
