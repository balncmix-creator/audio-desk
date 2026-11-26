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
        val dialog=AppManagementActions.dialog(activity,"Example") { picked.add(it) }
        dialog.show()
        val list=dialog.listView
        assertEquals(listOf("App info","Uninstall","Clear cache","Force stop"),
            (0 until list.adapter.count).map { list.adapter.getItem(it).toString() })
        list.performItemClick(list.adapter.getView(2,null,list),2,list.adapter.getItemId(2))
        assertEquals(listOf("storage"),picked)
        dialog.dismiss()
    }
}
