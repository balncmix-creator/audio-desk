package com.balnc.audioddesk

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.roundToInt

/** Shared native editing chrome. No widget content is copied or replaced.
 * All coordinates are relative to the parent; drag deltas are physical pixels.
 */
internal class NativeWidgetEditor(
    private val host:FrameLayout,
    private val action:(String,String,Float,Float)->Unit
):FrameLayout(host.context){
    private val density=resources.displayMetrics.density
    private fun dp(n:Int)=(n*density).roundToInt()
    private val rect=RectF()
    private var accent=Color.WHITE
    private var surface=0xff25282a.toInt()
    private var ink=Color.WHITE
    private var activeEdge:String?=null
    private var startX=0f
    private var startY=0f
    private val outline=object:View(context){
        private val paint=Paint(Paint.ANTI_ALIAS_FLAG)
        override fun onDraw(c:Canvas){
            paint.style=Paint.Style.STROKE;paint.strokeWidth=dp(2).toFloat();paint.color=accent
            c.drawRoundRect(rect,dp(5).toFloat(),dp(5).toFloat(),paint)
        }
    }
    private val handles=linkedMapOf<String,View>()
    private val toolbar=LinearLayout(context).apply{gravity=Gravity.CENTER_VERTICAL}
    private val move=TextView(context).apply{text="⠿ Move";gravity=Gravity.CENTER;textSize=12f;isClickable=true;contentDescription="Drag to move widget"}
    private val actions=linkedMapOf<String,TextView>()
    init{
        clipChildren=false;clipToPadding=false;visibility=GONE
        addView(outline,LayoutParams(-1,-1))
        for(edge in listOf("nw","n","ne","w","e","sw","s","se")){
            val handle=object:View(context){
                private val paint=Paint(Paint.ANTI_ALIAS_FLAG)
                override fun onDraw(c:Canvas){
                    paint.style=Paint.Style.FILL;paint.color=surface;c.drawCircle(width/2f,height/2f,dp(9).toFloat(),paint)
                    paint.color=accent;c.drawCircle(width/2f,height/2f,dp(5).toFloat(),paint)
                }
            }.apply{isClickable=true;isFocusable=true;contentDescription="Resize "+edge}
            handles[edge]=handle;addView(handle,LayoutParams(dp(36),dp(36)));bindDrag(handle,edge)
        }
        addView(move,LayoutParams(dp(78),dp(36)));bindDrag(move,"move")
        for((key,label)in listOf("remove" to "Remove","reset" to "Reset","cancel" to "Cancel","done" to "Done")){
            val button=TextView(context).apply{text=label;gravity=Gravity.CENTER;textSize=12f;isClickable=true;isFocusable=true;setOnClickListener{action(key,"",0f,0f)}}
            actions[key]=button;toolbar.addView(button,LinearLayout.LayoutParams(dp(61),dp(38)))
        }
        addView(toolbar,LayoutParams(-2,dp(38)))
        host.addView(this,FrameLayout.LayoutParams(-1,-1))
    }
    private fun bindDrag(view:View,edge:String){
        view.setOnTouchListener{v,e->
            when(e.actionMasked){
                MotionEvent.ACTION_DOWN->{activeEdge=edge;startX=e.rawX;startY=e.rawY;v.parent.requestDisallowInterceptTouchEvent(true);action("begin",edge,0f,0f);true}
                MotionEvent.ACTION_MOVE->{if(activeEdge==edge)action("drag",edge,e.rawX-startX,e.rawY-startY);true}
                MotionEvent.ACTION_UP->{if(activeEdge==edge){action("drag",edge,e.rawX-startX,e.rawY-startY);action("end",edge,0f,0f)};activeEdge=null;v.parent.requestDisallowInterceptTouchEvent(false);true}
                MotionEvent.ACTION_CANCEL->{if(activeEdge==edge)action("end",edge,0f,0f);activeEdge=null;true}
                else->true
            }
        }
    }
    private fun background(color:Int,r:Int)=GradientDrawable().apply{setColor(color);cornerRadius=dp(r).toFloat()}
    fun show(bounds:RectF,fg:Int,bg:Int,highlight:Int,horizontal:Boolean=true,vertical:Boolean=true,canRemove:Boolean=true,canCancel:Boolean=true){
        val changed=ink!=fg||surface!=bg||accent!=highlight||visibility!=VISIBLE
        ink=fg;surface=bg;accent=highlight
        rect.set(bounds)
        if(changed){
            toolbar.background=background(surface,12);move.background=background(surface,12);move.setTextColor(ink)
            actions.values.forEach{it.setTextColor(ink)}
            actions["done"]?.apply{background=background(accent,10);setTextColor(surface)}
        }
        actions["remove"]?.visibility=if(canRemove)VISIBLE else GONE
        actions["cancel"]?.visibility=if(canCancel)VISIBLE else GONE
        for((edge,v)in handles)v.visibility=if((horizontal||!edge.any{it=='e'||it=='w'})&&(vertical||!edge.any{it=='n'||it=='s'}))VISIBLE else GONE
        if(visibility!=VISIBLE){visibility=VISIBLE;bringToFront()}
        position();outline.invalidate();handles.values.forEach{it.invalidate()}
    }
    private fun position(){
        if(host.width<=0||host.height<=0)return
        val w=host.width.toFloat();val h=host.height.toFloat()
        fun place(v:View,x:Float,y:Float,width:Int,height:Int){
            val p=v.layoutParams as LayoutParams
            val l=(x-width/2f).roundToInt().coerceIn(0,(host.width-width).coerceAtLeast(0))
            val t=(y-height/2f).roundToInt().coerceIn(dp(6),(host.height-height-dp(6)).coerceAtLeast(dp(6)))
            if(p.width!=width||p.height!=height||p.leftMargin!=l||p.topMargin!=t){p.width=width;p.height=height;p.leftMargin=l;p.topMargin=t;v.layoutParams=p}
        }
        val cx=rect.centerX();val cy=rect.centerY()
        for((edge,v)in handles){
            val x=when{edge.contains('w')->rect.left;edge.contains('e')->rect.right;else->cx}
            val y=when{edge.contains('n')->rect.top;edge.contains('s')->rect.bottom;else->cy}
            place(v,x,y,dp(36),dp(36))
        }
        place(move,cx,cy,dp(78),dp(36))
        val tw=dp(61)*actions.values.count{it.visibility==VISIBLE}
        val ty=if(rect.top>=dp(52))rect.top-dp(28) else if(rect.bottom+dp(50)<h)rect.bottom+dp(28) else dp(28).toFloat()
        place(toolbar,cx.coerceIn(0f,w),ty,tw,dp(38))
    }
    fun hide(){visibility=GONE;activeEdge=null}
    fun close(){hide();host.removeView(this)}
}
