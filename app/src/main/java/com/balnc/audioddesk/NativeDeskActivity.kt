package com.balnc.audioddesk

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.*
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONArray
import org.json.JSONObject
import java.text.DateFormat
import java.util.Date
import java.util.Locale

/** Independent native migration screen. Not yet registered as the default HOME.
 * No WebView, HTML, CSS, JS, or overlay geometry bridges in this activity. */
class NativeDeskActivity:Activity(){
    private val prefs by lazy{getSharedPreferences("native_desk",0)}
    private val handler=Handler(Looper.getMainLooper())
    private val density get()=resources.displayMetrics.density
    private fun dp(v:Int)=(v*density+.5f).toInt()
    private var theme=NativeDeskTheme.warm
    private var wallpaperBitmap:Bitmap?=null
    private var wallpaperAccent:Int?=null
    private lateinit var wallpaper:NativeDeskWallpaper
    private lateinit var systemWallpaper:SystemWallpaperInstaller
    private lateinit var apps:HomeLauncherSupport
    private lateinit var media:MediaWidgetSupport
    private lateinit var agenda:AgendaSupport
    private lateinit var acoustics:AcousticMeterSupport
    private lateinit var spectrum:AudioSpectrumSupport
    private lateinit var root:FrameLayout
    private lateinit var background:ImageView
    private lateinit var page:LinearLayout
    private lateinit var grid:WidgetGrid
    private var tiles=NativeDeskLayout.defaults
    private var all=emptyList<NativeCatalogApp>()
    private var recent=emptyList<NativeCatalogApp>()
    private var currentPage="home"
    private var foreground=false
    private var closed=false
    private var generation=0
    private var mediaState=JSONObject()
    private var agendaEvents=JSONArray()
    private var eventIndex=0
    private var splOn=false
    private var micOn=false
    private var fftOn=false
    private var weight="A"
    private var response="fast"
    private var calibration:Double?=null
    private var maximum=Double.NEGATIVE_INFINITY
    private var micRange=90
    private var peakHold=false
    private var musicGraph:Plot?=null
    private var micGraph:Plot?=null
    private var clock:TextView?=null
    private var date:TextView?=null
    private var musicTitle:TextView?=null
    private var musicArtist:TextView?=null
    private var play:TextView?=null
    private var previous:TextView?=null
    private var next:TextView?=null
    private var connect:TextView?=null
    private var seek:SeekBar?=null
    private var seekDragging=false
    private var musicTime:TextView?=null
    private var musicSeekRow:LinearLayout?=null
    private var fftButton:NativeMusicControl?=null
    private var spectrumStatus:TextView?=null
    private var agendaText:TextView?=null
    private var agendaDate:TextView?=null
    private var splText:TextView?=null
    private var splMax:TextView?=null
    private var splBar:ProgressBar?=null
    private var micStatus:TextView?=null
    private var favorites:LinearLayout?=null
    private var touchX=0f
    private var touchY=0f
    private var gestureAllowed=false
    private var fullMusic=true
    private val ticker=object:Runnable{
        override fun run(){
            if(!foreground||currentPage!="home")return
            updateClock();updateMedia(media.state())
            handler.postDelayed(this,1000)
        }
    }
    override fun onCreate(state:Bundle?){
        super.onCreate(state)
        WindowCompat.setDecorFitsSystemWindows(window,false)
        window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        apps=HomeLauncherSupport(this);media=MediaWidgetSupport(this)
        wallpaper=NativeDeskWallpaper(this);systemWallpaper=SystemWallpaperInstaller(applicationContext)
        agenda=AgendaSupport(this){j->runOnUiThread{if(!closed){agendaEvents=j.optJSONArray("events")?:JSONArray();eventIndex=0;updateAgenda()}}}
        acoustics=AcousticMeterSupport(this){j->runOnUiThread{if(foreground&&currentPage=="home")updateAcoustic(j)}}
        spectrum=AudioSpectrumSupport(this){j->runOnUiThread{if(foreground&&currentPage=="home"){
            if(j.optString("state")=="capturing"){
                musicGraph?.update(j.optJSONArray("bands"),false)
                spectrumStatus?.text="Real playback FFT"
            }else{
                musicGraph?.clear()
                spectrumStatus?.text=when(j.optString("state")){"unsupported"->"Output mix unavailable";"permission"->"Audio permission required";"listening"->"Listening for playback";else->"Spectrum idle"}
            }
        }}}
        theme=NativeDeskTheme.named(prefs.getString("theme","warm")?:"warm")
        weight=prefs.getString("weight","A")?:"A";response=prefs.getString("response","fast")?:"fast"
        calibration=prefs.getString("calibration",null)?.toDoubleOrNull()
        micRange=prefs.getInt("range",90).takeIf{it in listOf(60,90,120)}?:90
        restoreLayout()
        root=FrameLayout(this)
        background=ImageView(this).apply{scaleType=ImageView.ScaleType.CENTER_CROP;importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO}
        root.addView(background,FrameLayout.LayoutParams(-1,-1))
        page=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;isFocusableInTouchMode=true}
        root.addView(page,FrameLayout.LayoutParams(-1,-1))
        ViewCompat.setOnApplyWindowInsetsListener(page){v,i->
            val b=i.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime=i.getInsets(WindowInsetsCompat.Type.ime())
            v.setPadding(b.left+dp(12),b.top+dp(8),b.right+dp(12),maxOf(b.bottom,ime.bottom)+dp(8));i
        }
        setContentView(root);showHome();loadWallpaper(wallpaper.selection())
        if(android.os.Build.VERSION.SDK_INT>=33)onBackInvokedDispatcher.registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT){if(currentPage!="home"){hideKeyboard();showHome()}else finish()}
        ViewCompat.requestApplyInsets(page)
    }
    private fun restoreLayout(){
        val raw=try{JSONArray(prefs.getString("layout","[]"))}catch(_:Exception){JSONArray()}
        val decoded=(0 until raw.length()).mapNotNull{i->raw.optJSONObject(i)?.let{DeskTile(it.optString("id"),it.optInt("x"),it.optInt("y"),it.optInt("w"),it.optInt("h"))}}
        if(decoded.isNotEmpty()){
            val restored=NativeDeskLayout.restore(decoded)
            if(restored.map{it.id}.toSet()==NativeDeskLayout.defaults.map{it.id}.toSet())tiles=restored
        }
    }
    private fun saveLayout(){
        val arr=JSONArray()
        for(t in tiles)arr.put(JSONObject().put("id",t.id).put("x",t.x).put("y",t.y).put("w",t.w).put("h",t.h))
        prefs.edit().putString("layout",arr.toString()).apply()
    }
    private fun text(s:String,size:Float=14f)=TextView(this).apply{
        text=s;textSize=size;setTextColor(theme.ink);includeFontPadding=false
        gravity=Gravity.CENTER_VERTICAL;maxLines=2;ellipsize=android.text.TextUtils.TruncateAt.END
    }
    private fun control(s:String,action:()->Unit)=text(s,13f).apply{
        gravity=Gravity.CENTER;background=theme.surface(density,theme.control);minHeight=dp(36)
        setPadding(dp(5),0,dp(5),0);isClickable=true;isFocusable=true;setOnClickListener{action()}
    }
    private fun row(vararg views:View)=LinearLayout(this).apply{
        orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL
        for((i,v)in views.withIndex())addView(v,LinearLayout.LayoutParams(0,-1,1f).apply{if(i>0)leftMargin=dp(5)})
    }
    private fun column()=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL}
    private fun LinearLayout.add(v:View,h:Int)=addView(v,LinearLayout.LayoutParams(-1,dp(h)))
    private fun card(title:String,id:String):LinearLayout=column().apply{
        background=theme.surface(density,bordered=true);setPadding(dp(10),dp(7),dp(10),dp(7));clipToOutline=true
        add(text(title,12f).apply{setTextColor(theme.muted);setOnLongClickListener{editTile(id);true}},24)
        setOnLongClickListener{editTile(id);true}
    }
    private fun header(){
        val heading=text("Audio Desk",20f).apply{typeface=Typeface.DEFAULT_BOLD}
        page.addView(LinearLayout(this).apply{
            gravity=Gravity.CENTER_VERTICAL
            addView(heading,LinearLayout.LayoutParams(0,dp(42),1f))
            addView(control("Settings"){settings()},LinearLayout.LayoutParams(dp(84),dp(36)))
        })
    }
    private fun showHome(){
        currentPage="home";page.removeAllViews();page.setBackgroundColor(android.graphics.Color.TRANSPARENT)
        root.setBackgroundColor(theme.background);header()
        grid=WidgetGrid()
        val scroll=ScrollView(this).apply{isFillViewport=false;isVerticalScrollBarEnabled=false;addView(grid,FrameLayout.LayoutParams(-1,-2))}
        page.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
        page.add(row(control("News"){showNews()},control("Search"){showApps(true)},control("Apps"){showApps(false)}),44)
        buildTiles();updateClock();updateMedia(mediaState);updateAgenda();renderFavorites()
        page.requestFocus()
        if(foreground){handler.removeCallbacks(ticker);handler.post(ticker);syncAudio()}
    }
    private inner class WidgetGrid:ViewGroup(this@NativeDeskActivity){
        private val cells=LinkedHashMap<String,View>()
        fun bind(t:DeskTile,v:View){cells[t.id]=v;addView(v)}
        fun clear(){cells.clear();removeAllViews()}
        override fun onMeasure(ws:Int,hs:Int){
            val width=MeasureSpec.getSize(ws);val cell=width/NativeDeskLayout.columns;val unit=dp(58);val gap=dp(7)
            for(t in tiles)cells[t.id]?.measure(MeasureSpec.makeMeasureSpec((cell*t.w-gap).coerceAtLeast(1),MeasureSpec.EXACTLY),MeasureSpec.makeMeasureSpec(unit*t.h-gap,MeasureSpec.EXACTLY))
            setMeasuredDimension(width,unit*(tiles.maxOfOrNull{it.y+it.h}?:0))
        }
        override fun onLayout(changed:Boolean,l:Int,t:Int,r:Int,b:Int){
            val cell=(r-l)/NativeDeskLayout.columns;val unit=dp(58)
            for(tile in tiles)cells[tile.id]?.let{v->val x=tile.x*cell;val y=tile.y*unit;v.layout(x,y,x+v.measuredWidth,y+v.measuredHeight)}
        }
    }
    private fun buildTiles(){
        grid.clear()
        for(t in tiles){
            val v=when(t.id){
                "clock"->card("CLOCK","clock").apply{
                    clock=text("",33f);date=text("",12f)
                    addView(clock,LinearLayout.LayoutParams(-1,0,1f));add(date!!,19)
                }
                "music"->musicCard(t.h>=4)
                "agenda"->agendaCard()
                "favorites"->card("RECENT APPS","favorites").apply{favorites=column();addView(favorites,LinearLayout.LayoutParams(-1,0,1f))}
                "spl"->splCard()
                "mic"->micCard()
                else->card(t.id,t.id)
            }
            grid.bind(t,v)
        }
    }
    private fun editTile(id:String){
        val old=tiles.firstOrNull{it.id==id}?:return
        val editor=column().apply{setPadding(dp(16),dp(8),dp(16),dp(12))}
        fun picker(label:String,min:Int,max:Int,value:Int):NumberPicker{
            editor.add(text(label),24)
            return NumberPicker(this).apply{minValue=min;maxValue=max;this.value=value.coerceIn(min,max);wrapSelectorWheel=false;editor.add(this,80)}
        }
        val x=picker("Column",0,NativeDeskLayout.columns-2,old.x);val y=picker("Row",0,NativeDeskLayout.maxRows-2,old.y)
        val w=picker("Width",2,4,old.w);val h=picker("Height",NativeDeskLayout.minimumHeight(id),8,old.h)
        AlertDialog.Builder(this).setTitle("Move and resize widget").setView(ScrollView(this).apply{addView(editor)})
            .setNegativeButton("Cancel",null).setPositiveButton("Apply"){_,_->
                tiles=NativeDeskLayout.place(tiles,DeskTile(id,x.value,y.value,w.value,h.value));saveLayout();showHome()
            }.show()
    }
    private fun mediaIcon(kind:String,action:()->Unit)=NativeMusicControl(this,kind).apply{
        setPalette(theme.ink,theme.accent,theme.panel)
        setOnClickListener{action()}
        setOnLongClickListener{editTile("music");true}
    }
    private fun musicCard(full:Boolean)=column().apply{
        fullMusic=full
        background=theme.surface(density,bordered=true);clipToOutline=true
        setPadding(dp(12),dp(if(full)10 else 6),dp(12),dp(if(full)10 else 6))
        setOnLongClickListener{editTile("music");true}
        musicTitle=text("Music player",if(full)17f else 14f).apply{
            typeface=Typeface.create("sans-serif-medium",0);maxLines=1
            setOnLongClickListener{editTile("music");true}
        }
        musicArtist=text("Connect your player",11f).apply{
            setTextColor(theme.muted);maxLines=1
            setOnLongClickListener{editTile("music");true}
        }
        val meta=column().apply{
            gravity=Gravity.CENTER_VERTICAL;add(musicTitle!!,if(full)23 else 19);add(musicArtist!!,15)
        }
        connect=mediaIcon("connect"){media.openAccessSettings()}
        fftButton=if(full)mediaIcon("fft"){fftOn=!fftOn;requestAudioIfNeeded();syncAudio()} else null
        val header=LinearLayout(this@NativeDeskActivity).apply{
            gravity=Gravity.CENTER_VERTICAL
            addView(meta,LinearLayout.LayoutParams(0,-1,1f))
            addView(connect,LinearLayout.LayoutParams(dp(34),dp(34)))
            fftButton?.let{addView(it,LinearLayout.LayoutParams(dp(34),dp(34)))}
        }
        add(header,if(full)42 else 34)
        musicGraph=if(full)Plot(false)else null
        musicGraph?.let{g->addView(g,LinearLayout.LayoutParams(-1,0,1f).apply{topMargin=dp(7);bottomMargin=dp(3)})}
        spectrumStatus=text("Spectrum off",10f).apply{setTextColor(theme.muted);maxLines=1}
        if(full)add(spectrumStatus!!,14)
        seek=SeekBar(this@NativeDeskActivity).apply{
            max=1000;contentDescription="Playback position";splitTrack=false
            progressTintList=android.content.res.ColorStateList.valueOf(theme.accent)
            progressBackgroundTintList=android.content.res.ColorStateList.valueOf(theme.line)
            thumbTintList=android.content.res.ColorStateList.valueOf(theme.accent)
            setPadding(dp(3),0,dp(3),0)
            setOnSeekBarChangeListener(object:SeekBar.OnSeekBarChangeListener{
                override fun onStartTrackingTouch(v:SeekBar){seekDragging=true}
                override fun onProgressChanged(v:SeekBar,p:Int,user:Boolean){if(user)updateMusicTime(mediaState.optLong("durationMs")*p/1000,mediaState.optLong("durationMs"))}
                override fun onStopTrackingTouch(v:SeekBar){seekDragging=false;if(v.isEnabled)updateMedia(media.seek(mediaState.optLong("durationMs")*v.progress/1000))}
            })
        }
        musicTime=text("",10f).apply{gravity=Gravity.END or Gravity.CENTER_VERTICAL;setTextColor(theme.muted);maxLines=1}
        musicSeekRow=LinearLayout(this@NativeDeskActivity).apply{
            gravity=Gravity.CENTER_VERTICAL;addView(seek,LinearLayout.LayoutParams(0,-1,1f))
            addView(musicTime,LinearLayout.LayoutParams(dp(76),-1))
        }
        if(full)add(musicSeekRow!!,23)
        previous=mediaIcon("previous"){updateMedia(media.command("previous"))}
        play=mediaIcon("play"){updateMedia(media.command("toggle"))}
        next=mediaIcon("next"){updateMedia(media.command("next"))}
        val transport=LinearLayout(this@NativeDeskActivity).apply{
            gravity=Gravity.CENTER
            for(v in listOf(previous!!,play!!,next!!))addView(v,LinearLayout.LayoutParams(dp(if(full)42 else 36),dp(if(full)42 else 36)).apply{leftMargin=dp(3);rightMargin=dp(3)})
        }
        add(transport,if(full)45 else 39)
    }
    private fun updateMusicTime(pos:Long,duration:Long){
        fun stamp(ms:Long):String{val n=ms.coerceAtLeast(0)/1000;return "${n/60}:${(n%60).toString().padStart(2,'0')}"}
        musicTime?.text=stamp(pos)+" / "+stamp(duration)
    }
    private fun updateMedia(j:JSONObject){
        mediaState=j;val available=j.optBoolean("available");val enabled=j.optBoolean("enabled")
        musicTitle?.text=if(available)j.optString("title").ifBlank{"Music player"}else "Music player"
        musicArtist?.text=if(available)j.optString("artist").ifBlank{j.optString("app")}else if(enabled)"No active track" else "Connect your player"
        (play as? NativeMusicControl)?.setPlaying(j.optBoolean("playing"))
        for((v,key) in listOf(previous to "canPrevious",play to "canToggle",next to "canNext")){v?.isEnabled=available&&j.optBoolean(key);v?.alpha=if(v?.isEnabled==true)1f else .45f}
        connect?.visibility=if(enabled)View.GONE else View.VISIBLE
        val dur=j.optLong("durationMs");val pos=j.optLong("positionMs",-1)
        musicSeekRow?.visibility=if(fullMusic&&dur>0&&pos>=0)View.VISIBLE else View.GONE
        seek?.isEnabled=j.optBoolean("canSeek")
        if(!seekDragging&&dur>0&&pos>=0){seek?.progress=(pos.toDouble()/dur*1000).toInt().coerceIn(0,1000);updateMusicTime(pos,dur)}
    }
    private fun agendaCard()=card("AGENDA","agenda").apply{
        agendaText=text("Calendar access optional",15f);agendaDate=text("",11f)
        addView(agendaText,LinearLayout.LayoutParams(-1,0,1f));add(agendaDate!!,21)
        add(row(control("‹"){eventIndex=(eventIndex-1).coerceAtLeast(0);updateAgenda()},control("›"){eventIndex=(eventIndex+1).coerceAtMost((agendaEvents.length()-1).coerceAtLeast(0));updateAgenda()},control("Open"){agendaEvents.optJSONObject(eventIndex)?.let{agenda.openEvent(it.optString("id"),it.optLong("begin"),it.optLong("end"))}},control("+"){agenda.newEvent(System.currentTimeMillis())},control("Access"){if(agenda.granted())agenda.refresh()else requestPermissions(arrayOf(Manifest.permission.READ_CALENDAR),71)}),36)
    }
    private fun updateAgenda(){
        val e=agendaEvents.optJSONObject(eventIndex)
        agendaText?.text=e?.optString("title")?:if(agenda.granted())"No upcoming events" else "Calendar access optional"
        agendaDate?.text=if(e==null)"" else  DateFormat.getDateTimeInstance(DateFormat.MEDIUM,DateFormat.SHORT).format(Date(e.optLong("begin")))
    }
    private fun splCard()=card("SPL METER","spl").apply{
        splText=text("— dBFS",26f);splMax=text("Max —",11f)
        addView(splText,LinearLayout.LayoutParams(-1,0,1f))
        splBar=ProgressBar(this@NativeDeskActivity,null,android.R.attr.progressBarStyleHorizontal).apply{max=100;progressTintList=android.content.res.ColorStateList.valueOf(theme.accent)}
        add(splBar!!,9);add(splMax!!,20)
        val start=control(if(splOn)"Stop mic" else "Start mic"){}
        start.setOnClickListener{splOn=!splOn;start.text=if(splOn)"Stop mic" else "Start mic";requestAudioIfNeeded();syncAudio()}
        val w=control(weight){};w.setOnClickListener{weight=listOf("A","C","Z")[(listOf("A","C","Z").indexOf(weight)+1)%3];w.text=weight;maximum=Double.NEGATIVE_INFINITY;prefs.edit().putString("weight",weight).apply()}
        val r=control(response){};r.setOnClickListener{response=if(response=="fast")"slow" else "fast";r.text=response;maximum=Double.NEGATIVE_INFINITY;prefs.edit().putString("response",response).apply()}
        add(row(start,w,r),36)
        add(row(control("Calibrate"){calibrate()},control("Reset max"){maximum=Double.NEGATIVE_INFINITY;splMax?.text="Max —"}),36)
    }
    private fun calibrate(){
        val input=EditText(this).apply{inputType=android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL;setText(calibration?.toString().orEmpty())}
        AlertDialog.Builder(this).setTitle("Calibration offset in dB").setMessage("Use a reference SPL meter. Without calibration the reading is dBFS.").setView(input)
            .setNeutralButton("Clear"){_,_->calibration=null;maximum=Double.NEGATIVE_INFINITY;prefs.edit().remove("calibration").apply()}
            .setNegativeButton("Cancel",null).setPositiveButton("Apply"){_,_->input.text.toString().toDoubleOrNull()?.takeIf{it.isFinite()&&it in 0.0..180.0}?.let{calibration=it;maximum=Double.NEGATIVE_INFINITY;prefs.edit().putString("calibration",it.toString()).apply()}}.show()
    }
    private fun micCard()=card("MIC SPECTRUM","mic").apply{
        micGraph=Plot(true);addView(micGraph,LinearLayout.LayoutParams(-1,0,1f))
        micStatus=text("Microphone off",10f);add(micStatus!!,17)
        val start=control(if(micOn)"Stop mic" else "Start mic"){}
        start.setOnClickListener{micOn=!micOn;start.text=if(micOn)"Stop mic" else "Start mic";requestAudioIfNeeded();syncAudio()}
        val range=control("$micRange dB"){};range.setOnClickListener{micRange=when(micRange){90->120;120->60;else->90};range.text="$micRange dB";prefs.edit().putInt("range",micRange).apply();micGraph?.invalidate()}
        val peak=control(if(peakHold)"Peak on" else "Peak hold"){};peak.setOnClickListener{peakHold=!peakHold;peak.text=if(peakHold)"Peak on" else "Peak hold";micGraph?.clearPeak()}
        add(row(start,range,peak,control("Clear"){micGraph?.clearPeak()}),36)
    }
    private fun updateAcoustic(j:JSONObject){
        if(j.optString("state")!="active"){micStatus?.text=j.optString("state");return}
        val value=j.optJSONObject("levels")?.optJSONObject(weight)?.optDouble(response,Double.NaN)?:Double.NaN
        if(splOn&&value.isFinite()){
            val n=value+(calibration?:0.0);maximum=maxOf(maximum,n)
            splText?.text=String.format(Locale.US,"%.1f %s",n,if(calibration!=null)"dB$weight SPL est." else "dBFS $weight")
            splMax?.text=String.format(Locale.US,"Max %.1f",maximum)
            splBar?.progress=(if(calibration!=null)(n-25)/105*100 else value+100).toInt().coerceIn(0,100)
        }
        if(micOn){micGraph?.update(j.optJSONArray("bands"),peakHold);micStatus?.text="Live · ${j.optInt("fftSize")} FFT · ${j.optInt("sampleRate")/1000} kHz"}
    }
    private inner class Plot(private val microphone:Boolean):View(this@NativeDeskActivity){
        private val paint=Paint(Paint.ANTI_ALIAS_FLAG);private val path=Path()
        private var points=FloatArray(0);private var peak=FloatArray(0)
        fun clear(){points=FloatArray(0);peak=FloatArray(0);invalidate()}
        fun clearPeak(){peak=FloatArray(0);invalidate()}
        fun update(a:JSONArray?,hold:Boolean){
            if(a==null)return
            points=FloatArray(minOf(a.length(),512)){i->a.optDouble(i,if(microphone)-140.0 else 0.0).takeIf{it.isFinite()}?.toFloat()?:0f}
            if(hold)peak=FloatArray(points.size){i->maxOf(points[i],peak.getOrElse(i){-140f})}else peak=FloatArray(0)
            invalidate()
        }
        override fun onDraw(c:Canvas){
            super.onDraw(c);if(width<2||height<2)return
            paint.color=theme.accent;paint.strokeWidth=density;paint.style=Paint.Style.FILL;paint.alpha=40
            for(i in 1..3){val y=height*i/4f;c.drawLine(0f,y,width.toFloat(),y,paint)}
            fun trace(a:FloatArray,alpha:Int){
                if(a.size<2)return;path.reset()
                for(i in a.indices){val x=width*i.toFloat()/(a.size-1);val n=if(microphone)(1+a[i]/micRange).coerceIn(0f,1f)else a[i].coerceIn(0f,1f)
                    val y=height*(1-n);if(i==0)path.moveTo(x,y)else path.lineTo(x,y)}
                paint.alpha=alpha;paint.style=Paint.Style.STROKE;c.drawPath(path,paint);paint.style=Paint.Style.FILL
            }
            trace(points,235);trace(peak,110)
        }
    }
    private fun updateClock(){val now=Date();clock?.text=DateFormat.getTimeInstance(DateFormat.SHORT).format(now);date?.text=DateFormat.getDateInstance(DateFormat.FULL).format(now)}
    private fun renderFavorites(){
        val box=favorites?:return;box.removeAllViews()
        val rows=recent.take(6).ifEmpty{all.take(6)}
        for(group in rows.chunked(3)){
            val line=row(*group.map{app->control(app.label){apps.launch(app.pkg,app.activity)}.apply{setOnLongClickListener{appActions(app);true}}}.toTypedArray())
            box.add(line,37)
        }
    }
    private fun refreshApps(){
        val token=++generation
        apps.load(true){a,r->val decoded=NativeCatalog.decode(a);val rec=NativeCatalog.decode(r)
            runOnUiThread{if(!closed&&token==generation){all=decoded;recent=rec;if(currentPage=="home")renderFavorites()}}}
    }
    private fun appActions(app:NativeCatalogApp){
        apps.shortcuts(app.pkg,app.activity){data->runOnUiThread{
            if(closed||!foreground)return@runOnUiThread
            val entries=(0 until data.length()).mapNotNull{data.optJSONObject(it)}.distinctBy{it.optString("label").trim().lowercase(Locale.ROOT)}
            val labels=listOf("Open app","App info")+entries.map{it.optString("label")}
            AlertDialog.Builder(this).setTitle(app.label).setItems(labels.toTypedArray()){_,i->
                when(i){0->apps.launch(app.pkg,app.activity);1->try{startActivity(Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,android.net.Uri.fromParts("package",app.pkg,null)))}catch(_:Exception){};else->apps.launchShortcut(app.pkg,app.activity,entries[i-2].optString("id"))}
            }.show()
        }}
    }
    private fun leaveHome(){handler.removeCallbacks(ticker);acoustics.stop();spectrum.stop()}
    private fun showApps(keyboard:Boolean){
        leaveHome();currentPage="apps";page.removeAllViews();page.setBackgroundColor(theme.background)
        page.add(control("‹ Home"){hideKeyboard();showHome()},40)
        val search=EditText(this).apply{hint="Search installed apps";setTextColor(theme.ink);setHintTextColor(theme.muted);setSingleLine(true)}
        page.add(search,48)
        val list=ListView(this);var filtered=all
        val adapter=object:BaseAdapter(){
            override fun getCount()=filtered.size
            override fun getItem(p:Int)=filtered[p]
            override fun getItemId(p:Int)=p.toLong()
            override fun getView(p:Int,convert:View?,parent:ViewGroup):View{
                val row=(convert as? LinearLayout)?:LinearLayout(this@NativeDeskActivity).apply{gravity=Gravity.CENTER_VERTICAL;minimumHeight=dp(52);addView(ImageView(context),LinearLayout.LayoutParams(dp(39),dp(39)));addView(text("",16f).apply{setPadding(dp(12),0,0,0)},LinearLayout.LayoutParams(0,-2,1f))}
                val a=getItem(p);(row.getChildAt(0)as ImageView).setImageDrawable(try{packageManager.getActivityIcon(ComponentName(a.pkg,a.activity))}catch(_:Exception){packageManager.defaultActivityIcon});(row.getChildAt(1)as TextView).text=a.label;return row
            }
        }
        list.adapter=adapter;list.dividerHeight=0
        list.setOnItemClickListener{_,_,p,_->hideKeyboard();apps.launch(filtered[p].pkg,filtered[p].activity)}
        list.setOnItemLongClickListener{_,_,p,_->appActions(filtered[p]);true}
        search.addTextChangedListener(object:TextWatcher{
            override fun beforeTextChanged(s:CharSequence?,start:Int,count:Int,after:Int){}
            override fun onTextChanged(s:CharSequence?,start:Int,before:Int,count:Int){filtered=NativeCatalog.search(all,s.toString());adapter.notifyDataSetChanged()}
            override fun afterTextChanged(e:Editable?){}
        })
        val rail=column()
        for(ch in ('A'..'Z').toList()+'#')rail.addView(text(ch.toString(),10f).apply{gravity=Gravity.CENTER;setOnClickListener{val i=NativeCatalog.index(filtered,ch);if(i>=0)list.setSelection(i)}},LinearLayout.LayoutParams(dp(25),0,1f))
        page.addView(LinearLayout(this).apply{addView(list,LinearLayout.LayoutParams(0,-1,1f));addView(rail,LinearLayout.LayoutParams(dp(25),-1))},LinearLayout.LayoutParams(-1,0,1f))
        if(keyboard){search.requestFocus();search.post{(getSystemService(INPUT_METHOD_SERVICE)as InputMethodManager).showSoftInput(search,InputMethodManager.SHOW_IMPLICIT)}}else page.requestFocus()
    }
    private fun showNews(){
        leaveHome();currentPage="news";page.removeAllViews();page.setBackgroundColor(theme.background)
        page.add(control("‹ Home"){showHome()},44);page.add(text("Audio industry news",22f),48)
        page.add(text("Native feed migration is pending. The existing launcher remains available.",14f),70)
        page.add(control("Open existing launcher"){startActivity(Intent(this,MainActivity::class.java))},48)
    }
    private fun hideKeyboard(){(getSystemService(INPUT_METHOD_SERVICE)as InputMethodManager).hideSoftInputFromWindow(page.windowToken,0)}
    override fun dispatchTouchEvent(e:MotionEvent):Boolean{
        when(e.actionMasked){
            MotionEvent.ACTION_DOWN->{
                touchX=e.x;touchY=e.y
                val bounds=android.graphics.Rect()
                val slider=seek
                gestureAllowed=!(currentPage=="home"&&slider!=null&&slider.isShown&&slider.getGlobalVisibleRect(bounds)&&bounds.contains(e.rawX.toInt(),e.rawY.toInt())) &&
                    !(currentPage=="apps"&&currentFocus is EditText)
            }
            MotionEvent.ACTION_POINTER_DOWN->gestureAllowed=false
            MotionEvent.ACTION_UP->if(gestureAllowed){
                val dx=e.x-touchX;val dy=e.y-touchY
                val g=NativeDeskGestures.classify(dx,dy,dp(70).toFloat(),currentPage=="home")
                // Vertical widget scrolling takes priority; upward search starts at the top/bottom navigation region.
                val verticalAllowed=touchY<page.paddingTop+dp(55)||touchY>root.height-page.paddingBottom-dp(55)
                if(g!=DeskGesture.NONE&&(g!=DeskGesture.SEARCH||verticalAllowed)){
                    val cancel=MotionEvent.obtain(e);cancel.action=MotionEvent.ACTION_CANCEL;super.dispatchTouchEvent(cancel);cancel.recycle()
                    when(g){DeskGesture.SEARCH->showApps(true);DeskGesture.APPS->showApps(false);DeskGesture.NEWS->showNews();DeskGesture.HOME->{hideKeyboard();showHome()};else->{}}
                    return true
                }
            }
        }
        return super.dispatchTouchEvent(e)
    }
    private fun requestAudioIfNeeded(){
        if((splOn||micOn||fftOn)&&checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO),72)
    }
    private fun syncAudio(){
        if(!foreground||currentPage!="home")return
        val allowed=checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED
        acoustics.setActive(allowed&&splOn,allowed&&micOn)
        fftButton?.alpha=if(fftOn)1f else .5f
        fftButton?.contentDescription=if(fftOn)"Disable audio spectrum" else "Enable audio spectrum"
        if(allowed&&fftOn&&fullMusic)spectrum.start()else{spectrum.stop();musicGraph?.clear();spectrumStatus?.text="Spectrum off"}
        if(!micOn){micGraph?.clear();micStatus?.text="Microphone off"}
        if(!splOn){splText?.text="— dBFS";splBar?.progress=0}
    }
    private fun settings(){
        val options=arrayOf("Warm Minimal","Studio Graphite","Choose bundled wallpaper","Choose your photo","Reset widget layout","Existing launcher")
        AlertDialog.Builder(this).setTitle("Native Home settings").setItems(options){_,i->
            when(i){
                0,1->{prefs.edit().putString("theme",if(i==0)"warm" else "graphite").apply();refreshTheme();showHome()}
                2->{val files=wallpaper.bundled;val choices=listOf("No wallpaper")+files
                    AlertDialog.Builder(this).setTitle("Bundled wallpapers").setItems(choices.map{it.removeSuffix(".webp").replace('-',' ')}.toTypedArray()){_,p->
                        val value=if(p==0)"" else  choices[p];wallpaper.select(value);loadWallpaper(value)
                        if(p>0)AlertDialog.Builder(this).setTitle("Apply to Android too?").setItems(arrayOf("Launcher only","System Home","System Home + Lock")){_,target->if(target>0)systemWallpaper.applyBundled(value.removeSuffix(".webp"),50,target==2,1){_,ok,msg->runOnUiThread{Toast.makeText(this,if(ok)"Wallpaper applied" else  msg,Toast.LENGTH_SHORT).show()}}}.show()
                    }.show()}
                3->{startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply{type="image/*";addCategory(Intent.CATEGORY_OPENABLE);addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)},73)}
                4->{tiles=NativeDeskLayout.defaults;saveLayout();showHome()}
                5->startActivity(Intent(this,MainActivity::class.java))
            }
        }.show()
    }
    private fun refreshTheme(){
        val base=NativeDeskTheme.named(prefs.getString("theme","warm")?:"warm")
        theme=wallpaperAccent?.let{NativeDeskTheme.withWallpaper(base,it)}?:base
    }
    private fun loadWallpaper(value:String){
        wallpaper.load(value){b,accent->
            background.setImageBitmap(b);wallpaperBitmap?.recycle();wallpaperBitmap=b;wallpaperAccent=accent;refreshTheme()
            if(currentPage=="home")showHome()
        }
    }
    override fun onActivityResult(request:Int,result:Int,data:Intent?){
        super.onActivityResult(request,result,data)
        if(request==73&&result==RESULT_OK)data?.data?.let{uri->
            try{contentResolver.takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION)}catch(_:Exception){}
            wallpaper.select(uri.toString());loadWallpaper(uri.toString())
        }
    }
    override fun onRequestPermissionsResult(request:Int,permissions:Array<out String>,results:IntArray){
        super.onRequestPermissionsResult(request,permissions,results)
        if(request==71)agenda.refresh()
        if(request==72){if(results.firstOrNull()!=PackageManager.PERMISSION_GRANTED){splOn=false;micOn=false;fftOn=false};if(currentPage=="home")showHome()}
    }
    override fun onResume(){super.onResume();foreground=true;refreshApps();agenda.refresh();if(currentPage=="home"){handler.removeCallbacks(ticker);handler.post(ticker);syncAudio()}}
    override fun onPause(){foreground=false;leaveHome();super.onPause()}
    override fun onBackPressed(){if(currentPage!="home"){hideKeyboard();showHome()}else super.onBackPressed()}
    override fun onDestroy(){closed=true;generation++;handler.removeCallbacksAndMessages(null);acoustics.stop();spectrum.close();agenda.close();apps.close();wallpaper.close();systemWallpaper.close();background.setImageDrawable(null);wallpaperBitmap?.recycle();super.onDestroy()}
}
