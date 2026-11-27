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

    @Test fun quickActionsShareNativeDialogAndUpdatePublishedRows() {
        val activity=Robolectric.buildActivity(Activity::class.java).setup().get()
        val picked=mutableListOf<String>()
        val menu=AppManagementActions.menu(activity,"Example",null,AppManagementActions.palette(),"Quick actions",AppManagementActions.quickRows(true),"Checking…"){picked.add(it)}
        menu.dialog.show()
        val root=menu.dialog.findViewById<android.view.View>(android.R.id.content)
        assertNotNull(root.findViewWithTag<android.view.View>("open"))
        assertNotNull(root.findViewWithTag<android.view.View>("pin"))
        assertNull(root.findViewWithTag<android.view.View>("uninstall"))
        val list=org.json.JSONArray("""[{"id":"new","label":"New project"},{"id":"new","label":"Duplicate"},{"id":"","label":"Invalid"}]""")
        val rows=AppManagementActions.quickRows(true,list)
        assertEquals(listOf("Open app","Unpin from Home","New project"),rows.map{it.label})
        menu.update(rows,null)
        root.findViewWithTag<android.view.View>("shortcut:new").performClick()
        assertEquals(listOf("shortcut:new"),picked)
        assertFalse(menu.dialog.isShowing)
    }
    @Test fun nativeMenuRetainsThemeGeometryAndLightSurface() {
        for ((theme,radius) in listOf("warm" to 21f,"orbit" to 21f,"minimal" to 14f,"pixel" to 2f,"windows" to 0f,"extreme" to 0f)) {
            val p=AppManagementActions.palette(org.json.JSONObject().put("theme",theme).put("panel","#e4ebe9").put("text","#1d3133").toString())
            assertEquals(theme,p.theme)
            assertEquals(radius,p.radius,0f)
            assertEquals(android.graphics.Color.parseColor("#e4ebe9"),p.panel)
            assertEquals(android.graphics.Color.parseColor("#1d3133"),p.ink)
            assertTrue(AppManagementActions.contrast(p.ink,p.panel)>=4.5)
        }
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
