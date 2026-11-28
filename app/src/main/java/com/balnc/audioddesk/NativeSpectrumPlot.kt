package com.balnc.audioddesk

import android.app.Activity
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.view.View
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.EditText
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.app.AlertDialog
import android.text.InputType
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.ln
import kotlin.math.roundToInt

/** Native renderer for microphone FFT. The transitional WebView sends geometry,
 * palette and display state; drawing and clipping are exclusively Android Canvas. */
internal class NativeSpectrumPlot(private val activity: Activity, private val web: WebView) {
    private val root get() = activity.findViewById<FrameLayout>(android.R.id.content)
    private val plot = Plot()
    private val holder = FrameLayout(activity).apply {
        visibility = View.GONE
        clipChildren = true
        clipToPadding = true
        addView(plot, FrameLayout.LayoutParams(1, 1))
    }
    init { root.addView(holder, FrameLayout.LayoutParams(1, 1)) }
    private val splCard by lazy { AcousticCard(false) }
    private val micCard by lazy { AcousticCard(true) }
    private var fullMode = false
    fun hide() {
        holder.visibility = View.GONE
        if(fullMode) { splCard.hide(); micCard.hide() }
    }
    fun close() {
        hide(); root.removeView(holder)
        if(fullMode) { root.removeView(splCard.slot); root.removeView(micCard.slot) }
    }

