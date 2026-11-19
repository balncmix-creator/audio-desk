package com.balnc.audioddesk

import android.app.Activity
import android.app.AlertDialog
import android.appwidget.AppWidgetHost
import android.appwidget.AppWidgetHostView
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProviderInfo
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.roundToInt

/** Real RemoteViews, positioned over matching DOM layout slots. The root
 * receives no full-screen touch interceptor: only actual widgets own touches. */
internal class NativeWidgetPanel(private val activity: Activity, private val web: WebView) {
    companion object { const val BIND = 6220; const val CONFIGURE = 6221 }
    private val manager = AppWidgetManager.getInstance(activity)
    private val host = AppWidgetHost(activity, 7331)
    private val prefs = activity.getSharedPreferences("audio_desk_native_widgets", Context.MODE_PRIVATE)
    private val root get() = activity.findViewById<FrameLayout>(android.R.id.content)
    private var picker: AlertDialog? = null
    private var pending = prefs.getInt("pending", -1)
    private val ids = mutableListOf<Int>()
    private val views = mutableMapOf<Int, Slot>()
    private var foreground = false
    private var listening = false
    private var homeVisible = false
    init {
        try {
            val arr = JSONArray(prefs.getString("ids","[]") ?: "[]")
            for (i in 0 until arr.length()) {
                val id = arr.getInt(i)
                if (id > 0 && id !in ids) ids.add(id)
            }
        } catch (_: Exception) {}
    }
    private fun save() { prefs.edit().putString("ids",JSONArray(ids).toString()).putInt("pending",pending).apply() }
    private val density get() = activity.resources.displayMetrics.density
    private fun dp(px: Int) = (px/density).roundToInt()
    private fun js(script: String) { web.evaluateJavascript(script,null) }
    fun publish() {
        val result = JSONArray()
        for (id in ids.toList()) {
            val info = manager.getAppWidgetInfo(id)
            if (info == null) {
                ids.remove(id); removeView(id)
                try {host.deleteAppWidgetId(id)}catch(_:Exception){}
                save();continue
            }
            val minW = if ((info.resizeMode and AppWidgetProviderInfo.RESIZE_HORIZONTAL) != 0 && info.minResizeWidth > 0) info.minResizeWidth else info.minWidth
            val minH = if ((info.resizeMode and AppWidgetProviderInfo.RESIZE_VERTICAL) != 0 && info.minResizeHeight > 0) info.minResizeHeight else info.minHeight
            result.put(JSONObject().put("id",id).put("label",info.loadLabel(activity.packageManager))
                .put("width",dp(info.minWidth).coerceAtLeast(100)).put("height",dp(info.minHeight).coerceAtLeast(70))
                .put("minWidth",dp(minW).coerceAtLeast(72)).put("minHeight",dp(minH).coerceAtLeast(56))
                .put("horizontal",(info.resizeMode and AppWidgetProviderInfo.RESIZE_HORIZONTAL) != 0)
                .put("vertical",(info.resizeMode and AppWidgetProviderInfo.RESIZE_VERTICAL) != 0))
        }
        js("window.receiveAudioDeskNativeWidgets&&window.receiveAudioDeskNativeWidgets("+result.toString()+")")
    }
    fun open() {
        if (picker?.isShowing == true || pending > 0) return
        val providers = manager.installedProviders.filter {
            (it.widgetCategory and AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN) != 0
        }.sortedBy { it.loadLabel(activity.packageManager).lowercase() }
        if (providers.isEmpty()) {
            Toast.makeText(activity,"No app widgets available",Toast.LENGTH_SHORT).show();return
        }
        hide()
        picker = AlertDialog.Builder(activity).setTitle("Add widget to Home")
            .setItems(providers.map { it.loadLabel(activity.packageManager) }.toTypedArray()) { _, which -> bind(providers[which]) }
            .setNegativeButton("Cancel",null).create().apply {
                setOnDismissListener { picker = null; js("window.audioDeskSyncNativeWidgets&&window.audioDeskSyncNativeWidgets()") }
                show()
            }
    }
    private fun bind(info: AppWidgetProviderInfo) {
        pending = host.allocateAppWidgetId();save()
        val options = Bundle().apply {
            putInt(AppWidgetManager.OPTION_APPWIDGET_HOST_CATEGORY,AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN)
        }
        try {
            if (manager.bindAppWidgetIdIfAllowed(pending,info.provider,options)) configure()
            else activity.startActivityForResult(Intent(AppWidgetManager.ACTION_APPWIDGET_BIND)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,pending)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_PROVIDER,info.provider)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_OPTIONS,options),BIND)
        } catch (_: Exception) {cancel()}
    }
    private fun configure() {
        val info = manager.getAppWidgetInfo(pending)
        if(info == null){cancel();return}
        if(info.configure != null){
            try {host.startAppWidgetConfigureActivityForResult(activity,pending,0,CONFIGURE,null)}
            catch(_:Exception){cancel()}
        }else finish()
    }
    private fun cancel(){
        if(pending>0)try{host.deleteAppWidgetId(pending)}catch(_:Exception){}
        pending=-1;save();publish()
    }
    private fun finish(){
        if(pending>0 && pending !in ids)ids.add(pending)
        pending=-1;save();publish()
    }
    fun result(request:Int,result:Int):Boolean {
        if(request!=BIND&&request!=CONFIGURE)return false
        if(result!=Activity.RESULT_OK){cancel();return true}
        if(request==BIND)configure()else finish()
        return true
    }
    fun delete(id:Int) {
        if(!ids.remove(id))return
        removeView(id)
        try {host.deleteAppWidgetId(id)}catch(_:Exception){}
        save();publish()
    }
    private fun removeView(id:Int) { views.remove(id)?.let {root.removeView(it)} }
    private fun updateListening() {
        val wanted=foreground&&homeVisible&&ids.isNotEmpty()
        if(wanted==listening)return
        try {
            if(wanted)host.startListening()else host.stopListening()
            listening=wanted
        }catch(_:Exception){listening=false}
    }
    private fun hide() {
        for(slot in views.values){slot.cancelHold();slot.visibility=View.GONE}
    }
    fun resume(){foreground=true;publish();js("window.audioDeskSyncNativeWidgets&&window.audioDeskSyncNativeWidgets()")}
    fun pause(){foreground=false;homeVisible=false;hide();updateListening()}
    fun close(){picker?.dismiss();pause();for(id in views.keys.toList())removeView(id)}
    private inner class Slot(context:Context,val id:Int,val widget:AppWidgetHostView): FrameLayout(context) {
        private val slop=ViewConfiguration.get(context).scaledTouchSlop
        private var startX=0f;private var startY=0f
        private var tracking=false;private var consumed=false
        private var lastWidth=0;private var lastHeight=0
        private val hold=Runnable {
            if(!tracking)return@Runnable
            consumed=true;tracking=false
            val now=android.os.SystemClock.uptimeMillis()
            val cancel=MotionEvent.obtain(now,now,MotionEvent.ACTION_CANCEL,0f,0f,0)
            cancelChild(cancel);cancel.recycle()
            js("window.audioDeskBeginWidgetResize&&window.audioDeskBeginWidgetResize('nativeWidget_"+id+"')")
        }
        init {clipChildren=true;clipToPadding=true;addView(widget,LayoutParams(1,1))}
        private fun cancelChild(event:MotionEvent) { super.dispatchTouchEvent(event) }
        fun cancelHold(){removeCallbacks(hold);tracking=false}
        override fun dispatchTouchEvent(ev:MotionEvent):Boolean{
            when(ev.actionMasked){
                MotionEvent.ACTION_DOWN->{consumed=false;tracking=true;startX=ev.x;startY=ev.y;postDelayed(hold,550)}
                MotionEvent.ACTION_MOVE->{if(abs(ev.x-startX)>slop||abs(ev.y-startY)>slop)cancelHold()}
                MotionEvent.ACTION_UP,MotionEvent.ACTION_CANCEL,MotionEvent.ACTION_POINTER_DOWN->cancelHold()
            }
            if(consumed)return true
            return super.dispatchTouchEvent(ev) || tracking
        }
        fun place(x:Int,y:Int,w:Int,h:Int,fullW:Int,fullH:Int,dx:Int,dy:Int){
            val outer=(layoutParams as? LayoutParams)
            if(outer==null||outer.leftMargin!=x||outer.topMargin!=y||outer.width!=w||outer.height!=h){
                layoutParams=LayoutParams(w,h).apply{leftMargin=x;topMargin=y}
            }
            val inner=widget.layoutParams as LayoutParams
            if(inner.width!=fullW||inner.height!=fullH||inner.leftMargin!=dx||inner.topMargin!=dy)
                widget.layoutParams=LayoutParams(fullW,fullH).apply{leftMargin=dx;topMargin=dy}
            if(lastWidth!=fullW||lastHeight!=fullH){
                lastWidth=fullW;lastHeight=fullH
                try{widget.updateAppWidgetSize(null,dp(fullW),dp(fullH),dp(fullW),dp(fullH))}catch(_:Exception){}
            }
            visibility=View.VISIBLE
        }
    }
    /** Coordinates are CSS viewport pixels, not screen dp. Clip to both the
     * safe viewport and the native WebView, preserving the full widget size. */
    fun layout(payload:String){
        if(payload.length>60000)return
        val data=try{JSONObject(payload)}catch(_:Exception){return}
        homeVisible=data.optBoolean("home")&&foreground
        updateListening()
        if(!homeVisible||picker?.isShowing==true||pending>0){hide();return}
        val viewport=data.optDouble("width",0.0)
        if(viewport<=0||web.width<=0){hide();return}
        val scale=web.width/viewport
        val webPos=IntArray(2);val rootPos=IntArray(2)
        web.getLocationInWindow(webPos);root.getLocationInWindow(rootPos)
        val ox=webPos[0]-rootPos[0];val oy=webPos[1]-rootPos[1]
        val shown=mutableSetOf<Int>()
        val slots=data.optJSONArray("slots")?:JSONArray()
        for(i in 0 until minOf(slots.length(),64)){
            val item=slots.optJSONObject(i)?:continue
            val id=item.optInt("id",-1)
            if(id !in ids)continue
            val l=item.optDouble("x");val t=item.optDouble("y")
            val w=item.optDouble("w");val h=item.optDouble("h")
            val cl=item.optDouble("left");val ct=item.optDouble("top")
            val cr=item.optDouble("right");val cb=item.optDouble("bottom")
            if(listOf(l,t,w,h,cl,ct,cr,cb).any{!it.isFinite()}||w<=0||h<=0||w>3000||h>3000)continue
            val fx=(l*scale).roundToInt();val fy=(t*scale).roundToInt()
            val fw=(w*scale).roundToInt();val fh=(h*scale).roundToInt()
            val x=maxOf(0,fx,(cl*scale).roundToInt())
            val y=maxOf(0,fy,(ct*scale).roundToInt())
            val right=minOf(web.width,fx+fw,(cr*scale).roundToInt())
            val bottom=minOf(web.height,fy+fh,(cb*scale).roundToInt())
            if(right<=x||bottom<=y)continue
            try{
                val info=manager.getAppWidgetInfo(id)?:continue
                val slot=views[id]?:run {
                    Slot(activity,id,host.createView(activity,id,info)).also {
                        it.visibility=View.GONE;root.addView(it,FrameLayout.LayoutParams(1,1));views[id]=it
                    }
                }
                slot.place(ox+x,oy+y,right-x,bottom-y,fw,fh,fx-x,fy-y)
                shown.add(id)
            }catch(_:Exception){}
        }
        for((id,slot)in views)if(id !in shown){slot.cancelHold();slot.visibility=View.GONE}
    }
}
