package com.balnc.audioddesk

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.content.res.ColorStateList
import android.widget.TextView
import kotlin.math.min

/** Font-independent media symbols with consistent optical sizes. */
internal class NativeMusicControl(context:Context, private val kind:String):TextView(context){
    private val paint=Paint(Paint.ANTI_ALIAS_FLAG)
    private val shape=Path()
    private var playing=false
    private var ink=0xffeeeeee.toInt()
    private val density=resources.displayMetrics.density
    init {isClickable=true;isFocusable=true;includeFontPadding=false
        contentDescription=when(kind){"previous"->"Previous track";"next"->"Next track";"play"->"Play";"connect"->"Connect music player";else->"Enable audio spectrum"}
    }
    fun setPlaying(value:Boolean){
        playing=value;contentDescription=if(value)"Pause"else"Play";invalidate()
    }
    fun setPalette(foreground:Int,accent:Int,panel:Int){
        ink=if(kind=="play")panel else foreground
        val bg=GradientDrawable().apply{shape=GradientDrawable.OVAL;setColor(if(kind=="play")accent else 0x00000000)}
        background=RippleDrawable(ColorStateList.valueOf((foreground and 0x00ffffff) or 0x22000000),bg,GradientDrawable().apply{shape=GradientDrawable.OVAL;setColor(-1)})
        invalidate()
    }
    override fun onDraw(canvas:Canvas){
        val size=min(min(width,height).toFloat()*.62f,23*density)
        if(size<=0)return
        canvas.save();canvas.translate(width/2f,height/2f);canvas.scale(size/24f,size/24f)
        paint.color=ink;paint.style=Paint.Style.FILL
        fun tri(x:Float,y:Float,d:Float){
            shape.reset();shape.moveTo(x,y-7);shape.lineTo(x+d*11,y);shape.lineTo(x,y+7);shape.close();canvas.drawPath(shape,paint)
        }
        when(kind){
            "play"->if(playing){canvas.drawRoundRect(-7f,-8f,-2f,8f,1f,1f,paint);canvas.drawRoundRect(2f,-8f,7f,8f,1f,1f,paint)}else tri(-5f,0f,1f)
            "previous"->{tri(6f,0f,-1f);canvas.drawRoundRect(-9f,-7f,-6f,7f,1f,1f,paint)}
            "next"->{tri(-6f,0f,1f);canvas.drawRoundRect(6f,-7f,9f,7f,1f,1f,paint)}
            "connect"->{paint.style=Paint.Style.STROKE;paint.strokeWidth=2f;canvas.drawRoundRect(-9f,-7f,9f,7f,3f,3f,paint);canvas.drawLine(-4f,10f,4f,10f,paint)}
            else->{paint.strokeWidth=2f;paint.strokeCap=Paint.Cap.ROUND;for(i in -2..2){val h=if(i==0)9f else if(kotlin.math.abs(i)==1)6f else 3f;canvas.drawLine(i*4f,-h,i*4f,h,paint)}}
        }
        canvas.restore()
    }
}
