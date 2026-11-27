package com.balnc.audioddesk

import android.app.Activity
import android.content.Intent
import android.provider.Settings
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
class AppManagementActionsTest {
    @Test fun correctNativeIntentAndPackage() {
        val pkg = "com.example.audio"
        assertEquals(Intent.ACTION_DELETE, AppManagementActions.intent(pkg,"uninstall").action)
        for(action in listOf("info","storage","force-stop")){
            val intent = AppManagementActions.intent(pkg,action)
            assertEquals(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,intent.action)
            assertEquals("package:"+pkg,intent.data.toString())
        }
        assertFalse(AppManagementActions.validPackage("https://invalid"))
        assertFalse(AppManagementActions.validAction("clear-data"))
    }
    @Test fun nativeDialogContainsFourOrderedActions() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val picked=mutableListOf<String>()
        for (key in listOf("info","storage","force-stop","uninstall")) {
            val dialog=AppManagementActions.dialog(activity,"Example") { picked.add(it) }
            dialog.show()
            val root=dialog.findViewById<android.view.View>(android.R.id.content)
            assertNotNull(root)
            for(action in listOf("info","storage","force-stop","uninstall","cancel"))
                assertNotNull(root.findViewWithTag<android.view.View>(action))
            root.findViewWithTag<android.view.View>(key).performClick()
            assertFalse(dialog.isShowing)
        }
        assertEquals(listOf("info","storage","force-stop","uninstall"),picked)
        val cancelled=AppManagementActions.dialog(activity,"Example"){picked.add(it)}
        cancelled.show()
        cancelled.findViewById<android.view.View>(android.R.id.content).findViewWithTag<android.view.View>("cancel").performClick()
        assertFalse(cancelled.isShowing)
        assertEquals(4,picked.size)
    }

    @Test fun wallpaperPaletteKeepsTextReadableAndRejectsMalformedColors() {
        val light=AppManagementActions.palette("""{"panel":"#ededed","text":"#ffffff","accent":"#ffffff","dark":"#f4f4f4"}""")
        val dark=AppManagementActions.palette("""{"panel":"#141414","text":"#111111","accent":"#000000"}""")
        for (p in listOf(light,dark,AppManagementActions.palette("invalid"),AppManagementActions.palette("""{"panel":"red"}"""))) {
            for (c in listOf(p.ink,p.accent,p.muted,p.danger)) assertTrue(AppManagementActions.contrast(c,p.panel)>=4.5)
        }
        assertEquals(android.graphics.Color.parseColor("#ededed"),light.panel)
        assertEquals(android.graphics.Color.parseColor("#29382f"),AppManagementActions.palette("""{"panel":"red"}""").panel)
    }
}
