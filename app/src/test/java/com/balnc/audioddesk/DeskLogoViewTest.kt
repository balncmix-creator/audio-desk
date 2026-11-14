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
    @Test fun pullingChanges3DAngleAndModelKeepsFourLegs() {
        val view = DeskLogoView(RuntimeEnvironment.getApplication())
        view.layout(0, 0, 192, 192)
        val rotationField = DeskLogoView::class.java.getDeclaredField("rotation").apply { isAccessible = true }
        val legsField = DeskLogoView::class.java.getDeclaredField("legFaces").apply { isAccessible = true }

        view.showPull(0f)
        val startingAngle = rotationField.getFloat(view)
        view.showPull(1f)
        val pulledAngle = rotationField.getFloat(view)
        assertTrue("Pull must rotate the 3D tabletop and legs, not just pulse bitmap opacity",
            pulledAngle > startingAngle + 1.5f)

        // Each of the four 3D legs has five exposed geometric faces, plus the
        // tabletop rendered separately. Android's hardware Canvas rasterizer is
        // not reliably represented by Robolectric's shadow Bitmap.equals.
        assertEquals("The renderer should have four independent cuboid legs",
            20, (legsField.get(view) as List<*>).size)

        val bitmap = Bitmap.createBitmap(192, 192, Bitmap.Config.ARGB_8888)
        view.draw(Canvas(bitmap)) // Geometry drawing must not throw.
    }
}
