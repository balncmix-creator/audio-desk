package com.balnc.audioddesk

import android.app.Activity
import android.app.AlertDialog
import android.appwidget.AppWidgetHost
import android.appwidget.AppWidgetHostView
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProviderInfo
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.roundToInt

/** Real RemoteViews host. Widget positions and sizes are kept per theme.
 * Native view hierarchy owns touch routing, not an embedded browser. */
internal class NativeWidgetHost(private val activity:Activity,private val changed:()->Unit){
    companion object {const val BIND=7201;const val CONFIGURE=7202}
    private val manager=AppWidgetManager.getInstance(activity)
    private val host=AppWidgetHost(activity,7331)
    private val prefs=activity.getSharedPreferences("native_widget_host",Context.MODE_PRIVATE)
    private var pending=prefs.getInt("pending",-1)
    private var ids=loadIds()
    private var picker:AlertDialog?=null
    private var listening=false
    private var foreground=false
    private var attached=false
    private var closed=false
    private var theme="Minimal"
    private var parent:LinearLayout?=null
    private var fg=Color.WHITE
    private var accent=Color.WHITE
    private var surface=Color.DKGRAY
    private data class Size(val width:Int,val height:Int)
    private fun dp(n:Int)=(n*activity.resources.displayMetrics.density).roundToInt()
    private fun pxToDp(n:Int)=(n/activity.resources.displayMetrics.density).roundToInt()
    private fun loadIds():MutableList<Int> = try{
        val a=JSONArray(prefs.getString("ids","[]"))
        (0 until a.length()).map{a.optInt(it,-1)}.filter{it>0}.distinct().toMutableList()
    }catch(_:Exception){mutableListOf()}
    private fun save(){
        prefs.edit().putString("ids",JSONArray(ids).toString()).putInt("pending",pending).apply()
    }
    private fun availableWidth()=(activity.resources.displayMetrics.widthPixels/activity.resources.displayMetrics.density).toInt()-24
    private fun limits(info:AppWidgetProviderInfo):Size{
        val horizontal=(info.resizeMode and AppWidgetProviderInfo.RESIZE_HORIZONTAL)!=0
        val vertical=(info.resizeMode and AppWidgetProviderInfo.RESIZE_VERTICAL)!=0
        return Size(pxToDp(if(horizontal&&info.minResizeWidth>0)info.minResizeWidth else info.minWidth).coerceAtLeast(72),
            pxToDp(if(vertical&&info.minResizeHeight>0)info.minResizeHeight else info.minHeight).coerceAtLeast(56))
    }
    private fun size(id:Int,info:AppWidgetProviderInfo):Size{
        val min=limits(info);val maxWidth=availableWidth().coerceAtLeast(72)
        val horizontal=(info.resizeMode and AppWidgetProviderInfo.RESIZE_HORIZONTAL)!=0
        val vertical=(info.resizeMode and AppWidgetProviderInfo.RESIZE_VERTICAL)!=0
        val defaultWidth=pxToDp(info.minWidth).coerceIn(min.width.coerceAtMost(maxWidth),maxWidth)
        val defaultHeight=pxToDp(info.minHeight).coerceIn(min.height.coerceAtMost(800),800)
        val width=if(horizontal)prefs.getInt("w:$theme:$id",defaultWidth)else defaultWidth
        val height=if(vertical)prefs.getInt("h:$theme:$id",defaultHeight)else defaultHeight
        return Size(width.coerceIn(min.width.coerceAtMost(maxWidth),maxWidth),height.coerceIn(min.height.coerceAtMost(800),800))
    }
    private fun order():List<Int>{
        val a=try{JSONArray(prefs.getString("order:$theme","[]"))}catch(_:Exception){JSONArray()}
        return ((0 until a.length()).map{a.optInt(it,-1)}.filter{it in ids}+ids).distinct()
    }
    private fun updateListening(){
        val desired=foreground&&attached&&ids.isNotEmpty()&&!closed
        if(desired==listening)return
        try{if(desired)host.startListening()else host.stopListening();listening=desired}catch(_:Exception){listening=false}
    }
    fun attach(container:LinearLayout,themeName:String,textColor:Int,accentColor:Int,surfaceColor:Int){
        detach();parent=container;attached=true;theme=themeName;fg=textColor;accent=accentColor;surface=surfaceColor
        render();updateListening()
    }
    private fun button(label:String,action:()->Unit)=Button(activity).apply{
        text=label;isAllCaps=false;setTextColor(accent);setBackgroundColor(surface);setOnClickListener{action()}
    }
    private fun label(s:String)=TextView(activity).apply{
        text=s;setTextColor(fg);textSize=13f;setTextIsSelectable(false);setPadding(dp(8),dp(5),dp(8),dp(5))
    }
    private fun render(){
        val root=parent?:return
        root.removeAllViews()
        root.addView(button("Add Android widget"){pick()})
        var altered=false
        for(id in order()){
            val info=manager.getAppWidgetInfo(id)
            if(info==null){ids.remove(id);try{host.deleteAppWidgetId(id)}catch(_:Exception){};altered=true;continue}
            val widthHeight=size(id,info)
            val card=LinearLayout(activity).apply{
                orientation=LinearLayout.VERTICAL
                background=GradientDrawable().apply{setColor(surface);cornerRadius=dp(14).toFloat()}
            }
            val head=LinearLayout(activity).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL}
            head.addView(label(info.loadLabel(activity.packageManager).toString()),LinearLayout.LayoutParams(0,-2,1f))
            head.addView(button("Edit"){edit(id,info)},LinearLayout.LayoutParams(dp(64),dp(44)))
            card.addView(head)
            try{
                val view=host.createView(activity,id,info)
                val slot=HoldSlot(activity){edit(id,info)}
                slot.addView(view,FrameLayout.LayoutParams(-1,-1))
                val lp=LinearLayout.LayoutParams(dp(widthHeight.width),dp(widthHeight.height));lp.gravity=Gravity.CENTER_HORIZONTAL
                card.addView(slot,lp)
                @Suppress("DEPRECATION")
                view.updateAppWidgetSize(null,widthHeight.width,widthHeight.height,widthHeight.width,widthHeight.height)
            }catch(_:Exception){card.addView(label("Widget unavailable. Use Edit to remove or retry."))}
            val params=LinearLayout.LayoutParams(-1,-2);params.setMargins(0,dp(5),0,dp(5))
            root.addView(card,params)
        }
        if(altered)save()
    }
    private inner class HoldSlot(context:Context,val onHold:()->Unit):FrameLayout(context){
        private val slop=ViewConfiguration.get(context).scaledTouchSlop
        private var downX=0f;private var downY=0f;private var tracking=false;private var consumed=false
        private var last:MotionEvent?=null
        private val hold=Runnable{
            if(tracking&&isAttachedToWindow){
                consumed=true;tracking=false
                last?.let{e->val cancel=MotionEvent.obtain(e);cancel.action=MotionEvent.ACTION_CANCEL
                    super.dispatchTouchEvent(cancel);cancel.recycle()}
                performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS);onHold()
            }
        }
        override fun dispatchTouchEvent(ev:MotionEvent):Boolean{
            when(ev.actionMasked){
                MotionEvent.ACTION_DOWN->{removeCallbacks(hold);last?.recycle();last=MotionEvent.obtain(ev);downX=ev.x;downY=ev.y;tracking=true;consumed=false
                    postDelayed(hold,ViewConfiguration.getLongPressTimeout().toLong())}
                MotionEvent.ACTION_MOVE->{if(abs(ev.x-downX)>slop||abs(ev.y-downY)>slop){tracking=false;removeCallbacks(hold)}}
                MotionEvent.ACTION_UP,MotionEvent.ACTION_CANCEL,MotionEvent.ACTION_POINTER_DOWN->{tracking=false;removeCallbacks(hold)}
            }
            if(consumed){if(ev.actionMasked==MotionEvent.ACTION_UP||ev.actionMasked==MotionEvent.ACTION_CANCEL)consumed=false;return true}
            return super.dispatchTouchEvent(ev)||tracking
        }
        override fun onDetachedFromWindow(){removeCallbacks(hold);tracking=false;last?.recycle();last=null;super.onDetachedFromWindow()}
    }
    private fun edit(id:Int,info:AppWidgetProviderInfo){
        if(closed||picker?.isShowing==true)return
        val s=size(id,info);val min=limits(info);val maxW=availableWidth().coerceAtLeast(72)
        val content=LinearLayout(activity).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(18),dp(8),dp(18),dp(8))}
        val horizontal=(info.resizeMode and AppWidgetProviderInfo.RESIZE_HORIZONTAL)!=0
        val vertical=(info.resizeMode and AppWidgetProviderInfo.RESIZE_VERTICAL)!=0
        val lowerW=min.width.coerceAtMost(maxW);val lowerH=min.height.coerceAtMost(800)
        var width=s.width;var height=s.height
        fun slider(name:String,value:Int,lo:Int,hi:Int,enabled:Boolean,set:(Int)->Unit){
            val title=TextView(activity).apply{text="$name: $value dp"}
            content.addView(title)
            val seek=SeekBar(activity).apply{max=(hi-lo)/8;progress=((value-lo)/8).coerceIn(0,max);isEnabled=enabled}
            seek.setOnSeekBarChangeListener(object:SeekBar.OnSeekBarChangeListener{
                override fun onStartTrackingTouch(s:SeekBar){}
                override fun onStopTrackingTouch(s:SeekBar){}
                override fun onProgressChanged(s:SeekBar,p:Int,user:Boolean){val n=(lo+p*8).coerceAtMost(hi);title.text="$name: $n dp";set(n)}
            });content.addView(seek)
        }
        slider("Width",width,lowerW,maxW,horizontal){width=it}
        slider("Height",height,lowerH,800,vertical){height=it}
        val moves=LinearLayout(activity).apply{orientation=LinearLayout.HORIZONTAL}
        moves.addView(button("Move up"){move(id,-1)},LinearLayout.LayoutParams(0,-2,1f))
        moves.addView(button("Move down"){move(id,1)},LinearLayout.LayoutParams(0,-2,1f));content.addView(moves)
        picker=AlertDialog.Builder(activity).setTitle(info.loadLabel(activity.packageManager)).setView(content)
            .setPositiveButton("Save"){_,_->
                prefs.edit().putInt("w:$theme:$id",width).putInt("h:$theme:$id",height).apply();render()
            }.setNegativeButton("Cancel",null)
            .setNeutralButton("Remove"){_,_->remove(id)}.create().apply{
                setOnDismissListener{picker=null};show()
            }
    }
    private fun move(id:Int,delta:Int){
        val arranged=order().toMutableList();val i=arranged.indexOf(id);val j=i+delta
        if(i>=0&&j in arranged.indices){java.util.Collections.swap(arranged,i,j);prefs.edit().putString("order:$theme",JSONArray(arranged).toString()).apply();render()}
    }
    private fun remove(id:Int){
        if(!ids.remove(id))return
        try{host.deleteAppWidgetId(id)}catch(_:Exception){}
        save();render();updateListening()
    }
    private fun pick(){
        if(closed||pending>0||picker?.isShowing==true)return
        val providers=manager.installedProviders.filter{(it.widgetCategory and AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN)!=0}.sortedBy{it.loadLabel(activity.packageManager).lowercase()}
        if(providers.isEmpty()){Toast.makeText(activity,"No Android widgets available",Toast.LENGTH_SHORT).show();return}
        picker=AlertDialog.Builder(activity).setTitle("Add widget")
            .setItems(providers.map{it.loadLabel(activity.packageManager)}.toTypedArray()){_,i->bind(providers[i])}
            .setNegativeButton("Cancel",null).create().apply{setOnDismissListener{picker=null};show()}
    }
    private fun bind(info:AppWidgetProviderInfo){
        try{
            pending=host.allocateAppWidgetId();save()
            val options=Bundle().apply{putInt(AppWidgetManager.OPTION_APPWIDGET_HOST_CATEGORY,AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN)}
            if(manager.bindAppWidgetIdIfAllowed(pending,info.provider,options))configure()
            else activity.startActivityForResult(Intent(AppWidgetManager.ACTION_APPWIDGET_BIND)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,pending)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_PROVIDER,info.provider)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_OPTIONS,options),BIND)
        }catch(_:Exception){cancel()}
    }
    private fun configure(){
        val info=manager.getAppWidgetInfo(pending)?:return cancel()
        if(info.configure!=null){
            try{host.startAppWidgetConfigureActivityForResult(activity,pending,0,CONFIGURE,null)}catch(_:Exception){cancel()}
        }else finish()
    }
    private fun cancel(){if(pending>0)try{host.deleteAppWidgetId(pending)}catch(_:Exception){};pending=-1;save()}
    private fun finish(){if(pending>0&&pending !in ids)ids.add(pending);pending=-1;save();render();updateListening();changed()}
    fun result(request:Int,result:Int):Boolean{
        if(request!=BIND&&request!=CONFIGURE)return false
        if(result!=Activity.RESULT_OK)cancel()else if(request==BIND)configure()else finish()
        return true
    }
    fun resume(){foreground=true;updateListening()}
    fun pause(){foreground=false;updateListening()}
    fun detach(){attached=false;parent?.removeAllViews();parent=null;updateListening()}
    fun close(){closed=true;picker?.dismiss();detach();pause()}
}
