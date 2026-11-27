package com.balnc.audioddesk

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Color
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.*
import org.json.JSONObject
import java.text.DateFormat
import java.util.Date
import java.util.Locale

/** Native renderer for the existing Audio Desk engines. No synthetic spectrum. */
internal class NativeSpectrumView(context:Context):View(context){
    private val paint=Paint(Paint.ANTI_ALIAS_FLAG)
    private val curve=Path()
    private var values=FloatArray(0)
    var accent=Color.rgb(182,212,193)
    fun update(data:FloatArray){values=data;invalidate()}
    override fun onDraw(canvas:Canvas){
        super.onDraw(canvas)
        val left=8f;val right=(width-8).coerceAtLeast(9).toFloat()
        val top=8f;val bottom=(height-8).coerceAtLeast(9).toFloat()
        paint.color=Color.argb(40,255,255,255);paint.strokeWidth=1f;paint.style=Paint.Style.STROKE
        for(i in 0..4){val y=top+(bottom-top)*i/4;canvas.drawLine(left,y,right,y,paint)}
        for(i in 0..6){val x=left+(right-left)*i/6;canvas.drawLine(x,top,x,bottom,paint)}
        if(values.size<2)return
        curve.reset()
        values.forEachIndexed{i,v->
            val x=left+(right-left)*i/(values.size-1)
            val y=bottom-(bottom-top)*v.coerceIn(0f,1f)
            if(i==0)curve.moveTo(x,y)else curve.lineTo(x,y)
        }
        paint.color=accent;paint.strokeWidth=2f;canvas.drawPath(curve,paint)
    }
}

