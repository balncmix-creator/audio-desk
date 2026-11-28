package com.balnc.audioddesk

import android.graphics.Color
import android.graphics.drawable.GradientDrawable

/** Shared native palette; no dependence on CSS or browser state. */
internal data class NativeDeskTheme(
    val background:Int, val panel:Int, val control:Int, val ink:Int,
    val muted:Int, val accent:Int, val line:Int, val cornerDp:Int
) {
    fun surface(density:Float, color:Int=panel, bordered:Boolean=false)=GradientDrawable().apply {
        setColor(color);cornerRadius=cornerDp*density
        if(bordered)setStroke(density.toInt().coerceAtLeast(1),line)
    }
    companion object {
        val graphite=NativeDeskTheme(0xff161819.toInt(),0xff25282a.toInt(),0xff34383a.toInt(),
            0xfff1f1ef.toInt(),0xffb9bdbd.toInt(),0xffd1dad5.toInt(),0xff404546.toInt(),16)
        val warm=NativeDeskTheme(0xff211e1b.toInt(),0xff302b27.toInt(),0xff443c35.toInt(),
            0xfff4eee6.toInt(),0xffc7bcb1.toInt(),0xffe3c4a6.toInt(),0xff52483e.toInt(),16)
        fun named(id:String)=if(id=="graphite")graphite else warm
        fun withWallpaper(base:NativeDeskTheme, color:Int):NativeDeskTheme {
            // Blend towards a light neutral so accent remains readable on dark cards.
            val f=.38
            fun c(v:Int)=(v*(1-f)+235*f).toInt().coerceIn(0,255)
            val a=Color.rgb(c(Color.red(color)),c(Color.green(color)),c(Color.blue(color)))
            return base.copy(accent=a)
        }
    }
}
