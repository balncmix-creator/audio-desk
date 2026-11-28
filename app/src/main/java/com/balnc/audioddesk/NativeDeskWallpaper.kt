package com.balnc.audioddesk

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/** Local asset/picked-image manager; decode off main, no remote requests. */
internal class NativeDeskWallpaper(private val activity:Activity){
    private val worker=Executors.newSingleThreadExecutor()
    private val generation=AtomicInteger()
    private val prefs=activity.getSharedPreferences("native_desk",0)
    private var closed=false
    val bundled:List<String> get()=activity.assets.list("wallpapers").orEmpty()
        .filter{it.endsWith(".webp")}.sorted()
    fun selection()=prefs.getString("wallpaper","").orEmpty()
    fun select(value:String){prefs.edit().putString("wallpaper",value).apply()}
    fun load(value:String,callback:(Bitmap?,Int?)->Unit){
        val token=generation.incrementAndGet()
        if(closed)return
        worker.execute{
            var bitmap:Bitmap?=null
            try{
                fun open()=if(value.startsWith("content:"))activity.contentResolver.openInputStream(Uri.parse(value))
                    else if(value in bundled)activity.assets.open("wallpapers/"+value)else null
                val opts=BitmapFactory.Options().apply{inJustDecodeBounds=true}
                open()?.use{BitmapFactory.decodeStream(it,null,opts)}
                if(opts.outWidth>0&&opts.outHeight>0){
                    var sample=1
                    while(maxOf(opts.outWidth,opts.outHeight)/sample>2048)sample*=2
                    bitmap=open()?.use{BitmapFactory.decodeStream(it,null,BitmapFactory.Options().apply{inSampleSize=sample})}
                }
            }catch(_:Exception){}
            val b=bitmap
            val accent=b?.let{
                var r=0L;var g=0L;var blue=0L;var n=0
                for(y in 1..7)for(x in 1..5){val c=it.getPixel(x*(it.width-1)/6,y*(it.height-1)/8);r+=Color.red(c);g+=Color.green(c);blue+=Color.blue(c);n++}
                Color.rgb((r/n).toInt(),(g/n).toInt(),(blue/n).toInt())
            }
            activity.runOnUiThread{
                if(closed||token!=generation.get())b?.recycle()else callback(b,accent)
            }
        }
    }
    fun close(){closed=true;generation.incrementAndGet();worker.shutdownNow()}
}
