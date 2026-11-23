package com.balnc.audioddesk

import org.junit.Assert.assertEquals
import org.junit.Test

class OrbitDeviceProfileTest {
    @Test fun recognizesGalaxyA73Variants() {
        assertEquals("galaxy-a73", OrbitDeviceProfile.classify("samsung", "SM-A736B", "a73xq"))
        assertEquals("galaxy-a73", OrbitDeviceProfile.classify("Samsung", "SM-A736E", "unknown"))
        assertEquals("galaxy-a73", OrbitDeviceProfile.classify("SAMSUNG", "unknown", "a73xq"))
    }

    @Test fun ignoresOtherPhonesAndSpoofedModel() {
        assertEquals("generic", OrbitDeviceProfile.classify("Samsung", "SM-A735B", "a72"))
        assertEquals("generic", OrbitDeviceProfile.classify("Google", "SM-A736B", "pixel"))
        assertEquals("generic", OrbitDeviceProfile.classify("", "", ""))
    }
}
