package com.balnc.audioddesk

import android.graphics.Bitmap
import android.graphics.Canvas
import org.robolectric.RuntimeEnvironment
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class DeskLogoViewTest {
    @Test fun pullRotationChangesRendered3DDeskRatherThanJustOpacity() {
        val view = DeskLogoView(RuntimeEnvironment.getApplication())
        view.layout(0,0,192,192)
        fun picture(): Bitmap {
            val bitmap=Bitmap.createBitmap(192,192,Bitmap.Config.ARGB_8888)
            view.draw(Canvas(bitmap))
            return bitmap
        }
        view.showPull(0f)
        val front=picture()
        view.showPull(1f)
        val side=picture()
        assertFalse("Pull must change tabletop and face geometry, not only opacity",front.sameAs(side))
        val pixels=IntArray(192*192)
        front.getPixels(pixels,0,192,0,0,192,192)
        assertTrue("3D desk must be visible", pixels.count { it ushr 24 > 0 } > 500)
    }
}
