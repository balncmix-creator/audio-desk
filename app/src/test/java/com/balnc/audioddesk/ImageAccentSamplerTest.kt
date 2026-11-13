package com.balnc.audioddesk

import android.graphics.Bitmap
import android.graphics.Color
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.net.InetAddress

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class ImageAccentSamplerTest {
    @Test fun selectsImageColorRatherThanGreyBackground() {
        val bitmap = Bitmap.createBitmap(16, 16, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(Color.LTGRAY)
        for (y in 0..7) for (x in 0..7) bitmap.setPixel(x, y, Color.rgb(35, 95, 210))
        assertEquals(Color.rgb(35, 95, 210), ImageAccentSampler.dominantColor(bitmap))
        bitmap.recycle()
    }

    @Test fun monochromeImagesHaveNoColorAccent() {
        val bitmap = Bitmap.createBitmap(16, 16, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(Color.GRAY)
        assertNull(ImageAccentSampler.dominantColor(bitmap))
        bitmap.recycle()
    }

    @Test fun refusesPrivateImageDestinations() {
        for (host in listOf("127.0.0.1", "192.168.1.2", "10.0.0.1", "169.254.1.1", "::1", "fc00::1")) {
            assertFalse(host, ImageAccentSampler.isPublicAddress(InetAddress.getByName(host)))
        }
        assertTrue(ImageAccentSampler.isPublicAddress(InetAddress.getByName("8.8.8.8")))
    }
}
