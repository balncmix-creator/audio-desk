package com.balnc.audioddesk

import org.junit.Assert.*
import org.junit.Test

class NativeCatalogTest {
    private val apps = listOf(
        NativeCatalogApp("com.ninja.vpn", "Main", "Ninja VPN"),
        NativeCatalogApp("com.notes", "Main", "Notes"),
        NativeCatalogApp("com.notes", "Editor", "Notes"),
        NativeCatalogApp("com.music", "Main", "Music"),
        NativeCatalogApp("com.numeric", "Main", "123"),
        NativeCatalogApp("com.other", "Main", "音楽")
    )
    @Test fun searchMatchesPartialLabelsAndPackages() {
        assertEquals(listOf(apps[0]), NativeCatalog.search(apps, "nin"))
        assertEquals(listOf(apps[0]), NativeCatalog.search(apps, " NIN  vpn "))
        assertEquals(listOf(apps[1], apps[2]), NativeCatalog.search(apps, "com.notes"))
        assertEquals(apps, NativeCatalog.search(apps, "  "))
        assertTrue(NativeCatalog.search(apps, "unavailable").isEmpty())
    }
    @Test fun componentIdentityAndSectionIndexRemainDistinct() {
        assertNotEquals(apps[1].key, apps[2].key)
        assertEquals(0, NativeCatalog.index(apps, 'N'))
        assertEquals(3, NativeCatalog.index(apps, 'M'))
        assertEquals(4, NativeCatalog.index(apps, '#'))
        assertEquals(-1, NativeCatalog.index(apps, 'Z'))
        assertEquals('#', NativeCatalog.section("音楽"))
        assertEquals('#', NativeCatalog.section(""))
        assertEquals('A', NativeCatalog.section("  alpha"))
        assertEquals(-1, NativeCatalog.index(emptyList(), 'A'))
    }
}
