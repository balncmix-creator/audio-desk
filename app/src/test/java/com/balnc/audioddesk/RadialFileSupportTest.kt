package com.balnc.audioddesk

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RadialFileSupportTest {
    @Test fun acceptsNormalFileAndFolderNames() {
        assertEquals("Foley takes", RadialFileSupport.safeName("  Foley takes  "))
        assertEquals("Music 2026.wav", RadialFileSupport.safeName("Music 2026.wav"))
    }
    @Test fun rejectsUnsafeNamesAndPathTraversal() {
        for (name in listOf("", "  ", ".", "..", "../tmp", "A/B", "C:\\Temp",
            "bad\u0000name", "bad\nname", "a".repeat(121))) {
            assertNull("Must reject $name", RadialFileSupport.safeName(name))
        }
    }
}
