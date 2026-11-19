package com.balnc.audioddesk

import android.app.Activity
import android.app.AlertDialog
import android.app.Dialog
import android.appwidget.AppWidgetHost
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProviderInfo
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.widget.*
import android.view.ViewGroup
import org.json.JSONArray

/** Native RemoteViews widgets. Separate panel avoids drawing over the WebView
 * and preserves provider touch handling and Android binding consent. */
internal class NativeWidgetPanel(private val activity: Activity) {
    companion object { const val BIND = 6220; const val CONFIGURE = 6221 }
    private val manager = AppWidgetManager.getInstance(activity)
    private val host = AppWidgetHost(activity, 7331)
    private val prefs = activity.getSharedPreferences("audio_desk_native_widgets", Context.MODE_PRIVATE)
    private var dialog: Dialog? = null
    private var list: LinearLayout? = null
    private var pending = prefs.getInt("pending", -1)
    private val ids = mutableListOf<Int>()
    init {
        try {
            val arr=JSONArray(prefs.getString("ids","[]") ?: "[]")
            for(i in 0 until arr.length()) if(arr.getInt(i)>0) ids.add(arr.getInt(i))
        } catch (_: Exception) {}
    }
    private fun save() { prefs.edit().putString("ids",JSONArray(ids).toString()).putInt("pending",pending).apply() }
    private fun dp(n: Int) = (n*activity.resources.displayMetrics.density).toInt()
    fun open() {
        if(dialog?.isShowing==true)return
        val body=LinearLayout(activity).apply { orientation=LinearLayout.VERTICAL;setPadding(dp(12),dp(12),dp(12),dp(12));setBackgroundColor(Color.rgb(24,25,28)) }
        val title=TextView(activity).apply {text="App widgets";textSize=22f;setTextColor(Color.WHITE)}
        body.addView(title)
        body.addView(Button(activity).apply {text="+ Add app widget";setOnClickListener{pick()}})
        list=LinearLayout(activity).apply {orientation=LinearLayout.VERTICAL}
        body.addView(ScrollView(activity).apply {addView(list)},LinearLayout.LayoutParams(-1,0,1f))
        body.addView(Button(activity).apply {text="Done";setOnClickListener{dialog?.dismiss()}})
        dialog=Dialog(activity).apply {
            setContentView(body)
            setOnDismissListener{host.stopListening();list=null;dialog=null}
            show()
            window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, (activity.resources.displayMetrics.heightPixels*.85).toInt())
        }
        try {host.startListening()}catch(_:Exception){}
        render()
    }
    private fun pick() {
        val providers=manager.installedProviders.sortedBy { it.loadLabel(activity.packageManager).lowercase() }
        if(providers.isEmpty()){Toast.makeText(activity,"No app widgets available",Toast.LENGTH_SHORT).show();return}
        AlertDialog.Builder(activity).setTitle("Choose an app widget")
            .setItems(providers.map{it.loadLabel(activity.packageManager)}.toTypedArray()){_,which->bind(providers[which])}.show()
    }
    private fun bind(info: AppWidgetProviderInfo) {
        if(pending>0){host.deleteAppWidgetId(pending);pending=-1}
        pending=host.allocateAppWidgetId();save()
        val options=Bundle().apply{putInt(AppWidgetManager.OPTION_APPWIDGET_HOST_CATEGORY,AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN)}
        try {
            if(manager.bindAppWidgetIdIfAllowed(pending,info.provider,options)) configure()
            else activity.startActivityForResult(Intent(AppWidgetManager.ACTION_APPWIDGET_BIND)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,pending)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_PROVIDER,info.provider)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_OPTIONS,options),BIND)
        } catch (_: Exception){cancel()}
    }
    private fun configure() {
        val info=manager.getAppWidgetInfo(pending)
        if(info==null){cancel();return}
        if(info.configure!=null){
            try {host.startAppWidgetConfigureActivityForResult(activity,pending,0,CONFIGURE,null)}
            catch(_:Exception){cancel()}
        }else finish()
    }
    private fun cancel(){if(pending>0)host.deleteAppWidgetId(pending);pending=-1;save()}
    private fun finish(){if(pending>0&&!ids.contains(pending))ids.add(pending);pending=-1;save();if(dialog?.isShowing!=true)open()else render()}
    fun result(request:Int,result:Int):Boolean {
        if(request!=BIND&&request!=CONFIGURE)return false
        if(result!=Activity.RESULT_OK){cancel();return true}
        if(request==BIND)configure()else finish()
        return true
    }
    private fun render(){
        val parent=list?:return
        parent.removeAllViews()
        if(ids.isEmpty()) parent.addView(TextView(activity).apply{text="Add widgets from installed apps.";setTextColor(Color.LTGRAY);setPadding(0,dp(20),0,dp(20))})
        for(id in ids.toList()){
            val info=manager.getAppWidgetInfo(id)
            if(info==null){ids.remove(id);host.deleteAppWidgetId(id);save();continue}
            val row=LinearLayout(activity).apply{orientation=LinearLayout.HORIZONTAL}
            row.addView(TextView(activity).apply{text=info.loadLabel(activity.packageManager);setTextColor(Color.WHITE)},LinearLayout.LayoutParams(0,-2,1f))
            row.addView(Button(activity).apply{text="Remove";setOnClickListener{host.deleteAppWidgetId(id);ids.remove(id);save();render()}})
            parent.addView(row)
            try {
                val widget=host.createView(activity,id,info)
                val height=maxOf(dp(100),info.minHeight).coerceAtMost(dp(480))
                parent.addView(widget,LinearLayout.LayoutParams(-1,height))
                val width=(activity.resources.displayMetrics.widthPixels-dp(24))/activity.resources.displayMetrics.density
                val h=height/activity.resources.displayMetrics.density
                widget.updateAppWidgetSize(null,width.toInt(),h.toInt(),width.toInt(),h.toInt())
            }catch(_:Exception){
                parent.addView(TextView(activity).apply{text="Widget unavailable";setTextColor(Color.LTGRAY)})
            }
        }
    }
    fun resume(){if(dialog?.isShowing==true)try{host.startListening()}catch(_:Exception){}}
    fun pause(){try{host.stopListening()}catch(_:Exception){}}
    fun close(){dialog?.dismiss();pause()}
}
