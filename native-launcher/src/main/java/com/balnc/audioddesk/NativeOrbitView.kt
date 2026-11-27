package com.balnc.audioddesk

import android.content.Context
import android.graphics.*
import android.graphics.drawable.Drawable
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.HapticFeedbackConstants
import android.animation.ValueAnimator
import android.view.animation.DecelerateInterpolator
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.*

/** Native quarter-circle dial using the original Orbit design's 334-unit geometry. */
internal class NativeOrbitView(
    context:Context,
    private val launch:(App)->Unit,
    private val manage:(App)->Unit,
    private val search:()->Unit,
    private val widget:(String)->Unit,
    private val externalAction:(Int)->Unit
):View(context){
    data class App(val pkg:String,val activity:String,val label:String)
    data class External(val id:Int,val label:String,val pkg:String="")
    private val paint=Paint(Paint.ANTI_ALIAS_FLAG)
    private val path=Path()
    private val textPath=Path()
    private val icons=android.util.LruCache<String,Drawable>(48)
    private val alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ#"
    private val widgets=listOf("Music","Calendar","News","Files")
    private var apps=emptyList<App>()
    private var recents=emptyList<App>()
    private var external=listOf(External(0,"Add widget"))
    private val indices=IntArray(4)
    private val offsets=FloatArray(4)
    private var animation:ValueAnimator?=null
    private var popup=false
    private var popupPage=0
    private var scale=1f
    private var originX=0f;private var originY=0f
    private var surface=Color.rgb(32,38,34)
    private var raised=Color.rgb(53,72,60)
    private var line=Color.rgb(97,117,104)
    private var accent=Color.rgb(197,224,200)
    private var fg=Color.rgb(229,240,231)
    private var active=-1
    private var lastAngle=0f;private var startAngle=0f
    private var downX=0f;private var downY=0f
    private var lastAt=0L;private var velocity=0f
    private var moved=false;private var held=false
    private var holdApp:App?=null
    private val slop=ViewConfiguration.get(context).scaledTouchSlop
    private val hold=Runnable{
        if(!moved&&holdApp!=null){held=true;performHapticFeedback(HapticFeedbackConstants.LONG_PRESS);holdApp?.let(manage)}
    }
    init{
        isClickable=true;isFocusable=true
        contentDescription="Orbit radial launcher. Search in center, rotate the letters, recents, widgets and Android widgets."
    }
    fun data(all:List<App>,recent:List<App>,items:List<External>){
        apps=all;recents=recent.distinctBy{it.pkg+"/"+it.activity}
        external=items.filter{it.id>0}+External(0,"Add widget")
        for(i in 0..3)indices[i]=wrap(indices[i],length(i))
        invalidate()
    }
    fun colors(text:Int,accentColor:Int,panel:Int){
        fg=text;accent=accentColor;surface=panel
        fun blend(t:Float)=Color.rgb(
            (Color.red(panel)*(1-t)+Color.red(accent)*t).toInt(),
            (Color.green(panel)*(1-t)+Color.green(accent)*t).toInt(),
            (Color.blue(panel)*(1-t)+Color.blue(accent)*t).toInt())
        raised=blend(.18f);line=blend(.42f);invalidate()
    }
    private fun wrap(i:Int,n:Int)=if(n<=0)0 else ((i%n)+n)%n
    private fun length(r:Int)=when(r){0->alphabet.length;1->recents.size.coerceAtLeast(1);2->widgets.size;else->external.size}
    private fun step(r:Int)=when(r){0->11.25f;1->90f/min(5,recents.size.coerceAtLeast(1));2->60f;else->38f}
    private fun pt(r:Float,a:Float)=PointF((-r*cos(Math.toRadians(a.toDouble()))).toFloat(),(-r*sin(Math.toRadians(a.toDouble()))).toFloat())
    private fun rect(r:Float)=RectF(-r,-r,r,r)
    private fun ring(c:Canvas,outer:Float,inner:Float,color:Int,start:Float=0f,end:Float=90f){
        val a=start.coerceIn(0f,90f);val b=end.coerceIn(0f,90f);if(b<=a)return
        path.reset();path.arcTo(rect(outer),180+a,b-a,true)
        if(inner>0){val p=pt(inner,b);path.lineTo(p.x,p.y);path.arcTo(rect(inner),180+b,a-b,false)}else path.lineTo(0f,0f)
        path.close();paint.style=Paint.Style.FILL;paint.color=color;c.drawPath(path,paint)
    }
    private fun circle(c:Canvas,r:Float,a:Float,size:Float,color:Int){
        val p=pt(r,a);paint.style=Paint.Style.FILL;paint.color=color;c.drawCircle(p.x,p.y,size,paint)
    }
    private fun text(c:Canvas,label:String,r:Float,a:Float,size:Float,color:Int,curved:Boolean=true,width:Float=60f){
        paint.style=Paint.Style.FILL;paint.color=color;paint.textSize=size;paint.typeface=Typeface.DEFAULT;paint.textAlign=Paint.Align.CENTER
        if(curved){
            textPath.reset();textPath.addArc(rect(r),180+a-width/2,width)
            val length=(r*PI*width/180).toFloat()
            var value=label
            while(value.length>1&&paint.measureText(value)>length)value=value.dropLast(1)
            c.drawTextOnPath(value,textPath,length/2,0f,paint)
        }else{val p=pt(r,a);c.drawText(label,p.x,p.y-(paint.ascent()+paint.descent())/2,paint)}
    }
    private fun icon(c:Canvas,app:App,r:Float,a:Float){
        val p=pt(r,a);circle(c,r,a,19f,raised)
        val d=icons.get(app.pkg)?:try{context.packageManager.getApplicationIcon(app.pkg).also{icons.put(app.pkg,it)}}catch(_:Exception){null}
        if(d!=null){d.setBounds((p.x-14).roundToInt(),(p.y-14).roundToInt(),(p.x+14).roundToInt(),(p.y+14).roundToInt());d.draw(c)}
        else text(c,app.label.take(1).uppercase(Locale.ROOT),r,a,13f,fg,false)
    }
    private fun matching()=apps.filter{app->
        val l=alphabet[indices[0]];val first=app.label.trim().firstOrNull()?.uppercaseChar()
        if(l=='#')first==null||first !in 'A'..'Z' else first==l
    }
    private fun fan():List<App>{
        val all=matching();popupPage=wrap(popupPage,((all.size+4)/5).coerceAtLeast(1))
        return all.drop(popupPage*5).take(5)
    }
    override fun onSizeChanged(w:Int,h:Int,oldw:Int,oldh:Int){
        scale=(min(w,h)/334f).coerceAtLeast(.01f);originX=w.toFloat();originY=h.toFloat()
    }
    override fun onDraw(c:Canvas){
        super.onDraw(c);c.save();c.translate(originX,originY);c.scale(scale,scale);c.clipRect(-334f,-334f,0f,0f)
        ring(c,330f,301f,surface)
        paint.strokeWidth=1f;paint.color=line;paint.style=Paint.Style.STROKE
        for(i in 0..22){val a=1f+i*4;val p=pt(326f,a);val q=pt(if(i%3==0)319f else 323f,a);c.drawLine(p.x,p.y,q.x,q.y,paint)}
        val now=Date()
        text(c,SimpleDateFormat("h:mm",Locale.getDefault()).format(now),313f,45f,16f,fg,width=34f)
        text(c,SimpleDateFormat("EEE, d MMM",Locale.getDefault()).format(now).uppercase(Locale.getDefault()),304f,45f,8f,fg,width=46f)
        ring(c,300f,250f,surface)
        for(i in -2..2){
            val a=45f+i*38f+offsets[3];if(a+18.3f<1.35f||a-18.3f>88.65f)continue
            val item=external[wrap(indices[3]+i,external.size)]
            ring(c,299f,251f,if(i==0)raised else surface,a-18.3f,a+18.3f)
            if(item.pkg.isNotEmpty())icon(c,App(item.pkg,"",item.label),275f,a)
            else text(c,if(item.id==0)"+" else "▦",275f,a,20f,fg,false)
            if(i==0)text(c,item.label.uppercase(Locale.ROOT),256f,a,9f,fg,width=30f)
        }
        for(i in -2..2){
            val a=45f+i*60f+offsets[2];if(a+30<0||a-30>90)continue
            val name=widgets[wrap(indices[2]+i,widgets.size)]
            ring(c,249f,182f,if(i==0)raised else surface,a-29f,a+29f)
            if(i==0){
                text(c,name.uppercase(Locale.ROOT),235f,a,12f,fg,width=48f)
                text(c,when(name){"Music"->"MUSIC PLAYER";"Calendar"->SimpleDateFormat("EEE, d MMM",Locale.getDefault()).format(now);"News"->"AUDIO NEWS";else->"RADIAL FILES"},219f,a,9f,fg,width=45f)
                circle(c,199f,a,13f,accent);text(c,"↗",199f,a,13f,Color.rgb(18,37,23),false)
            }else text(c,when(name){"Music"->"♫";"Calendar"->"▦";"News"->"≋";else->"▣"},211f,a,18f,fg,false)
        }
        ring(c,178f,112f,if(popup)raised else surface)
        if(popup){
            val list=fan()
            if(list.isEmpty())text(c,"NO APPS",145f,45f,12f,fg)
            else list.forEachIndexed{i,app->icon(c,app,147f,(i+.5f)*90f/list.size)}
            val count=matching().size
            if(count>5)text(c,(popupPage+1).toString()+"/"+((count+4)/5),118f,45f,10f,fg)
        }else if(recents.isEmpty())text(c,"↺",145f,45f,22f,fg,false)
        else{
            val count=min(5,recents.size);val gap=90f/count
            for(i in -2 until count+2){val a=(i+.5f)*gap+offsets[1];if(a< -15||a>105)continue;icon(c,recents[wrap(indices[1]+i,recents.size)],147f,a)}
        }
        ring(c,108f,64f,raised)
        for(i in -5..5){
            val a=45f+i*11.25f+offsets[0];if(a< -10||a>100)continue
            val selected=abs(a-45f)<5.625f
            if(selected)circle(c,86f,a,11f,accent)
            text(c,alphabet[wrap(indices[0]+i,alphabet.length)].toString(),86f,a,12f,if(selected)Color.rgb(18,37,23)else fg,width=11f)
        }
        paint.style=Paint.Style.FILL;paint.color=fg;path.reset()
        val p=pt(107f,45f);val q=pt(117f,43.55f);val z=pt(117f,46.45f)
        path.moveTo(p.x,p.y);path.lineTo(q.x,q.y);path.lineTo(z.x,z.y);path.close();c.drawPath(path,paint)
        ring(c,60f,0f,raised)
        paint.color=fg;paint.strokeWidth=2.5f;paint.strokeCap=Paint.Cap.ROUND;paint.style=Paint.Style.STROKE
        c.drawCircle(-28f,-30f,9f,paint);c.drawLine(-21.5f,-23.5f,-14f,-16f,paint)
        c.restore()
    }
    private fun polar(e:MotionEvent):Pair<Float,Float>{
        val x=(e.x-originX)/scale;val y=(e.y-originY)/scale
        return hypot(x,y) to Math.toDegrees(atan2(-y,-x).toDouble()).toFloat()
    }
    private fun which(r:Float)=when{r in 64f..108f->0;r in 112f..178f->1;r in 182f..249f->2;r in 250f..300f->3;else->-1}
    private fun hitApp(a:Float):App?{
        val data=if(popup)fan()else recents;if(data.isEmpty())return null
        val count=min(5,data.size);val i=(a/(90f/count)).toInt().coerceIn(0,count-1)
        return data[if(popup)i else wrap(indices[1]+i,data.size)]
    }
    private fun shift(r:Int,d:Int){indices[r]=wrap(indices[r]+d,length(r));if(r==0){popup=true;popupPage=0}}
    private fun settle(r:Int){
        if(r<0)return
        val unit=step(r);val total=offsets[r]+(velocity*.085f).coerceIn(-2*unit,2*unit)
        val count=(total/unit).roundToInt();if(count!=0)shift(r,-count)
        animation?.cancel()
        animation=ValueAnimator.ofFloat(total-count*unit,0f).apply{
            duration=160;interpolator=DecelerateInterpolator()
            addUpdateListener{offsets[r]=it.animatedValue as Float;invalidate()};start()
        }
    }
    override fun onTouchEvent(e:MotionEvent):Boolean{
        val (radius,angle)=polar(e)
        when(e.actionMasked){
            MotionEvent.ACTION_DOWN->{
                if(radius>334||angle !in 0f..90f)return false
                parent?.requestDisallowInterceptTouchEvent(true);animation?.cancel();offsets.fill(0f)
                active=which(radius);startAngle=angle;lastAngle=angle;downX=e.x;downY=e.y;lastAt=e.eventTime;velocity=0f;moved=false;held=false
                holdApp=if(active==1)hitApp(angle)else null
                if(holdApp!=null)postDelayed(hold,ViewConfiguration.getLongPressTimeout().toLong())
                return true
            }
            MotionEvent.ACTION_MOVE->{
                if(held)return true
                if(hypot(e.x-downX,e.y-downY)>slop){moved=true;removeCallbacks(hold)}
                if(moved&&active>=0){
                    val delta=(angle-lastAngle).coerceIn(-30f,30f);val dt=(e.eventTime-lastAt).coerceAtLeast(1)
                    velocity=.65f*velocity+.35f*(delta*1000f/dt)
                    if(active==1&&popup){
                        if(abs(angle-startAngle)>35){popupPage+=if(angle>startAngle)-1 else 1;startAngle=angle;invalidate()}
                    }else{
                        offsets[active]+=delta;val unit=step(active)
                        while(offsets[active]>=unit){offsets[active]-=unit;shift(active,-1)}
                        while(offsets[active]<=-unit){offsets[active]+=unit;shift(active,1)}
                        invalidate()
                    }
                }
                lastAngle=angle;lastAt=e.eventTime;return true
            }
            MotionEvent.ACTION_UP->{
                removeCallbacks(hold);parent?.requestDisallowInterceptTouchEvent(false)
                if(held){held=false;active=-1;return true}
                if(moved){if(!(active==1&&popup))settle(active);active=-1;return true}
                performClick()
                when(active){
                    0->{shift(0,((angle-45f)/step(0)).roundToInt());popup=true;popupPage=0}
                    1->hitApp(angle)?.let(launch)
                    2->{if(angle<15f)shift(2,-1)else if(angle>75f)shift(2,1)else widget(widgets[indices[2]])}
                    3->{if(abs(angle-45f)>19f)shift(3,if(angle>45f)1 else -1)else externalAction(external[indices[3]].id)}
                    else->{if(radius<=60)search()else if(popup)popup=false}
                }
                active=-1;invalidate();return true
            }
            MotionEvent.ACTION_CANCEL->{removeCallbacks(hold);parent?.requestDisallowInterceptTouchEvent(false);offsets.fill(0f);active=-1;invalidate();return true}
        }
        return true
    }
    override fun performClick():Boolean{super.performClick();return true}
    override fun onDetachedFromWindow(){removeCallbacks(hold);animation?.cancel();icons.evictAll();super.onDetachedFromWindow()}
}
