package com.balnc.audioddesk

import android.app.Activity
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.TextView
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
class NativeAcousticCardsTest {
    @Test fun nativeCardsDisplayControlsAndHideOnLifecycle() {
        val activity=Robolectric.buildActivity(Activity::class.java).setup().get()
        val web=WebView(activity)
        activity.setContentView(web)
        web.layout(0,0,400,800)
        val panel=NativeSpectrumPlot(activity,web)
        fun card(y:Int)=JSONObject().put("visible",true).put("x",10).put("y",y)
            .put("w",360).put("h",250).put("top",0).put("bottom",800)
            .put("panel","#202020").put("ink","#ffffff").put("accent","#aaccaa")
        val spl=card(20).put("reading","-36.1").put("unit","dBFS A")
            .put("weight","A").put("response","fast").put("progress",64)
        val mic=card(290).put("range",90).put("held",true)
        val payload=JSONObject().put("viewport",400).put("spl",spl).put("mic",mic)
        panel.updateFull(payload.toString())
        val root=activity.findViewById<ViewGroup>(android.R.id.content)
        fun labels(v:View):List<String>{
            if(v.visibility!=View.VISIBLE)return emptyList()
            if(v is TextView)return listOf(v.text.toString())
            return if(v is ViewGroup)(0 until v.childCount).flatMap{labels(v.getChildAt(it))}else emptyList()
        }
        val names=labels(root)
        assertTrue(names.containsAll(listOf("SPL meter","-36.1","dBFS A","Fast","Reset max","Calibration","Mic spectrum","90 dB","Peak on")))
        assertEquals(2,names.count{it=="Start mic"})
        panel.hide()
        assertFalse(labels(root).contains("SPL meter"))
        assertFalse(labels(root).contains("Mic spectrum"))
        panel.close()
    }
}
