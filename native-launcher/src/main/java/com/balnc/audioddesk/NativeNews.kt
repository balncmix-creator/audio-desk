package com.balnc.audioddesk

import android.util.Xml
import org.xmlpull.v1.XmlPullParser
import org.json.JSONArray
import org.json.JSONObject
import java.io.InputStream
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.URL
import java.net.InetAddress
import java.net.HttpURLConnection
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

internal data class Feed(val name:String,val url:String,val category:String)
internal data class Story(val title:String,val url:String,val source:String,val category:String,val date:Long)
internal object NativeNews {
    val defaults = listOf(
        Feed("KVR Audio — Top Stories","https://www.kvraudio.com/rss/kvr_news_top.rss","DAWs & plugins"),
        Feed("KVR Audio — New Plugins","https://www.kvraudio.com/rss/kvr_latestindb.rss","DAWs & plugins"),
        Feed("Global — New audio plugin releases","https://news.google.com/rss/search?q=(new+audio+plugin+OR+VST+plugin+released+OR+AU+plugin+released+OR+AAX+plugin+released+OR+CLAP+plugin+released)&hl=en-US&gl=US&ceid=US:en","Plugin releases"),
        Feed("Global — Plugin developer announcements","https://news.google.com/rss/search?q=(audio+plugin+developer+OR+plugin+manufacturer)+(launch+OR+release+OR+announces+OR+update)&hl=en-US&gl=US&ceid=US:en","Plugin releases"),
        Feed("Global — Audio software product launches","https://news.google.com/rss/search?q=(audio+software+OR+sound+design+plugin+OR+mixing+plugin)+(new+OR+launches+OR+released)&hl=en-US&gl=US&ceid=US:en","Plugin releases"),
        Feed("HAL Audio — Company news","https://news.google.com/rss/search?q=%22HAL+Audio%22+(plugin+OR+software+OR+release+OR+launch)&hl=en-US&gl=US&ceid=US:en","Plugin releases"),
        Feed("Audiofanzine — Plugin and software news","https://news.google.com/rss/search?q=site%3Aaudiofanzine.com+(plugin+OR+plug-in)+news&hl=en-US&gl=US&ceid=US:en","Plugin releases"),
        Feed("A Sound Effect","https://www.asoundeffect.com/feed/","Sound design"),
        Feed("Rekkerd — Audio plugins & samples","https://rekkerd.org/feed/","Plugin releases"),
        Feed("Bedroom Producers Blog","https://bedroomproducersblog.com/feed/","Plugin releases"),
        Feed("Mix — Professional audio","https://news.google.com/rss/search?q=site%3Amixonline.com+(audio+OR+post+OR+immersive)&hl=en-US&gl=US&ceid=US:en","Post Production"),
        Feed("postPerspective — Film & TV audio","https://news.google.com/rss/search?q=site%3Apostperspective.com+(audio+OR+sound+OR+mixing)&hl=en-US&gl=US&ceid=US:en","Post Production"),
        Feed("Sonic State — Product releases","https://news.google.com/rss/search?q=site%3Asonicstate.com+(plugin+OR+synth+OR+audio)&hl=en-US&gl=US&ceid=US:en","Plugin releases"),
        Feed("Gearspace — New Product Alert","https://news.google.com/rss/search?q=site%3Agearspace.com%2Fforums%2Fnew-product-alert+(plugin+OR+audio+OR+software)&hl=en-US&gl=US&ceid=US:en","Plugin releases"),
        Feed("Reapertips — Scripts & REAPER","https://news.google.com/rss/search?q=site%3Areapertips.com+(REAPER+OR+script+OR+ReaScript)&hl=en-US&gl=US&ceid=US:en","REAPER"),
        Feed("Sample Library Review","https://news.google.com/rss/search?q=site%3Asamplelibraryreview.com+(sample+library+OR+Kontakt+OR+instrument)&hl=en-US&gl=US&ceid=US:en","Sample packs"),
        Feed("VI-Control — Sample libraries","https://news.google.com/rss/search?q=site%3Avi-control.net%2Fcommunity+(sample+library+OR+new+instrument)&hl=en-US&gl=US&ceid=US:en","Sample packs"),
        Feed("Sound On Sound","https://www.soundonsound.com/latest_news.xml","Production"),
        Feed("MuseHub — Official news and tutorials","https://news.google.com/rss/search?q=site%3Ablog.musehub.com+OR+site%3Amusehub.com%2Flearn&hl=en-US&gl=US&ceid=US:en","Production"),
        Feed("Audio Plugin Guy — Plugin news and reviews","https://news.google.com/rss/search?q=site%3Aaudiopluginguy.com&hl=en-US&gl=US&ceid=US:en","DAWs & plugins"),
        Feed("ProSoundWeb — Professional audio news","https://news.google.com/rss/search?q=site%3Aprosoundweb.com&hl=en-US&gl=US&ceid=US:en","Production"),
        Feed("The REAPER Blog","https://reaper.blog/feed/","REAPER"),
        Feed("Attack Magazine","https://attackmagazine.com/feed/","Production"),
        Feed("audioXpress","https://audioxpress.com/rss","Hardware"),
        Feed("SonicScoop","https://sonicscoop.com/feed/","Production"),
        Feed("Pro Sound Effects","https://blog.prosoundeffects.com/rss.xml","Sound design"),
        Feed("SoundGirls","https://soundgirls.org/feed/","Post Production"),
        Feed("Production Expert — Post Production","https://www.production-expert.com/production-expert-1?format=rss","Post Production"),
        Feed("Google News — Audio post & film sound","https://news.google.com/rss/search?q=audio+post+production+OR+film+sound+OR+dialogue+editing&hl=en-US&gl=US&ceid=US:en","Post Production"),
        Feed("POST RADAR — Film & TV audio post-production","https://news.google.com/rss/search?q=(audio+post+production+OR+film+sound+post+production+OR+TV+audio+post+OR+film+mixing)&hl=en-US&gl=US&ceid=US:en","Post Production"),
        Feed("POST RADAR — Dialogue editing, ADR & dubbing","https://news.google.com/rss/search?q=(dialogue+editing+OR+ADR+recording+OR+film+dubbing+OR+voice+over+post+production)&hl=en-US&gl=US&ceid=US:en","Post Production"),
        Feed("POST RADAR — Foley & sound effects","https://news.google.com/rss/search?q=(foley+recording+OR+foley+artist+OR+film+sound+effects+OR+sound+editor)&hl=en-US&gl=US&ceid=US:en","Post Production"),
        Feed("POST RADAR — Dolby Atmos & immersive mixing","https://news.google.com/rss/search?q=(Dolby+Atmos+post+production+OR+Atmos+mixing+OR+ADM+BWF+OR+Dolby+Atmos+renderer)&hl=en-US&gl=US&ceid=US:en","Post Production"),
        Feed("POST RADAR — Spatial audio & Ambisonics","https://news.google.com/rss/search?q=(spatial+audio+post+production+OR+immersive+audio+mixing+OR+Ambisonics+plugin+OR+object+based+audio)&hl=en-US&gl=US&ceid=US:en","Post Production"),
        Feed("POST RADAR — Surround & immersive plugins","https://news.google.com/rss/search?q=(surround+sound+plugin+OR+immersive+audio+plugin+OR+Dolby+Atmos+plugin+OR+multichannel+audio+plugin)&hl=en-US&gl=US&ceid=US:en","Post Production"),
        Feed("POST RADAR — Post-production DAWs & workflows","https://news.google.com/rss/search?q=(Pro+Tools+OR+Nuendo+OR+Pyramix+OR+Sequoia+OR+DaVinci+Resolve+Fairlight)+(audio+post+OR+update+OR+release)&hl=en-US&gl=US&ceid=US:en","Post Production"),
        Feed("POST RADAR — Audio restoration, dialogue cleanup & AI","https://news.google.com/rss/search?q=(dialogue+isolation+OR+audio+restoration+OR+production+sound+cleanup+OR+AI+dialogue+editing)&hl=en-US&gl=US&ceid=US:en","Post Production"),
        Feed("POST RADAR — Broadcast loudness, QC & delivery","https://news.google.com/rss/search?q=(EBU+R128+OR+ATSC+A+85+OR+audio+QC+OR+broadcast+loudness+OR+ADM+delivery)&hl=en-US&gl=US&ceid=US:en","Post Production"),
        Feed("Dolby — Atmos & professional audio news","https://news.google.com/rss/search?q=site%3Adolby.com+(Dolby+Atmos+OR+professional+audio+OR+post+production)&hl=en-US&gl=US&ceid=US:en","Post Production"),
        Feed("AudioXpress — Immersive and professional audio","https://news.google.com/rss/search?q=site%3Aaudioxpress.com+(Dolby+Atmos+OR+spatial+audio+OR+immersive+audio)&hl=en-US&gl=US&ceid=US:en","Post Production"),
        Feed("Google News — AI audio tools","https://news.google.com/rss/search?q=AI+audio+tools+OR+audio+plugin+OR+audio+software&hl=en-US&gl=US&ceid=US:en","Sound design"),
        Feed("YouTube — Latest audio plugins, DAWs & sound design videos","https://news.google.com/rss/search?q=site%3Ayoutube.com%2Fwatch+(audio+plugin+OR+VST+OR+AU+plugin+OR+DAW+OR+REAPER+OR+Pro+Tools+OR+Nuendo+OR+sound+design+OR+mixing+OR+mastering)&hl=en-US&gl=US&ceid=US:en","Videos"),
        Feed("Cockos — REAPER Pre-Release forum","https://forum.cockos.com/external.php?type=RSS2&forumids=22","REAPER"),
        Feed("Cockos forum — REAPER scripts & development","https://news.google.com/rss/search?q=site%3Aforum.cockos.com+REAPER+(script+OR+ReaScript+OR+pre-release)&hl=en-US&gl=US&ceid=US:en","REAPER"),
        Feed("GitHub — ReaTeam ReaScripts commits","https://github.com/ReaTeam/ReaScripts/commits/master.atom","REAPER"),
        Feed("GitHub — X-Raym ReaScripts commits","https://github.com/X-Raym/REAPER-ReaScripts/commits/master.atom","REAPER"),
        Feed("GitHub — Reapertips ReaScripts commits","https://github.com/Reapertips/ReaScripts/commits/main.atom","REAPER"),
        Feed("GitHub — BirdBird ReaScript Testing commits","https://github.com/Bird-Bird/ReaScript_Testing/commits/main.atom","REAPER"),
        Feed("GitHub — MPL ReaScripts commits","https://github.com/MichaelPilyavskiy/ReaScripts/commits/master.atom","REAPER"),
        Feed("Google News — new REAPER scripts on GitHub","https://news.google.com/rss/search?q=(REAPER+OR+ReaScript)+GitHub+(script+OR+ReaPack)&hl=en-US&gl=US&ceid=US:en","REAPER")
    )
    fun urlAllowed(raw:String):Boolean = try {
        val u=URL(raw)
        u.protocol=="https" && u.userInfo==null && (u.port==-1||u.port==443) && u.host.contains(".") &&
            InetAddress.getAllByName(u.host).all { a ->
                val b=a.address
                !a.isAnyLocalAddress && !a.isLoopbackAddress && !a.isLinkLocalAddress && !a.isSiteLocalAddress && !a.isMulticastAddress &&
                !(b.size==16 && (b[0].toInt() and 0xfe)==0xfc) &&
                !(b.size==4 && ((b[0].toInt() and 255)==100 && (b[1].toInt() and 192)==64))
            }
    } catch (_:Exception){false}
    fun date(raw:String):Long {
        val patterns=listOf("EEE, dd MMM yyyy HH:mm:ss Z","EEE, dd MMM yyyy HH:mm:ss z","yyyy-MM-dd'T'HH:mm:ss.SSSXXX","yyyy-MM-dd'T'HH:mm:ssXXX","yyyy-MM-dd HH:mm:ss","yyyy-MM-dd")
        for(p in patterns)try {
            val parser=SimpleDateFormat(p,Locale.US)
            parser.isLenient=false;parser.timeZone=TimeZone.getTimeZone("UTC")
            val pos=java.text.ParsePosition(0)
            val value=parser.parse(raw.trim(),pos)
            if(value!=null&&pos.index==raw.trim().length&&value.time<=System.currentTimeMillis())return value.time
        }catch(_:Exception){}
        return 0
    }
    fun category(title:String, fallback:String):String {
        val t=title.lowercase(Locale.ROOT)
        fun has(s:String)=Regex(s,RegexOption.IGNORE_CASE).containsMatchIn(t)
        return when {
            fallback=="Videos" -> "Videos"
            has("""\b(reascript|reapack|reaper)\b""") -> "REAPER"
            has("""\b(sample packs?|sample librar(?:y|ies)|sound packs?|kontakt librar(?:y|ies))\b""") -> "Sample packs"
            has("""\b(microphone|audio interface|studio monitors?|headphones?)\b""") && !has("""\b(emulation|plugin|plug-in)\b""") -> "Hardware"
            has("""\b(plugin|plug-in|vst3?|aax|clap)\b""") && has("""\b(new|launch|release|released|announces|update|introduces)\b""") -> "Plugin releases"
            has("""\b(foley|sound design|sound effects?)\b""") -> "Sound design"
            has("""\b(dialogue|adr|dubbing|film sound|post.production|atmos|immersive)\b""") -> "Post Production"
            has("""\b(daw|plugin|plug-in|vst3?|aax|pro tools|nuendo)\b""") -> "DAWs & plugins"
            else -> fallback
        }
    }
    fun parse(input:InputStream,feed:Feed):List<Story> {
        val parser=Xml.newPullParser()
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_DOCDECL,false)
        parser.setInput(input,null)
        val result=mutableListOf<Story>()
        var inItem=false
        var itemDepth=0
        var field=""
        var title="";var link="";var published="";var updated=""
        while(parser.eventType!=XmlPullParser.END_DOCUMENT && result.size<80){
            when(parser.eventType){
                XmlPullParser.DOCDECL -> throw IllegalArgumentException("External declarations are not accepted")
                XmlPullParser.START_TAG -> {
                    val tag=parser.name.lowercase(Locale.ROOT)
                    if(!inItem && (tag=="item"||tag=="entry")){
                        inItem=true;itemDepth=parser.depth;field="";title="";link="";published="";updated=""
                    }else if(inItem&&parser.depth==itemDepth+1){
                        field=tag
                        if(tag=="link"){
                            val href=parser.getAttributeValue(null,"href")
                            val rel=parser.getAttributeValue(null,"rel")
                            if(!href.isNullOrBlank()&&(rel==null||rel=="alternate"))link=href
                        }
                    }
                }
                XmlPullParser.TEXT,XmlPullParser.CDSECT -> if(inItem){
                    val value=parser.text.orEmpty()
                    when(field){
                        "title" -> title=(title+value).take(500)
                        "link" -> if(link.length<2048)link+=value
                        "pubdate","published","date" -> published=(published+value).take(150)
                        "updated" -> updated=(updated+value).take(150)
                    }
                }
                XmlPullParser.END_TAG -> {
                    if(inItem&&parser.depth==itemDepth){
                        val u=try{URL(URL(feed.url),link.trim()).toString()}catch(_:Exception){""}
                        if(title.isNotBlank()&&link.isNotBlank()&&u.startsWith("https://"))
                            result.add(Story(title.trim(),u,feed.name,category(title,feed.category),date(published.ifBlank{updated})))
                        inItem=false
                    }else if(inItem&&parser.depth==itemDepth+1)field=""
                }
            }
            parser.nextToken()
        }
        return result
    }
    fun fetch(feed:Feed):List<Story> {
        var raw=feed.url
        repeat(4){
            if(!urlAllowed(raw))throw IllegalArgumentException("Not a public HTTPS feed")
            val c=URL(raw).openConnection() as HttpURLConnection
            try {
                c.connectTimeout=3500;c.readTimeout=3500;c.instanceFollowRedirects=false
                c.setRequestProperty("User-Agent","AudioDeskNative/1.0")
                c.setRequestProperty("Accept","application/rss+xml,application/atom+xml,application/xml,text/xml")
                when(val code=c.responseCode){
                    301,302,303,307,308 -> {raw=URL(URL(raw),c.getHeaderField("Location")?:error("Redirect missing")).toString();return@repeat}
                    200 -> {
                        val out=ByteArrayOutputStream()
                        c.inputStream.use { input ->
                            val buffer=ByteArray(8192)
                            while(true){val n=input.read(buffer);if(n<0)break
                                if(out.size()+n>2_000_000)throw IllegalArgumentException("Feed too large")
                                out.write(buffer,0,n)
                            }
                        }
                        return parse(ByteArrayInputStream(out.toByteArray()),feed)
                    }
                    else -> throw IllegalStateException("HTTP "+code)
                }
            }finally{c.disconnect()}
        }
        error("Too many redirects")
    }
    fun ordered(items:List<Story>)=items.sortedByDescending{it.date}.distinctBy{it.url}.take(500)
    fun encode(items:List<Story>)=JSONArray().apply{items.forEach{s->put(JSONObject().put("title",s.title).put("url",s.url).put("source",s.source).put("category",s.category).put("date",s.date))}}.toString()
    fun decode(raw:String):List<Story> = try{
        val a=JSONArray(raw);(0 until minOf(a.length(),500)).mapNotNull{i->a.optJSONObject(i)?.let{j->Story(j.optString("title"),j.optString("url"),j.optString("source"),j.optString("category"),j.optLong("date"))}}
    }catch(_:Exception){emptyList()}
}