    /** Native card UI; existing state and layout editor remain temporarily bridged.
     * The controls issue only fixed, local actions, never arbitrary JS. */
    fun updateFull(payload: String) {
        if(payload.length>50000)return
        val data=try { JSONObject(payload) } catch(_:Exception){ hide();return }
        fullMode=true
        holder.visibility=View.GONE
        if(!web.isShown){hide();return}
        val viewport=data.optDouble("viewport",0.0)
        if(!viewport.isFinite()||viewport<=0||web.width<=0){hide();return}
        val scale=web.width/viewport
        splCard.update(data.optJSONObject("spl"),scale)
        micCard.update(data.optJSONObject("mic"),scale)
    }
    private fun action(name:String, value:String="") {
        web.evaluateJavascript("window.audioDeskNativeAcousticAction&&window.audioDeskNativeAcousticAction("+JSONObject.quote(name)+","+JSONObject.quote(value)+")",null)
    }
    private inner class AcousticCard(private val mic:Boolean) {
        val slot=FrameLayout(activity).apply { visibility=View.GONE;clipChildren=true;clipToPadding=true }
        private val body=LinearLayout(activity).apply { orientation=LinearLayout.VERTICAL;clipChildren=true }
        private val density=activity.resources.displayMetrics.density
        private fun dp(n:Int)=(n*density).roundToInt()
        private val labelViews=mutableListOf<TextView>()
        private val controls=mutableListOf<TextView>()
        private val font=android.graphics.Typeface.create("sans-serif",0)
        private fun label(s:String,size:Float):TextView=TextView(activity).apply {
            text=s;textSize=size;typeface=font;gravity=Gravity.CENTER_VERTICAL
            maxLines=1;ellipsize=android.text.TextUtils.TruncateAt.END
            includeFontPadding=false;labelViews.add(this)
        }
        private fun button(s:String,cmd:String):TextView=label(s,11f).apply {
            gravity=Gravity.CENTER;setPadding(dp(3),0,dp(3),0)
            isClickable=true;isFocusable=true;minHeight=dp(32)
            setOnClickListener { action(cmd) }
            controls.add(this)
        }
        private fun row(vararg children:View):LinearLayout=LinearLayout(activity).apply {
            orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL
            for((i,v) in children.withIndex())addView(v,LinearLayout.LayoutParams(0,dp(32),1f).apply{if(i>0)leftMargin=dp(4)})
        }
        private val heading=label(if(mic)"Mic spectrum" else "SPL meter",14f).apply{
            typeface=android.graphics.Typeface.create("sans-serif-medium",0)
        }
        private val start=button("Start mic",if(mic)"micStart" else "splStart")
        private val status=label("Microphone off",10f)
        private val reading=label("—",30f)
        private val unit=label("dBFS",11f)
        private val max=label("Max —",11f)
        private val weight=button("A","weight")
        private val response=button("Fast","response")
        private val reset=button("Reset max","reset")
        private val calibration=button("Calibration","calibration")
        private val clearCal=button("Clear","clearCalibration")
        private val range=button("90 dB","range")
        private val peakHold=button("Peak hold","peak")
        private val clearPeak=button("Clear","clearPeak")
        private val graph=Plot()
        private val bar=android.widget.ProgressBar(activity,null,android.R.attr.progressBarStyleHorizontal).apply{max=100;progress=0}
        private var lastPalette=""
        private var calibrationValue=""
        init {
            root.addView(slot,FrameLayout.LayoutParams(1,1))
            slot.addView(body,FrameLayout.LayoutParams(1,1))
            body.setPadding(dp(10),dp(8),dp(10),dp(8))
            val header=LinearLayout(activity).apply{
                orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL
                addView(heading,LinearLayout.LayoutParams(0,dp(34),1f))
                addView(start,LinearLayout.LayoutParams(dp(86),dp(32)))
            }
            body.addView(header)
            heading.setOnLongClickListener{
                action(if(mic)"editMic" else "editSpl");true
            }
            if(mic) {
                body.addView(graph,LinearLayout.LayoutParams(-1,0,1f))
                body.addView(row(range,peakHold,clearPeak))
            } else {
                val numbers=LinearLayout(activity).apply{
                    orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL
                    addView(reading,LinearLayout.LayoutParams(-2,dp(40)))
                    addView(unit,LinearLayout.LayoutParams(0,dp(40),1f).apply{leftMargin=dp(8)})
                }
                body.addView(numbers)
                body.addView(bar,LinearLayout.LayoutParams(-1,dp(8)))
                body.addView(row(weight,response,reset))
                body.addView(max,LinearLayout.LayoutParams(-1,dp(18)))
                body.addView(row(calibration,clearCal))
                calibration.setOnClickListener {
                    val input=EditText(activity).apply{
                        inputType=InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
                        setSingleLine(true);setText(calibrationValue)
                    }
                    AlertDialog.Builder(activity).setTitle("Calibration offset (dB)")
                        .setMessage("Use a reference SPL meter. Uncalibrated readings are digital dBFS.")
                        .setView(input).setNegativeButton("Cancel",null)
                        .setPositiveButton("Apply"){_,_->
                            val n=input.text.toString().toDoubleOrNull()
                            if(n!=null&&n.isFinite()&&n in 0.0..180.0) action("calibration",n.toString())
                        }.show()
                }
            }
            body.addView(status,LinearLayout.LayoutParams(-1,dp(18)))
        }
        fun hide(){slot.visibility=View.GONE}
        private fun bg(color:Int,radius:Float,stroke:Int?=null)=GradientDrawable().apply{
            setColor(color);cornerRadius=radius
            if(stroke!=null)setStroke(dp(1).coerceAtLeast(1),stroke)
        }
        fun update(j:JSONObject?,scale:Double){
            if(j==null||!j.optBoolean("visible")){hide();return}
            val x=j.optDouble("x");val y=j.optDouble("y");val w=j.optDouble("w");val h=j.optDouble("h")
            val top=j.optDouble("top");val bottom=j.optDouble("bottom")
            if(listOf(x,y,w,h,top,bottom).any{!it.isFinite()}||w<=0||h<=0||w>3000||h>3000){hide();return}
            val fx=(x*scale).roundToInt();val fy=(y*scale).roundToInt()
            val fw=(w*scale).roundToInt();val fh=(h*scale).roundToInt()
            val left=maxOf(0,fx);val upper=maxOf(0,fy,(top*scale).roundToInt())
            val right=minOf(web.width,fx+fw);val lower=minOf(web.height,fy+fh,(bottom*scale).roundToInt())
            if(right<=left||lower<=upper){hide();return}
            val wp=IntArray(2);val rp=IntArray(2);web.getLocationInWindow(wp);root.getLocationInWindow(rp)
            fun place(v:View,p:FrameLayout.LayoutParams){
                val old=v.layoutParams as? FrameLayout.LayoutParams
                if(old==null||old.width!=p.width||old.height!=p.height||old.leftMargin!=p.leftMargin||old.topMargin!=p.topMargin)v.layoutParams=p
            }
            place(slot,FrameLayout.LayoutParams(right-left,lower-upper).apply{leftMargin=wp[0]-rp[0]+left;topMargin=wp[1]-rp[1]+upper})
            place(body,FrameLayout.LayoutParams(fw,fh).apply{leftMargin=fx-left;topMargin=fy-upper})
            val palette=listOf("panel","panel2","ink","accent","muted","line","radius","theme").joinToString("|"){j.optString(it)}
            val accent=parseColor(j.optString("accent"),Color.LTGRAY)
            val muted=parseColor(j.optString("muted"),accent)
            if(palette!=lastPalette){
                lastPalette=palette
                val panel=parseColor(j.optString("panel"),Color.DKGRAY)
                val panel2=parseColor(j.optString("panel2"),panel)
                val ink=parseColor(j.optString("ink"),Color.WHITE)
                val line=parseColor(j.optString("line"),muted)
                val radius=(j.optDouble("radius",14.0).coerceIn(0.0,32.0)*scale).toFloat()
                body.background=bg(panel,radius,line)
                body.clipToOutline=true
                for(v in labelViews)v.setTextColor(ink)
                for(v in controls){v.background=bg(panel2,minOf(radius,dp(8).toFloat()),line)}
                status.setTextColor(muted);unit.setTextColor(muted);max.setTextColor(muted)
                reading.setTextColor(accent)
                bar.progressTintList=android.content.res.ColorStateList.valueOf(accent)
                bar.progressBackgroundTintList=android.content.res.ColorStateList.valueOf(panel2)
            }
            fun set(v:TextView,s:String){if(v.text.toString()!=s)v.text=s}
            set(start,j.optString("start","Start mic"));set(status,j.optString("status","Microphone off"))
            if(mic){
                set(range,j.optInt("range",90).toString()+" dB")
                val held=j.optBoolean("held");peakHold.isSelected=held
                set(peakHold,if(held)"Peak on" else "Peak hold")
                graph.scale=scale.toFloat();graph.span=j.optInt("range",90).takeIf{it in listOf(60,90,120)}?:90
                graph.accent=accent;graph.muted=muted
                graph.bands=values(j.optJSONArray("bands"));graph.peak=if(held)values(j.optJSONArray("peak")) else FloatArray(0)
                graph.invalidate()
            }else{
                set(reading,j.optString("reading","—"));set(unit,j.optString("unit","dBFS"));set(max,j.optString("max","Max —"))
                set(weight,j.optString("weight","A"));set(response,j.optString("response","fast").replaceFirstChar{it.uppercase()})
                calibrationValue=j.optString("offset");set(calibration,if(calibrationValue.isEmpty())"Calibration" else "Offset "+calibrationValue)
                bar.progress=j.optInt("progress",0).coerceIn(0,100)
            }
            slot.visibility=View.VISIBLE
        }
    }

