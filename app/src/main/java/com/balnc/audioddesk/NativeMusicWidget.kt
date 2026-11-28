package com.balnc.audioddesk

import android.app.Activity
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.content.res.ColorStateList
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import org.json.JSONObject
import kotlin.math.ln
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.pow

/** Native music card. Media actions use Android MediaSession directly.
 * The transitional launcher supplies bounds, theme tokens and real FFT display state. */
internal class NativeMusicWidget(
    private val activity: Activity, private val web: WebView,
    private val transport: (String)->Unit, private val seek: (Long)->Unit,
    private val access: ()->Unit
) {
    private val root get()=activity.findViewById<FrameLayout>(android.R.id.content)
    private val density=activity.resources.displayMetrics.density
    private fun dp(n:Int)=(n*density).roundToInt()
    private val slot=FrameLayout(activity).apply { visibility=View.GONE;clipChildren=true }
    private val body=LinearLayout(activity).apply { orientation=LinearLayout.VERTICAL;clipChildren=true }
    private val labels=mutableListOf<TextView>()
    private val buttons=mutableListOf<TextView>()
    private fun label(value:String,size:Float)=TextView(activity).apply {
        text=value;textSize=size;includeFontPadding=false;maxLines=1
        ellipsize=TextUtils.TruncateAt.END;gravity=Gravity.CENTER_VERTICAL;labels.add(this)
    }
    private fun button(value:String,desc:String,action:()->Unit)=label(value,15f).apply{
        contentDescription=desc;gravity=Gravity.CENTER;isClickable=true;isFocusable=true
        setOnClickListener{action()};buttons.add(this)
    }
    private fun localAction(name:String) {
        web.evaluateJavascript("window.audioDeskNativeMusicAction&&window.audioDeskNativeMusicAction("+JSONObject.quote(name)+")",null)
    }
    private val title=label("Music controls",14f).apply{typeface=Typeface.create("sans-serif-medium",0)}
    private val artist=label("Connect a compatible player",11f)
    private val previous=button("‹‹","Previous track"){transport("previous")}
    private val play=button("▶","Play or pause"){transport("toggle")}
    private val next=button("››","Next track"){transport("next")}
    private val connect=button("Connect","Enable Android media controls",access).apply{textSize=11f}
    private val enable=button("Enable FFT","Enable real audio spectrum"){localAction("enable")}.apply{textSize=11f}
    private val projection=button("Capture","Capture permitted playback"){localAction("projection")}.apply{textSize=11f}
    private val settings=button("⚙","Music visualizer settings"){localAction("settings")}
    private val status=label("Off · no audio is captured",10f)
    private val time=label("",10f).apply{gravity=Gravity.CENTER_VERTICAL or Gravity.END}
    private val seekBar=SeekBar(activity).apply{
        max=1000;contentDescription="Playback position";splitTrack=false
        setPadding(dp(4),0,dp(4),0)
    }
    private val graph=Spectrum()
    private val meta=LinearLayout(activity).apply{orientation=LinearLayout.VERTICAL;gravity=Gravity.CENTER_VERTICAL;addView(title,LinearLayout.LayoutParams(-1,dp(20)));addView(artist,LinearLayout.LayoutParams(-1,dp(15)))}
    private val transportRow=LinearLayout(activity).apply{
        orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL
        for(v in listOf(previous,play,next,connect))addView(v,LinearLayout.LayoutParams(0,-1,1f))
    }
    private val actions=LinearLayout(activity).apply{
        orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL
        for(v in listOf(enable,projection,settings))addView(v,LinearLayout.LayoutParams(0,-1,1f))
    }
    private val seekRow=LinearLayout(activity).apply{
        orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL
        addView(seekBar,LinearLayout.LayoutParams(0,-1,1f));addView(time,LinearLayout.LayoutParams(dp(76),-1))
    }
    private var duration=0L
    private var seeking=false
    private var mode=""
    private var palette=""
    private var state=JSONObject()
    init {
        root.addView(slot,FrameLayout.LayoutParams(1,1));slot.addView(body,FrameLayout.LayoutParams(1,1))
        title.setOnLongClickListener {localAction("edit");true}
        artist.setOnLongClickListener {localAction("edit");true}
        play.setOnLongClickListener{localAction("edit");true}
        seekBar.setOnSeekBarChangeListener(object:SeekBar.OnSeekBarChangeListener{
            override fun onStartTrackingTouch(v:SeekBar){seeking=true}
            override fun onProgressChanged(v:SeekBar,p:Int,fromUser:Boolean){if(fromUser)time.text=format(duration*p/1000L)+" / "+format(duration)}
            override fun onStopTrackingTouch(v:SeekBar){seeking=false;if(duration>0&&v.isEnabled)seek(duration*v.progress/1000L)}
        })
        mediaState(JSONObject())
    }
    private fun format(ms:Long):String{val s=ms.coerceAtLeast(0)/1000;return "${s/60}:${(s%60).toString().padStart(2,'0')}"}
    private fun set(v:TextView,s:String){if(v.text.toString()!=s)v.text=s}
    fun mediaState(j:JSONObject){
        state=j
        val enabled=j.optBoolean("enabled");val available=j.optBoolean("available");val playing=j.optBoolean("playing")
        set(title,if(available)j.optString("title").ifBlank{"Music controls"}else "Music controls")
        set(artist,if(available)j.optString("artist").ifBlank{j.optString("app")}else if(enabled)"No active player" else "Connect a compatible player")
        set(play,if(playing)"Ⅱ" else "▶");play.contentDescription=if(playing)"Pause" else "Play"
        previous.isEnabled=available&&j.optBoolean("canPrevious");next.isEnabled=available&&j.optBoolean("canNext");play.isEnabled=available&&j.optBoolean("canToggle")
        for(v in listOf(previous,play,next))v.alpha=if(v.isEnabled)1f else .38f
        connect.visibility=if(enabled)View.GONE else View.VISIBLE
        duration=j.optLong("durationMs",0).coerceAtLeast(0)
        val pos=j.optLong("positionMs",-1)
        seekRow.visibility=if(mode=="full"&&duration>0&&pos>=0)View.VISIBLE else View.GONE
        seekBar.isEnabled=j.optBoolean("canSeek")&&duration>0
        if(!seeking){seekBar.progress=if(duration>0&&pos>=0)(pos.toDouble()/duration*1000).roundToInt().coerceIn(0,1000)else 0;set(time,format(pos)+" / "+format(duration))}
    }
    private fun layoutFor(nextMode:String){
        if(nextMode==mode)return
        mode=nextMode
        body.removeAllViews()
        val full=mode=="full"
        body.orientation=if(mode=="horizontal")LinearLayout.HORIZONTAL else LinearLayout.VERTICAL
        val pad=if(full)8 else 4;body.setPadding(dp(pad),dp(pad),dp(pad),dp(pad))
        fun add(v:View,h:Int){body.addView(v,LinearLayout.LayoutParams(-1,dp(h)))}
        when(mode){
            "full"->{add(meta,35);body.addView(graph,LinearLayout.LayoutParams(-1,0,1f));add(actions,28);add(status,15);add(seekRow,22);add(transportRow,34)}
            "horizontal"->{body.addView(meta,LinearLayout.LayoutParams(0,-1,1f));body.addView(transportRow,LinearLayout.LayoutParams(0,-1,1f))}
            "compact","vertical"->{body.addView(meta,LinearLayout.LayoutParams(-1,0,1f));add(transportRow,32)}
            "transport","mini"->{body.addView(transportRow,LinearLayout.LayoutParams(-1,0,1f))}
            else->{add(meta,35);add(transportRow,32)}
        }
        artist.visibility=if(mode=="vertical")View.GONE else View.VISIBLE
        mediaState(state)
    }
    fun hide(){slot.visibility=View.GONE}
    fun close(){hide();root.removeView(slot)}
    private fun color(j:JSONObject,k:String,fallback:Int)=try{Color.parseColor(j.optString(k))}catch(_:Exception){fallback}
    fun update(payload:String){
        if(payload.length>30000)return
        val j=try{JSONObject(payload)}catch(_:Exception){hide();return}
        if(!j.optBoolean("visible")||!web.isShown){hide();return}
        val viewport=j.optDouble("viewport");val x=j.optDouble("x");val y=j.optDouble("y")
        val w=j.optDouble("w");val h=j.optDouble("h");val top=j.optDouble("top");val bottom=j.optDouble("bottom")
        if(listOf(viewport,x,y,w,h,top,bottom).any{!it.isFinite()}||viewport<=0||web.width<=0||w<=0||h<=0||w>3000||h>3000){hide();return}
        val scale=web.width/viewport
        val fx=(x*scale).roundToInt();val fy=(y*scale).roundToInt();val fw=(w*scale).roundToInt();val fh=(h*scale).roundToInt()
        val left=maxOf(0,fx);val upper=maxOf(0,fy,(top*scale).roundToInt())
        val right=minOf(web.width,fx+fw);val lower=minOf(web.height,fy+fh,(bottom*scale).roundToInt())
        if(right<=left||lower<=upper){hide();return}
        val wp=IntArray(2);val rp=IntArray(2);web.getLocationInWindow(wp);root.getLocationInWindow(rp)
        fun place(v:View,p:FrameLayout.LayoutParams){val old=v.layoutParams as? FrameLayout.LayoutParams;if(old==null||old.width!=p.width||old.height!=p.height||old.leftMargin!=p.leftMargin||old.topMargin!=p.topMargin)v.layoutParams=p}
        place(slot,FrameLayout.LayoutParams(right-left,lower-upper).apply{leftMargin=wp[0]-rp[0]+left;topMargin=wp[1]-rp[1]+upper})
        place(body,FrameLayout.LayoutParams(fw,fh).apply{leftMargin=fx-left;topMargin=fy-upper})
        layoutFor(j.optString("layout","full"))
        val key=listOf("panel","ink","muted","accent","control","radius").joinToString("|"){j.optString(it)}
        val ink=color(j,"ink",Color.WHITE);val accent=color(j,"accent",ink);val muted=color(j,"muted",ink)
        if(key!=palette){
            palette=key
            val radius=(j.optDouble("radius",14.0).coerceIn(0.0,40.0)*scale).toFloat()
            fun bg(c:Int,r:Float)=GradientDrawable().apply{setColor(c);cornerRadius=r}
            body.background=bg(color(j,"panel",Color.DKGRAY),radius);body.clipToOutline=true
            for(v in labels)v.setTextColor(ink)
            artist.setTextColor(muted);status.setTextColor(muted);time.setTextColor(muted)
            for(v in buttons)v.background=bg(color(j,"control",Color.TRANSPARENT),dp(8).toFloat())
            seekBar.progressTintList=ColorStateList.valueOf(accent);seekBar.thumbTintList=ColorStateList.valueOf(accent)
        }
        enable.visibility=if(j.optBoolean("enable"))View.VISIBLE else View.GONE
        projection.visibility=if(j.optBoolean("projection"))View.VISIBLE else View.GONE
        set(status,j.optString("status"))
        graph.update(j,accent)
        slot.visibility=View.VISIBLE
    }
    private inner class Spectrum:View(activity){
        private val paint=Paint(Paint.ANTI_ALIAS_FLAG);private val path=Path()
        private var ink=Color.WHITE;private var wave=false;private var active=false;private var amplitude=.9f
        private var points=FloatArray(0);private var trails=emptyList<FloatArray>()
        private fun array(a:org.json.JSONArray?)=FloatArray(minOf(a?.length()?:0,64)){i->a!!.optDouble(i,0.0).takeIf{it.isFinite()}?.coerceIn(0.0,1.0)?.toFloat()?:0f}
        fun update(j:JSONObject,accent:Int){
            ink=accent;wave=j.optString("spectrumMode")=="wave";active=j.optBoolean("active")
            amplitude=(j.optDouble("height",95.0)/100).toFloat().coerceIn(.4f,1f)
            points=array(j.optJSONArray("points"))
            val h=j.optJSONArray("history");trails=(0 until minOf(h?.length()?:0,j.optInt("trails",6).coerceIn(1,7)-1)).map{array(h?.optJSONArray(it))}
            invalidate()
        }
        override fun onDraw(c:Canvas){
            super.onDraw(c);if(width<10||height<10)return
            val w=width.toFloat();val h=height.toFloat();val bottom=h-dp(12)
            paint.color=ink;paint.strokeWidth=density.coerceAtLeast(1f);paint.style=Paint.Style.FILL
            if(wave){
                paint.alpha=40;c.drawLine(0f,h/2,w,h/2,paint)
                if(!active)return
                val layers=listOf(points)+trails
                for(i in layers.indices.reversed()){
                    val a=layers[i];if(a.size<2)continue;path.reset()
                    for(k in a.indices){val x=w*k/(a.size-1);val edge=sin(Math.PI*k/(a.size-1)).coerceAtLeast(0.0).pow(.58).toFloat();val y=h/2+(if(i%2==0)1 else -1)*a[k]*edge*h*.425f*amplitude;if(k==0)path.moveTo(x,y)else path.lineTo(x,y)}
                    paint.style=Paint.Style.STROKE;paint.alpha=if(i==0)240 else (150-i*18).coerceAtLeast(25);c.drawPath(path,paint)
                }
                paint.style=Paint.Style.FILL;return
            }
            paint.alpha=65;c.drawLine(0f,bottom,w,bottom,paint);paint.textSize=dp(9).toFloat();paint.textAlign=Paint.Align.CENTER
            for((f,s)in listOf(100.0 to "100",1000.0 to "1k",10000.0 to "10k")){
                val x=((ln(f)-ln(42.0))/(ln(10500.0)-ln(42.0))*w).toFloat().coerceIn(dp(12).toFloat(),(w-dp(12)).coerceAtLeast(dp(12).toFloat()))
                paint.alpha=30;c.drawLine(x,0f,x,bottom,paint);paint.alpha=180;c.drawText(s,x,h-2,paint)
            }
            if(!active||points.size<2||bottom<=0)return
            fun trace(){path.reset();for(i in points.indices){val x=w*i/(points.size-1);val y=bottom-points[i]*bottom*amplitude*.95f;if(i==0)path.moveTo(x,y)else path.lineTo(x,y)}}
            trace();path.lineTo(w,bottom);path.lineTo(0f,bottom);path.close();paint.alpha=43;c.drawPath(path,paint)
            trace();paint.style=Paint.Style.STROKE;paint.alpha=235;paint.strokeWidth=1.4f*density;c.drawPath(path,paint);paint.style=Paint.Style.FILL
        }
    }
}
