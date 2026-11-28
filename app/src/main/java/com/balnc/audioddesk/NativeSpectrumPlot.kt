package com.balnc.audioddesk

import android.app.Activity
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.view.View
import android.webkit.WebView
import android.widget.FrameLayout
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
    fun hide() { holder.visibility = View.GONE }
    fun close() { hide(); root.removeView(holder) }
    fun update(payload: String) {
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