    fun update(payload: String) {
        if(fullMode)return
        if (payload.length > 40000) return
        val j = try { JSONObject(payload) } catch (_: Exception) { hide(); return }
        if (!j.optBoolean("visible") || !web.isShown) { hide(); return }
        val viewport = j.optDouble("viewport")
        val x = j.optDouble("x"); val y = j.optDouble("y")
        val w = j.optDouble("w"); val h = j.optDouble("h")
        val top = j.optDouble("top"); val bottom = j.optDouble("bottom")
        if (listOf(viewport,x,y,w,h,top,bottom).any { !it.isFinite() } ||
            viewport <= 0 || w <= 0 || h <= 0 || w > 3000 || h > 3000 || web.width <= 0) { hide(); return }
        val scale = web.width / viewport
        val fx = (x * scale).roundToInt(); val fy = (y * scale).roundToInt()
        val fw = (w * scale).roundToInt(); val fh = (h * scale).roundToInt()
        val left = maxOf(0, fx); val upper = maxOf(0, fy, (top * scale).roundToInt())
        val right = minOf(web.width, fx + fw); val lower = minOf(web.height, fy + fh, (bottom * scale).roundToInt())
        if (right <= left || lower <= upper) { hide(); return }
        val webPos = IntArray(2); val rootPos = IntArray(2)
        web.getLocationInWindow(webPos); root.getLocationInWindow(rootPos)
        val lp = FrameLayout.LayoutParams(right-left, lower-upper).apply {
            leftMargin = webPos[0]-rootPos[0]+left
            topMargin = webPos[1]-rootPos[1]+upper
        }
        val inner = FrameLayout.LayoutParams(fw,fh).apply { leftMargin=fx-left; topMargin=fy-upper }
        fun place(view: View, params: FrameLayout.LayoutParams) {
            val old = view.layoutParams as? FrameLayout.LayoutParams
            if (old == null || old.width != params.width || old.height != params.height ||
                old.leftMargin != params.leftMargin || old.topMargin != params.topMargin) view.layoutParams=params
        }
        place(holder,lp); place(plot,inner)
        plot.scale = scale.toFloat()
        plot.span = j.optInt("range",90).takeIf { it in listOf(60,90,120) } ?: 90
        plot.accent = parseColor(j.optString("accent"),Color.LTGRAY)
        plot.muted = parseColor(j.optString("muted"),plot.accent)
        plot.bands = values(j.optJSONArray("bands"))
        plot.peak = if(j.optBoolean("held")) values(j.optJSONArray("peak")) else FloatArray(0)
        holder.visibility=View.VISIBLE
        plot.invalidate()
    }
    private fun values(a: JSONArray?): FloatArray {
        if(a==null)return FloatArray(0)
        return FloatArray(minOf(a.length(),1024)) { i ->
            a.optDouble(i,-140.0).takeIf { it.isFinite() }?.coerceIn(-180.0,0.0)?.toFloat() ?: -140f
        }
    }
    private fun parseColor(s: String, fallback: Int): Int = try { Color.parseColor(s) } catch (_: Exception) { fallback }
    private inner class Plot: View(activity) {
        var scale=1f
        var span=90
        var accent=Color.LTGRAY
        var muted=Color.GRAY
        var bands=FloatArray(0)
        var peak=FloatArray(0)
        private val paint=Paint(Paint.ANTI_ALIAS_FLAG)
        private val path=Path()
        init { importantForAccessibility=IMPORTANT_FOR_ACCESSIBILITY_NO; isClickable=false; isFocusable=false }
        override fun onDraw(c: Canvas) {
            super.onDraw(c)
            if(width<10||height<10)return
            val left=29*scale;val right=width-5*scale;val top=6*scale;val bottom=height-18*scale
            if(right<=left||bottom<=top)return
            fun y(db:Float)=top+(-db/span).coerceIn(0f,1f)*(bottom-top)
            fun x(hz:Double)=left+(ln(hz/20.0)/ln(1000.0)).toFloat()*(right-left)
            paint.strokeWidth=scale.coerceAtLeast(1f);paint.textSize=10*scale;paint.color=muted
            for(db in 0 downTo -span step 30){
                paint.alpha=43;c.drawLine(left,y(db.toFloat()),right,y(db.toFloat()),paint)
                paint.alpha=204;paint.textAlign=Paint.Align.RIGHT
                c.drawText(db.toString(),left-3*scale,y(db.toFloat())-(paint.ascent()+paint.descent())/2,paint)
            }
            for((hz,label) in listOf(20.0 to "20",100.0 to "100",1000.0 to "1k",10000.0 to "10k",20000.0 to "20k")){
                paint.alpha=43;c.drawLine(x(hz),top,x(hz),bottom,paint)
                paint.alpha=204;paint.textAlign=when(hz){20.0->Paint.Align.LEFT;20000.0->Paint.Align.RIGHT;else->Paint.Align.CENTER}
                c.drawText(label,x(hz),height-6*scale-(paint.ascent()+paint.descent())/2,paint)
            }
            fun trace(a:FloatArray,fill:Boolean,alpha:Int){
                if(a.size<2)return
                path.reset()
                for(i in a.indices){val px=left+i.toFloat()/(a.size-1)*(right-left);if(i==0)path.moveTo(px,y(a[i]))else path.lineTo(px,y(a[i]))}
                paint.color=accent
                if(fill){path.lineTo(right,bottom);path.lineTo(left,bottom);path.close();paint.style=Paint.Style.FILL;paint.alpha=33;c.drawPath(path,paint);trace(a,false,alpha)}
                else{paint.style=Paint.Style.STROKE;paint.alpha=alpha;c.drawPath(path,paint);paint.style=Paint.Style.FILL}
            }
            trace(bands,true,242);trace(peak,false,115);paint.alpha=255
        }
    }
}
