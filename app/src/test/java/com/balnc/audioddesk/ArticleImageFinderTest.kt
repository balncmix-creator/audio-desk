package com.balnc.audioddesk

import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.net.InetAddress
import java.net.URL

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class ArticleImageFinderTest {
    @Test fun findsPublisherOgImageDespiteReorderedAttributes() {
        val html = """<html><head><meta content="https://images.example.com/1200x675.jpg?a=1&amp;b=2" property="og:image">
             <meta name="twitter:image" content="https://images.example.com/600.jpg"></head></html>"""
        assertEquals("https://images.example.com/1200x675.jpg?a=1&b=2",
            ArticleImageFinder.extractImageFromHtml(html, "https://publisher.example.com/news/story"))
    }
    @Test fun choosesTwitterFallbackWhenOgImageIsOnlyATinyThumbnail() {
        val html = """<meta property='og:image' content='/assets/thumbnail-96x96.jpg'>
             <meta name='twitter:image' content='/images/hero-1200.jpg'>"""
        assertEquals("https://publisher.example.com/images/hero-1200.jpg",
            ArticleImageFinder.extractImageFromHtml(html, "https://publisher.example.com/news"))
    }
    @Test fun rejectsUnsafeImageSchemesAndUnrelatedMeta() {
        val html = """<meta property="og:title" content="An article">
             <meta property="og:image" content="http://private.example/cover.jpg">
             <meta name="twitter:image" content="javascript:alert(1)">"""
        assertNull(ArticleImageFinder.extractImageFromHtml(html, "https://publisher.example.com/news"))
    }
    @Test fun refusesPrivateArticleHosts() {
        assertFalse(ArticleImageFinder.isPublicHttpsUrl(URL("https://127.0.0.1/article")))
        assertFalse(ArticleImageFinder.isPublicHttpsUrl(URL("http://example.com/article")))
        assertFalse(ArticleImageFinder.isPublicHttpsUrl(URL("https://localhost/article")))
    }
}