internal class NativeAudioPanel(private val activity:Activity){
    companion object {const val MIC=7101;const val CALENDAR=7102;const val PROJECTION=7103}
    private val handler=Handler(Looper.getMainLooper())
    private val media=MediaWidgetSupport(activity)
    private var root:LinearLayout?=null
    private var spectrum:NativeSpectrumView?=null
    private var meterGraph:NativeSpectrumView?=null
    private var meterLabel:TextView?=null
    private var captureLabel:TextView?=null
    private var mediaLabel:TextView?=null
    private var previous:Button?=null
    private var toggle:Button?=null
    private var next:Button?=null
    private var agendaList:LinearLayout?=null
    private var fg=Color.WHITE;private var accent=Color.WHITE;private var surface=Color.DKGRAY
    private var weighting="A"
    private var lastLevels=JSONObject()
    private var mode=""
    private var visible=false
    private var foreground=false
    private var closed=false
    private var outputEnabled=false
    private var projectionPending=false
    private val meter=AcousticMeterSupport(activity){data->handler.post{if(visible&&foreground&&!closed&&mode=="mic")updateMic(data)}}
    private val output=AudioSpectrumSupport(activity){data->handler.post{if(visible&&foreground&&!closed&&mode=="music")updateOutput(data)}}
    private val agenda=AgendaSupport(activity){data->handler.post{if(visible&&foreground&&!closed&&mode=="agenda")updateAgenda(data)}}
    private val poll=object:Runnable{
        override fun run(){
            if(!visible||!foreground||closed||mode!="music")return
            updateMedia();handler.postDelayed(this,1500)
        }
    }
    private fun dp(n:Int)=(n*activity.resources.displayMetrics.density).toInt()
    private fun text(s:String,size:Float=15f)=TextView(activity).apply{
        text=s;textSize=size;setTextColor(fg);setTextIsSelectable(false);setPadding(dp(12),dp(8),dp(12),dp(8))
    }
    private fun button(s:String,action:()->Unit)=Button(activity).apply{
        text=s;isAllCaps=false;setTextColor(accent);setBackgroundColor(surface);setOnClickListener{action()}
    }
    private fun row()=LinearLayout(activity).apply{orientation=LinearLayout.HORIZONTAL}
    private fun column()=LinearLayout(activity).apply{orientation=LinearLayout.VERTICAL}
    fun mount(parent:LinearLayout,foregroundColor:Int,accentColor:Int,panelColor:Int){
        detach()
        visible=true;root=parent;fg=foregroundColor;accent=accentColor;surface=panelColor
        val controls=row()
        listOf("Music" to "music","SPL / FFT" to "mic","Agenda" to "agenda").forEach{(title,id)->
            controls.addView(button(title){show(id)},LinearLayout.LayoutParams(0,dp(48),1f))
        }
        parent.addView(controls)
        val content=column();parent.addView(content,LinearLayout.LayoutParams(-1,0,1f))
        panel=content
        show("music")
    }
    private var panel:LinearLayout?=null
    fun select(id:String){if(id in listOf("music","mic","agenda"))show(id)}
    private fun show(id:String){
        stopCapture();mode=id;panel?.removeAllViews()
        spectrum=null;meterGraph=null;meterLabel=null;captureLabel=null;agendaList=null;mediaLabel=null
        val p=panel?:return
        when(id){
            "music"->{
                mediaLabel=text("No active player",20f);p.addView(mediaLabel)
                val r=row()
                previous=button("Previous"){media.command("previous");updateMedia()}
                toggle=button("Play"){media.command("toggle");updateMedia()}
                next=button("Next"){media.command("next");updateMedia()}
                listOf(previous,toggle,next).forEach{r.addView(it,LinearLayout.LayoutParams(0,dp(48),1f))}
                p.addView(r)
                p.addView(button("Allow media control"){media.openAccessSettings()})
                spectrum=NativeSpectrumView(activity).apply{accent=this@NativeAudioPanel.accent}
                p.addView(spectrum,LinearLayout.LayoutParams(-1,dp(150)))
                captureLabel=text("Output spectrum is stopped",12f);p.addView(captureLabel)
                p.addView(button("Enable output spectrum"){
                    outputEnabled=true
                    if(!output.hasPermission())activity.requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO),MIC)else if(foreground)output.start()
                })
                if(Build.VERSION.SDK_INT>=29)p.addView(button("Playback capture fallback"){requestProjection()})
            }
            "mic"->{
                meterLabel=text("Microphone meter is stopped",24f);p.addView(meterLabel)
                val r=row()
                listOf("A","C","Z").forEach{w->r.addView(button(w){weighting=w;displayLevels()},LinearLayout.LayoutParams(0,dp(48),1f))}
                p.addView(r)
                p.addView(text("Relative dBFS · not calibrated sound pressure level",12f))
                meterGraph=NativeSpectrumView(activity).apply{accent=this@NativeAudioPanel.accent}
                p.addView(meterGraph,LinearLayout.LayoutParams(-1,dp(170)))
                p.addView(text("20 Hz                     1 kHz                     20 kHz",12f))
                p.addView(button("Start microphone analysis"){
                    micEnabled=true
                    if(!meter.permitted())activity.requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO),MIC)
                    else if(foreground)meter.setActive(true,true)
                })
                p.addView(button("Stop microphone"){micEnabled=false;meter.stop();meterGraph?.update(FloatArray(0));meterLabel?.text="Stopped"})
            }
            "agenda"->{
                val r=row()
                r.addView(button("Allow calendar"){
                    if(!agenda.granted())activity.requestPermissions(arrayOf(Manifest.permission.READ_CALENDAR),CALENDAR)else agenda.refresh()
                },LinearLayout.LayoutParams(0,dp(48),1f))
                r.addView(button("New event"){agenda.newEvent(System.currentTimeMillis())},LinearLayout.LayoutParams(0,dp(48),1f))
                p.addView(r)
                val scroll=ScrollView(activity);agendaList=column();scroll.addView(agendaList)
                p.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
            }
        }
        if(foreground)startVisible()
    }
    private var micEnabled=false
    private fun updateMedia(){
        val state=media.state()
        mediaLabel?.text=when{
            !state.optBoolean("enabled")->"Allow notification access for media control"
            !state.optBoolean("available")->"No active player"
            else->state.optString("title")+"\n"+state.optString("artist")
        }
        previous?.isEnabled=state.optBoolean("canPrevious")
        next?.isEnabled=state.optBoolean("canNext")
        toggle?.isEnabled=state.optBoolean("canToggle")
        toggle?.text=if(state.optBoolean("playing"))"Pause" else "Play"
    }
    private fun updateOutput(data:JSONObject){
        val a=data.optJSONArray("bands")
        if(a!=null)spectrum?.update(FloatArray(a.length()){a.optDouble(it,0.0).toFloat().coerceIn(0f,1f)})
        else if(data.optString("state")!="capturing")spectrum?.update(FloatArray(0))
        captureLabel?.text=when(data.optString("state")){
            "capturing"->"Live playback spectrum"
            "permission"->"Microphone permission required by Android"
            "unsupported"->"Output mix unavailable on this device"
            "listening"->"Listening"
            else->"Spectrum stopped"
        }
    }
    private fun displayLevels(){
        val value=lastLevels.optJSONObject(weighting)?.optDouble("slow",Double.NaN)?:Double.NaN
        meterLabel?.text=if(value.isFinite())String.format(Locale.US,"%.1f dBFS (%s)",value,weighting)else "Waiting for microphone"
    }
    private fun updateMic(data:JSONObject){
        if(data.optString("state")!="active"){meterLabel?.text=data.optString("state");return}
        lastLevels=data.optJSONObject("levels")?:JSONObject();displayLevels()
        val a=data.optJSONArray("bands")?:return
        meterGraph?.update(FloatArray(a.length()){((a.optDouble(it,-100.0)+100)/100).toFloat().coerceIn(0f,1f)})
    }
    private fun updateAgenda(data:JSONObject){
        val p=agendaList?:return;p.removeAllViews()
        if(data.optString("state")!="ready"){p.addView(text("Calendar access required or unavailable"));return}
        val events=data.optJSONArray("events")?:return
        var count=0
        for(i in 0 until events.length()){
            val event=events.optJSONObject(i)?:continue
            if(event.optLong("end")<System.currentTimeMillis())continue
            if(count++>=80)break
            val label=event.optString("title")+"\n"+DateFormat.getDateTimeInstance().format(Date(event.optLong("begin")))
            p.addView(text(label).apply{setOnClickListener{agenda.openEvent(event.optString("id"),event.optLong("begin"),event.optLong("end"))}})
        }
        if(count==0)p.addView(text("No upcoming events"))
    }
    private fun requestProjection(){
        if(Build.VERSION.SDK_INT<29||!foreground||!visible)return
        if(!output.hasPermission()){
            activity.requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO),MIC);return
        }
        projectionPending=true
        val m=activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        try{activity.startActivityForResult(m.createScreenCaptureIntent(),PROJECTION)}catch(_:Exception){projectionPending=false}
    }
    fun result(request:Int,result:Int,data:Intent?):Boolean{
        if(request!=PROJECTION)return false
        projectionPending=false
        if(result==Activity.RESULT_OK&&data!=null&&visible&&mode=="music"&&Build.VERSION.SDK_INT>=29){
            output.stop();SpectrumProjectionService.observer={samples->output.deliverProjection(samples)}
            val intent=Intent(activity,SpectrumProjectionService::class.java).apply{
                action=SpectrumProjectionService.ACTION_START;putExtra(SpectrumProjectionService.EXTRA_RESULT,result);putExtra(SpectrumProjectionService.EXTRA_DATA,data)
            }
            try{activity.startForegroundService(intent)}catch(_:Exception){SpectrumProjectionService.observer=null}
        }
        return true
    }
    fun permissions(request:Int){if(request==MIC||request==CALENDAR)startVisible()}
    private fun startVisible(){
        if(!visible||!foreground||closed)return
        when(mode){
            "music"->{handler.removeCallbacks(poll);handler.post(poll);if(outputEnabled&&SpectrumProjectionService.observer==null)output.start()}
            "mic"->if(micEnabled&&meter.permitted())meter.setActive(true,true)
            "agenda"->agenda.refresh()
        }
    }
    private fun stopCapture(){
        handler.removeCallbacks(poll);meter.stop();output.stop()
        SpectrumProjectionService.observer=null
        try{activity.stopService(Intent(activity,SpectrumProjectionService::class.java))}catch(_:Exception){}
    }
    fun resume(){foreground=true;startVisible()}
    fun pause(){foreground=false;stopCapture()}
    fun detach(){visible=false;stopCapture();panel=null;root=null}
    fun close(){closed=true;detach();agenda.close();handler.removeCallbacksAndMessages(null)}
}
