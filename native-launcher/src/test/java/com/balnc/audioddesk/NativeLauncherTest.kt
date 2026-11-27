package com.balnc.audioddesk
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Button
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
class NativeLauncherTest {
    private fun walk(v:View):List<View> = listOf(v)+(if(v is ViewGroup)(0 until v.childCount).flatMap{walk(v.getChildAt(it))}else emptyList())
    @Test fun nativeHomeAndAppSearch(){
        val controller=Robolectric.buildActivity(NativeLauncherActivity::class.java).create()
        val activity=controller.get()
        val root=activity.findViewById<View>(android.R.id.content)
        assertTrue(walk(root).filterIsInstance<TextView>().all{!it.isTextSelectable})
        walk(root).filterIsInstance<Button>().first{it.text=="Apps"}.performClick()
        assertTrue(walk(root).any{it is android.widget.EditText})
        controller.destroy()
    }
}
