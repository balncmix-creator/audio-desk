package com.balnc.audioddesk

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.content.Intent
import android.content.Context
import android.net.Uri
import android.graphics.Color
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.widget.*
import android.text.TextWatcher
import android.text.Editable
import org.json.JSONArray
import java.util.concurrent.Executors
import java.text.DateFormat
import java.util.Date

/** All screen content is Android Views. External pages are delegated to the browser. */
class NativeLauncherActivity:Activity(){
    private data class App(val pkg:String,val activity:String,val label:String,val score:Double,val days:Int){
        val key get()=pkg+"/"+activity
    }
    private lateinit var support:HomeLauncherSupport
    private lateinit var audio:NativeAudioPanel
    private lateinit var widgetHost:NativeWidgetHost
    private lateinit var root:LinearLayout
    private lateinit var body:LinearLayout
    private val prefs by lazy{getSharedPreferences("native_desk",MODE_PRIVATE)}
    private var apps=emptyList<App>()
    private var recents=emptyList<App>()
    private var pinned=mutableSetOf<String>()
    private var page="Home"
    private var theme="Minimal"
    private var bg=Color.rgb(17,19,20);private var fg=Color.WHITE;private var accent=Color.rgb(182,212,193)
    private var surface=Color.rgb(33,37,39)
    private val workers=Executors.newFixedThreadPool(4)
    private val handler=Handler(Looper.getMainLooper())
    private var destroyed=false
    private var dialog:AlertDialog?=null
    private var clock:TextView?=null
    private var stories=emptyList<Story>()
    private var customFeeds=emptyList<Feed>()
    private var removed=mutableSetOf<String>()
    private var saved=mutableSetOf<String>()
    private val health=mutableMapOf<String,String>()
    private var refreshing=false
    private var newsCategory="All"
    private var newsQuery=""
    private var appQuery=""
    private var appList:ListView?=null
    private var newsList:ListView?=null
    private var newsStatus:TextView?=null
    private val ticker=object:Runnable{
        override fun run(){if(destroyed)return;clock?.text=DateFormat.getTimeInstance(DateFormat.SHORT).format(Date());orbitView?.invalidate();handler.postDelayed(this,15000)}
    }
    override fun onCreate(state:Bundle?){
        super.onCreate(state)
        support=HomeLauncherSupport(this)
        audio=NativeAudioPanel(this)
        widgetHost=NativeWidgetHost(this){}
        pinned=prefs.getStringSet("pins",emptySet())!!.toMutableSet()
        removed=prefs.getStringSet("removed",emptySet())!!.toMutableSet()
        saved=prefs.getStringSet("saved",emptySet())!!.toMutableSet()
        theme=prefs.getString("theme","Minimal")?:"Minimal"
        stories=NativeNews.decode(prefs.getString("news","[]")?:"[]")
        customFeeds=try{
            val a=JSONArray(prefs.getString("feeds","[]"));(0 until a.length()).mapNotNull{i->a.optJSONObject(i)?.let{Feed(it.optString("name"),it.optString("url"),it.optString("category","Production"))}}
        }catch(_:Exception){emptyList()}
        showPage("Home");handler.post(ticker)
    }
    override fun onResume(){super.onResume();if(::audio.isInitialized)audio.resume();if(::widgetHost.isInitialized)widgetHost.resume();if(::support.isInitialized)support.load(true){a,r->runOnUiThread{
        if(destroyed)return@runOnUiThread
        apps=decodeApps(a);recents=decodeApps(r)
        if(page=="Home")showPage("Home")else if(page=="Apps")renderAppRows()
    }}}
    private fun decodeApps(a:JSONArray)=(0 until a.length()).mapNotNull{i->a.optJSONObject(i)?.let{
        App(it.optString("pkg"),it.optString("activity"),it.optString("label"),it.optDouble("habitScore",0.0),it.optInt("usageDays"))
    }}
    private fun dp(n:Int)=(n*resources.displayMetrics.density).toInt()
    private fun palette(){
        when(theme){
            "Orbit"->{bg=Color.rgb(16,18,17);surface=Color.rgb(32,38,34);fg=Color.rgb(229,240,231);accent=Color.rgb(197,224,200)}
            "Warm"->{bg=Color.rgb(40,31,30);surface=Color.rgb(69,54,51);fg=Color.rgb(255,240,227);accent=Color.rgb(255,190,163)}
            "Pixel"->{bg=Color.BLACK;surface=Color.rgb(30,30,30);fg=Color.WHITE;accent=Color.rgb(150,240,144)}
            "Tiles"->{bg=Color.rgb(12,22,34);surface=Color.rgb(26,62,87);fg=Color.WHITE;accent=Color.rgb(108,211,255)}
            "Extreme"->{bg=Color.BLACK;surface=Color.BLACK;fg=Color.WHITE;accent=Color.WHITE}
            else->{bg=Color.rgb(17,19,20);surface=Color.rgb(33,37,39);fg=Color.WHITE;accent=Color.rgb(182,212,193)}
        }
    }
    private fun text(s:String,size:Float=16f)=TextView(this).apply{
        text=s;textSize=size;setTextColor(fg);setTextIsSelectable(false);gravity=Gravity.CENTER_VERTICAL
        setPadding(dp(12),dp(9),dp(12),dp(9))
    }
    private fun button(s:String,onTap:()->Unit)=Button(this).apply{
        text=s;isAllCaps=false;setTextColor(accent);setBackgroundColor(surface);minHeight=dp(46)
        setOnClickListener{onTap()}
    }
    private fun column()=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL}
    private fun row()=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL}
    private fun showPage(next:String){
        if(::audio.isInitialized)audio.detach();if(::widgetHost.isInitialized)widgetHost.detach();page=next;palette();clock=null;orbitView=null;newsList=null;appList=null;newsStatus=null
        root=column().apply{setBackgroundColor(bg)}
        root.setOnApplyWindowInsetsListener{v,insets->
            if(android.os.Build.VERSION.SDK_INT>=30){
                val i=insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                v.setPadding(i.left,i.top,i.right,i.bottom)
            }else{@Suppress("DEPRECATION") v.setPadding(insets.systemWindowInsetLeft,insets.systemWindowInsetTop,insets.systemWindowInsetRight,insets.systemWindowInsetBottom)}
            insets
        }
        setContentView(root)
        val nav=row()
        listOf("Home","Apps","News","Audio","Settings").forEach{n->nav.addView(button(n){showPage(n)},LinearLayout.LayoutParams(0,dp(48),1f))}
        root.addView(nav)
        body=column();root.addView(body,LinearLayout.LayoutParams(-1,0,1f))
        when(page){"Apps"->showApps();"News"->showNews();"Settings"->showSettings();"Audio"->audio.mount(body,fg,accent,surface);"Widgets"->showWidgets();else->showHome()}
        root.requestApplyInsets()
    }
    private fun title(s:String){body.addView(text(s,23f).apply{setTypeface(null,Typeface.BOLD)})}
    private fun search(hintText:String,value:String,onChanged:(String)->Unit)=EditText(this).apply{
        hint=hintText;setSingleLine();setTextColor(fg);setHintTextColor(accent);setText(value)
        setPadding(dp(12),dp(8),dp(12),dp(8))
        addTextChangedListener(object:TextWatcher{
            override fun beforeTextChanged(s:CharSequence?,start:Int,count:Int,after:Int){}
            override fun onTextChanged(s:CharSequence?,start:Int,before:Int,count:Int){onChanged(s.toString())}
            override fun afterTextChanged(s:Editable?){}
        })
    }
    private fun appRow(a:App):LinearLayout{
        val v=row().apply{minimumHeight=dp(58);setPadding(dp(8),dp(5),dp(8),dp(5))}
        if(theme!="Extreme"){
            val icon=ImageView(this).apply{
                scaleType=ImageView.ScaleType.FIT_CENTER
                try{setImageDrawable(packageManager.getApplicationIcon(a.pkg))}catch(_:Exception){setImageResource(android.R.drawable.sym_def_app_icon)}
                importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }
            v.addView(icon,LinearLayout.LayoutParams(dp(40),dp(40)))
        }
        val label=text(a.label,17f);v.addView(label,LinearLayout.LayoutParams(0,-2,1f))
        val pin=button(if(a.key in pinned)"★" else "☆"){
            if(!pinned.add(a.key))pinned.remove(a.key)
            prefs.edit().putStringSet("pins",pinned.toSet()).apply()
            if(page=="Home")showPage("Home")else renderAppRows()
        }
        pin.contentDescription="Toggle favorite "+a.label;v.addView(pin,LinearLayout.LayoutParams(dp(46),dp(46)))
        v.isClickable=true;v.isFocusable=true;v.contentDescription=a.label
        v.setOnClickListener{if(!support.launch(a.pkg,a.activity))Toast.makeText(this,"App unavailable",Toast.LENGTH_SHORT).show()}
        v.setOnLongClickListener{manage(a);true}
        return v
    }
    private fun manage(a:App){
        if(dialog?.isShowing==true)return
        val d=AppManagementActions.dialog(this,a.label){action->
            try{startActivity(AppManagementActions.intent(a.pkg,action))
                if(action=="storage")Toast.makeText(this,"Open Storage, then Clear cache",Toast.LENGTH_LONG).show()
                if(action=="force-stop")Toast.makeText(this,"Tap Force stop in App info",Toast.LENGTH_LONG).show()
            }catch(_:Exception){Toast.makeText(this,"Action not available",Toast.LENGTH_SHORT).show()}
        };dialog=d;d.setOnDismissListener{dialog=null};d.show()
    }
    private fun showHome(){
        if(theme=="Orbit"){showOrbit();return}
        clock=text(DateFormat.getTimeInstance(DateFormat.SHORT).format(Date()),48f)
        body.addView(clock);body.addView(text(DateFormat.getDateInstance(DateFormat.LONG).format(Date()),16f))
        val scroll=ScrollView(this);val content=column();scroll.addView(content);body.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
        fun section(name:String,list:List<App>){
            content.addView(text(name,13f).apply{setTextColor(accent)})
            if(list.isEmpty())content.addView(text("No apps yet",14f))
            list.forEach{content.addView(appRow(it))}
        }
        section("Favourites",apps.filter{it.key in pinned})
        section("Frequently used",apps.filter{it.days>=3&&it.key !in pinned}.sortedByDescending{it.score}.take(6))
        section("Recents",recents.take(8))
        val widgetColumn=column();content.addView(widgetColumn)
        widgetHost.attach(widgetColumn,theme,fg,accent,surface)
        body.addView(button("Find an app"){showPage("Apps")})
    }
    private fun showOrbit(){
        val stage=FrameLayout(this);body.addView(stage,LinearLayout.LayoutParams(-1,0,1f))
        val dial=NativeOrbitView(this,
            launch={item->if(!support.launch(item.pkg,item.activity))Toast.makeText(this,"App unavailable",Toast.LENGTH_SHORT).show()},
            manage={item->apps.firstOrNull{it.pkg==item.pkg&&it.activity==item.activity}?.let{manage(it)}},
            search={showPage("Apps");val field=body.getChildAt(1) as? EditText;field?.requestFocus();field?.post{(getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager).showSoftInput(field,android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT)}},
            widget={name->when(name){"News"->showPage("News");"Calendar"->{showPage("Audio");audio.select("agenda")};"Music"->{showPage("Audio");audio.select("music")};"Files"->openFiles()}},
            externalAction={showPage("Widgets")})
        dial.colors(fg,accent,surface)
        dial.data(apps.map{NativeOrbitView.App(it.pkg,it.activity,it.label)},recents.map{NativeOrbitView.App(it.pkg,it.activity,it.label)},widgetHost.orbitItems())
        stage.addView(dial,FrameLayout.LayoutParams(-1,-1))
        stage.addView(button("⚙"){showPage("Settings")},FrameLayout.LayoutParams(dp(48),dp(48),Gravity.TOP or Gravity.LEFT))
        orbitView=dial
    }
    private var orbitView:NativeOrbitView?=null
    private fun openFiles(){
        try{startActivity(Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*"))}
        catch(_:Exception){Toast.makeText(this,"No file picker available",Toast.LENGTH_SHORT).show()}
    }
    private fun showWidgets(){
        title("Android widgets");val scroll=ScrollView(this);val list=column();scroll.addView(list)
        body.addView(scroll,LinearLayout.LayoutParams(-1,0,1f));widgetHost.attach(list,theme,fg,accent,surface)
    }
    private fun showApps(){
        title("Applications");body.addView(search("Find installed apps",appQuery){appQuery=it;renderAppRows()})
        appList=ListView(this).apply{divider=null;isFastScrollEnabled=true}
        body.addView(appList,LinearLayout.LayoutParams(-1,0,1f));renderAppRows()
    }
    private fun renderAppRows(){
        val list=appList?:return
        val q=appQuery.trim()
        val filtered=apps.filter{it.label.contains(q,true)||it.pkg.contains(q,true)}.sortedWith(compareBy<App>{!it.label.startsWith(q,true)}.thenBy{it.label.lowercase()})
        list.adapter=object:BaseAdapter(){
            override fun getCount()=filtered.size
            override fun getItem(position:Int)=filtered[position]
            override fun getItemId(position:Int)=position.toLong()
            override fun getView(position:Int,convertView:View?,parent:ViewGroup)=appRow(filtered[position])
        }
    }
    private fun feeds()=(NativeNews.defaults+customFeeds).distinctBy{it.url}.filter{it.url !in removed}
    private fun showNews(){
        title("Audio news");body.addView(search("Search headlines",newsQuery){newsQuery=it;renderNewsRows()})
        val actions=row();actions.addView(button("Refresh"){refresh()},LinearLayout.LayoutParams(0,-2,1f))
        actions.addView(button("Sources"){showSources()},LinearLayout.LayoutParams(0,-2,1f))
        actions.addView(button("Google"){openUrl("https://www.google.com/search?q="+Uri.encode("latest audio news "+newsQuery))},LinearLayout.LayoutParams(0,-2,1f))
        body.addView(actions)
        val cats=listOf("All","Saved","REAPER","Plugin releases","DAWs & plugins","Post Production","Sound design","Sample packs","Hardware","Production","Videos")
        val spinner=Spinner(this);spinner.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,cats)
        spinner.setSelection(cats.indexOf(newsCategory).coerceAtLeast(0))
        spinner.onItemSelectedListener=object:AdapterView.OnItemSelectedListener{
            override fun onNothingSelected(parent:AdapterView<*>?){}
            override fun onItemSelected(parent:AdapterView<*>?,view:View?,position:Int,id:Long){newsCategory=cats[position];renderNewsRows()}
        };body.addView(spinner)
        newsStatus=text(if(refreshing)"Refreshing…" else "Cached headlines: "+stories.size,12f);body.addView(newsStatus)
        newsList=ListView(this);body.addView(newsList,LinearLayout.LayoutParams(-1,0,1f));renderNewsRows()
    }
    private fun renderNewsRows(){
        val list=newsList?:return
        val filtered=stories.filter{s->(newsCategory=="All"||newsCategory=="Saved"&&s.url in saved||s.category==newsCategory)&&s.title.contains(newsQuery,true)}
        list.adapter=object:BaseAdapter(){
            override fun getCount()=filtered.size
            override fun getItem(position:Int)=filtered[position]
            override fun getItemId(position:Int)=position.toLong()
            override fun getView(position:Int,convertView:View?,parent:ViewGroup):View{
                val s=filtered[position];val c=column()
                c.addView(text(s.title,17f));c.addView(text(s.source+" · "+s.category+if(s.date>0)" · "+DateFormat.getDateTimeInstance(DateFormat.SHORT,DateFormat.SHORT).format(Date(s.date)) else "",12f).apply{setTextColor(accent)})
                c.setOnClickListener{openUrl(s.url)}
                c.setOnLongClickListener{
                    AlertDialog.Builder(this@NativeLauncherActivity).setTitle(s.title).setItems(arrayOf(if(s.url in saved)"Remove bookmark" else "Save article")){_,_->if(!saved.add(s.url))saved.remove(s.url);prefs.edit().putStringSet("saved",saved.toSet()).apply();renderNewsRows()}.show();true
                }
                return c
            }
        }
    }
    private fun refresh(){
        if(refreshing)return
        val snapshot=feeds();if(snapshot.isEmpty())return
        refreshing=true;newsStatus?.text="Refreshing "+snapshot.size+" sources…"
        val result=mutableListOf<Story>();val status=mutableMapOf<String,String>()
        val remaining=java.util.concurrent.atomic.AtomicInteger(snapshot.size)
        snapshot.forEach{f->workers.execute{
            val data=try{val items=NativeNews.fetch(f);synchronized(status){status[f.url]=if(items.isEmpty())"No items" else "Accessible"};items}
                catch(e:Exception){synchronized(status){status[f.url]=e.message?.take(120)?:"Unavailable"};emptyList()}
            synchronized(result){result.addAll(data)}
            if(remaining.decrementAndGet()==0)runOnUiThread{
                if(destroyed)return@runOnUiThread
                refreshing=false;health.putAll(status)
                val allowed=feeds().map{it.name}.toSet()
                stories=NativeNews.ordered((result+stories).filter{it.source in allowed})
                prefs.edit().putString("news",NativeNews.encode(stories)).apply()
                newsStatus?.text="Refreshed · "+stories.size+" headlines";renderNewsRows()
            }
        }}
    }
    private fun showSources(){
        val all=feeds();val labels=all.map{it.name+" — "+(health[it.url]?:"Not checked")}.toTypedArray()
        AlertDialog.Builder(this).setTitle("News sources").setItems(labels){_,which->
            val f=all[which]
            AlertDialog.Builder(this).setTitle(f.name).setMessage(f.url).setNegativeButton("Close",null).setPositiveButton("Remove"){_,_->removed.add(f.url);prefs.edit().putStringSet("removed",removed.toSet()).apply();stories=stories.filter{it.source!=f.name};prefs.edit().putString("news",NativeNews.encode(stories)).apply();renderNewsRows()}.show()
        }.setPositiveButton("Add RSS / Atom"){_,_->addFeed()}.setNegativeButton("Close",null).show()
    }
    private fun addFeed(){
        val input=EditText(this).apply{hint="https://publisher.com/feed/";inputType=android.text.InputType.TYPE_TEXT_VARIATION_URI or android.text.InputType.TYPE_CLASS_TEXT}
        AlertDialog.Builder(this).setTitle("Add public feed").setView(input).setNegativeButton("Cancel",null).setPositiveButton("Verify"){_,_->
            val raw=input.text.toString().trim();if(feeds().any{it.url==raw})return@setPositiveButton
            workers.execute{
                try{
                    val host=java.net.URL(raw).host
                    val f=Feed(host,raw,"Production");val items=NativeNews.fetch(f)
                    if(items.isEmpty())error("No readable entries")
                    runOnUiThread{if(!destroyed){
                        customFeeds=(customFeeds+f).distinctBy{it.url};removed.remove(raw)
                        val a=JSONArray();customFeeds.forEach{a.put(org.json.JSONObject().put("name",it.name).put("url",it.url).put("category",it.category))}
                        prefs.edit().putString("feeds",a.toString()).putStringSet("removed",removed.toSet()).apply()
                        stories=NativeNews.ordered(items+stories);prefs.edit().putString("news",NativeNews.encode(stories)).apply();renderNewsRows()
                        Toast.makeText(this,"Feed added",Toast.LENGTH_SHORT).show()
                    }}
                }catch(_:Exception){runOnUiThread{if(!destroyed)Toast.makeText(this,"Feed could not be verified",Toast.LENGTH_LONG).show()}}
            }
        }.show()
    }
    private fun showSettings(){
        title("Native preview")
        body.addView(text("This is a separate HTML-free development build, not the complete Audio Desk replacement.",14f))
        body.addView(button("Default home app"){support.requestDefaultHome()})
        body.addView(text("Appearance",14f))
        listOf("Minimal","Warm","Pixel","Tiles","Orbit","Extreme").forEach{t->body.addView(button(if(t==theme)"✓ "+t else t){theme=t;prefs.edit().putString("theme",t).apply();showPage("Settings")})}
    }
    private fun openUrl(url:String){try{
        val uri=Uri.parse(url);if(uri.scheme!="https"&&uri.scheme!="http")return
        startActivity(Intent(Intent.ACTION_VIEW,uri))
    }catch(_:Exception){Toast.makeText(this,"No browser available",Toast.LENGTH_SHORT).show()}}
    @Deprecated("Android back") override fun onBackPressed(){if(page!="Home")showPage("Home")}
    override fun onPause(){if(::audio.isInitialized)audio.pause();if(::widgetHost.isInitialized)widgetHost.pause();super.onPause()}
    @Deprecated("Android activity result")
    override fun onActivityResult(requestCode:Int,resultCode:Int,data:Intent?){
        if(!widgetHost.result(requestCode,resultCode)&&!audio.result(requestCode,resultCode,data))super.onActivityResult(requestCode,resultCode,data)
    }
    override fun onRequestPermissionsResult(requestCode:Int,permissions:Array<out String>,grantResults:IntArray){
        super.onRequestPermissionsResult(requestCode,permissions,grantResults);audio.permissions(requestCode)
    }
    override fun onDestroy(){destroyed=true;audio.close();widgetHost.close();dialog?.dismiss();handler.removeCallbacks(ticker);workers.shutdownNow();support.close();super.onDestroy()}
}
