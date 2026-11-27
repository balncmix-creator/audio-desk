package com.balnc.audioddesk
import android.app.Activity
import android.view.MotionEvent
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
class NativeOrbitTest {
    @Test fun searchAndRecentHitTargets(){
        val a=Robolectric.buildActivity(Activity::class.java).setup().get()
        var searched=false;var selected=""
        val view=NativeOrbitView(a,{selected=it.pkg},{},{searched=true},{},{})
        val app=NativeOrbitView.App("com.example.a","A","Audio")
        view.data(listOf(app),listOf(app),emptyList())
        a.setContentView(view);view.layout(0,0,334,334)
        fun tap(x:Float,y:Float){
            val down=MotionEvent.obtain(0,0,MotionEvent.ACTION_DOWN,x,y,0)
            val up=MotionEvent.obtain(0,50,MotionEvent.ACTION_UP,x,y,0)
            assertTrue(view.onTouchEvent(down));assertTrue(view.onTouchEvent(up));down.recycle();up.recycle()
        }
        tap(306f,304f);assertTrue(searched)
        tap(230f,230f);assertEquals("com.example.a",selected)
    }
}
