package com.balnc.audioddesk

import android.app.Dialog
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.net.Uri
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.Window
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONObject
import kotlin.math.roundToInt
import kotlin.math.pow

/** Real native dialog, sharing the launcher's current theme colours.
 * All destructive operations remain Android-owned confirmation flows. */
internal object AppManagementActions {
    val labels = arrayOf("App info", "Clear cache", "Force stop", "Uninstall")
    private val actions = listOf("info", "storage", "force-stop", "uninstall")
    fun validPackage(pkg: String) = pkg.length in 4..160 && '.' in pkg &&
        pkg.all { it.isLetterOrDigit() || it == '.' || it == '_' }
    fun validAction(action: String) = action in actions || action == "settings"
    fun intent(pkg: String, action: String): Intent {
        require(validPackage(pkg) && validAction(action))
        val uri = Uri.parse("package:" + pkg)
        return if (action == "uninstall") Intent(Intent.ACTION_DELETE, uri)
        else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, uri)
    }

    data class Palette(val dark:Int,val panel:Int,val ink:Int,val accent:Int,val muted:Int,val line:Int,val danger:Int,val theme:String,val radius:Float)
    private fun blend(a:Int,b:Int,f:Float):Int = Color.rgb(
        (Color.red(a)*(1-f)+Color.red(b)*f).roundToInt(),
        (Color.green(a)*(1-f)+Color.green(b)*f).roundToInt(),
        (Color.blue(a)*(1-f)+Color.blue(b)*f).roundToInt())
    private fun luminance(color:Int):Double {
        fun linear(v:Int):Double {val c=v/255.0;return if(c<=.04045)c/12.92 else ((c+.055)/1.055).pow(2.4)}
        return .2126*linear(Color.red(color))+.7152*linear(Color.green(color))+.0722*linear(Color.blue(color))
    }
    fun contrast(a:Int,b:Int):Double {
        val x=luminance(a);val y=luminance(b)
        return (maxOf(x,y)+.05)/(minOf(x,y)+.05)
    }
    private fun readable(value:Int,background:Int,target:Double=4.5):Int {
        if(contrast(value,background)>=target)return value
        val end=if(contrast(Color.WHITE,background)>contrast(Color.BLACK,background))Color.WHITE else Color.BLACK
        for(i in 1..20){val v=blend(value,end,i/20f);if(contrast(v,background)>=target)return v}
        return end
    }
    fun palette(json:String=""):Palette {
        val j=try{if(json.length<=512)JSONObject(json)else JSONObject()}catch(_:Exception){JSONObject()}
        fun color(key:String,default:String):Int {
            val s=j.optString(key).trim()
            return Color.parseColor(if(s.matches(Regex("^#[0-9a-fA-F]{6}$")))s else default)
        }
        val theme=j.optString("theme").takeIf{it in listOf("warm","orbit","minimal","pixel","windows","extreme")} ?: "orbit"
        val radius=when(theme){"pixel"->2f;"windows","extreme"->0f;"minimal"->14f;else->21f}
        val dark=color("dark","#141a17")
        val accent=color("accent","#bcdac2")
        // Use the same native-compatible surface sampled by the theme layer;
        // slight lift matches the approved compact popup rather than a full sheet.
        val panel=color("panel","#29382f")
        val ink=readable(color("text","#e1ece3"),panel)
        return Palette(dark,panel,ink,readable(accent,panel),readable(blend(ink,panel,.35f),panel),
            blend(panel,ink,.12f),readable(Color.rgb(241,169,166),panel),theme,radius)
    }
    private fun dp(c:Context,n:Float)=(n*c.resources.displayMetrics.density).roundToInt()
    private fun rounded(c:Context,color:Int,r:Float,stroke:Int?=null)=GradientDrawable().apply{
        setColor(color);cornerRadius=dp(c,r).toFloat()
        if(stroke!=null)setStroke(dp(c,1f).coerceAtLeast(1),stroke)
    }
    private fun ripple(c:Context,p:Palette,r:Float)=RippleDrawable(
        ColorStateList.valueOf(blend(p.panel,p.ink,.13f)),
        rounded(c,Color.TRANSPARENT,r),rounded(c,Color.WHITE,r))
    private fun text(c:Context,label:CharSequence,size:Float,color:Int)=TextView(c).apply{
        text=label;textSize=size;setTextColor(color);gravity=Gravity.CENTER_VERTICAL
    }
    private fun divider(c:Context,p:Palette)=View(c).apply{
        setBackgroundColor(p.line);layoutParams=LinearLayout.LayoutParams(-1,dp(c,1f).coerceAtLeast(1))
    }
    private class ActionGlyph(c:Context,private val key:String,private val tint:Int):View(c){
        private val paint=Paint(Paint.ANTI_ALIAS_FLAG).apply{style=Paint.Style.STROKE;strokeCap=Paint.Cap.ROUND;strokeJoin=Paint.Join.ROUND;strokeWidth=1.65f;color=tint}
        private val path=Path()
        override fun onDraw(canvas:Canvas){
            val side=minOf(width,height)/24f
            canvas.save();canvas.translate((width-24*side)/2,(height-24*side)/2);canvas.scale(side,side)
            fun line(x:Float,y:Float,u:Float,v:Float)=canvas.drawLine(x,y,u,v,paint)
            fun poly(vararg coords:Float){path.reset();path.moveTo(coords[0],coords[1]);var i=2;while(i<coords.size){path.lineTo(coords[i],coords[i+1]);i+=2};canvas.drawPath(path,paint)}
            when(key){
                "info"->{canvas.drawCircle(12f,12f,9f,paint);line(12f,11f,12f,17f);line(12f,7f,12f,7.1f)}
                "storage"->{poly(4f,17f,14f,7f,20f,13f,12f,21f,8f,21f,4f,17f);line(10f,11f,17f,18f)}
                "force-stop"->{canvas.drawCircle(12f,12f,9f,paint);canvas.drawRoundRect(RectF(9f,9f,15f,15f),1f,1f,paint)}
                "uninstall"->{line(4f,6f,20f,6f);poly(9f,6f,9f,3f,15f,3f,15f,6f);poly(6f,6f,7f,21f,17f,21f,18f,6f);line(10f,10f,10f,17f);line(14f,10f,14f,17f)}
            }
            canvas.restore()
        }
    }

    fun dialog(context: Context, title: CharSequence, icon:Drawable?=null, colors:Palette=palette(), select: (String) -> Unit): Dialog {
        val c=context;val p=colors
        val font=if(p.theme=="pixel") try{Typeface.createFromAsset(c.assets,"fonts/silkscreen-regular.ttf")}catch(_:Exception){Typeface.MONOSPACE} else Typeface.create(if(p.theme=="windows")"sans-serif-light" else "sans-serif",Typeface.NORMAL)
        val d=Dialog(c)
        d.requestWindowFeature(Window.FEATURE_NO_TITLE)
        val scroll=ScrollView(c).apply {
            isFillViewport=false;isVerticalScrollBarEnabled=false
            overScrollMode=View.OVER_SCROLL_IF_CONTENT_SCROLLS
            background=rounded(c,p.panel,p.radius,p.line)
            clipToOutline=true
        }
        val root=LinearLayout(c).apply{
            orientation=LinearLayout.VERTICAL;setPadding(dp(c,9f),dp(c,9f),dp(c,9f),dp(c,5f))
        }
        val header=LinearLayout(c).apply{
            orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL
            setPadding(dp(c,10f),dp(c,10f),dp(c,10f),dp(c,13f))
        }
        val tile=ImageView(c).apply{
            background=rounded(c,p.dark,minOf(13f,p.radius))
            setPadding(dp(c,6f),dp(c,6f),dp(c,6f),dp(c,6f))
            scaleType=ImageView.ScaleType.FIT_CENTER
            if(icon!=null)setImageDrawable(icon) else setImageResource(android.R.drawable.sym_def_app_icon)
            importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        header.addView(tile,LinearLayout.LayoutParams(dp(c,42f),dp(c,42f)))
        val titles=LinearLayout(c).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(c,12f),0,0,0)}
        titles.addView(text(c,title,17f,p.ink).apply{typeface=if(p.theme=="pixel"||p.theme=="windows")font else Typeface.create("sans-serif-medium",Typeface.NORMAL);maxLines=2;ellipsize=android.text.TextUtils.TruncateAt.END})
        titles.addView(text(c,"Application settings",11f,p.muted).apply{typeface=font;setPadding(0,dp(c,3f),0,0)})
        header.addView(titles,LinearLayout.LayoutParams(0,-2,1f))
        root.addView(header,LinearLayout.LayoutParams(-1,-2))
        root.addView(divider(c,p))
        for(i in actions.indices){
            val key=actions[i];val color=if(key=="uninstall")p.danger else p.ink
            val row=LinearLayout(c).apply{
                orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL
                minimumHeight=dp(c,48f);setPadding(dp(c,13f),dp(c,10f),dp(c,13f),dp(c,10f))
                background=ripple(c,p,minOf(12f,p.radius));isClickable=true;isFocusable=true
                contentDescription=labels[i];tag=key
                accessibilityDelegate=object:View.AccessibilityDelegate(){
                    override fun onInitializeAccessibilityNodeInfo(host:View,info:android.view.accessibility.AccessibilityNodeInfo){
                        super.onInitializeAccessibilityNodeInfo(host,info);info.className="android.widget.Button"
                    }
                }
                setOnClickListener{if(d.isShowing){d.dismiss();select(key)}}
            }
            val glyph=ActionGlyph(c,key,if(key=="uninstall")p.danger else p.accent).apply{importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO}
            row.addView(glyph,LinearLayout.LayoutParams(dp(c,20f),dp(c,20f)))
            row.addView(text(c,labels[i],14f,color).apply{
                typeface=font;setPadding(dp(c,15f),0,0,0);importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
            },LinearLayout.LayoutParams(0,-2,1f))
            root.addView(row,LinearLayout.LayoutParams(-1,-2))
        }
        root.addView(divider(c,p))
        root.addView(text(c,"Cancel",13f,p.muted).apply{
            typeface=font;gravity=Gravity.CENTER;minimumHeight=dp(c,48f);tag="cancel"
            background=ripple(c,p,minOf(12f,p.radius));isFocusable=true;isClickable=true
            setOnClickListener{d.cancel()}
        },LinearLayout.LayoutParams(-1,-2))
        scroll.addView(root,android.widget.FrameLayout.LayoutParams(-1,-2))
        d.setContentView(scroll)
        d.setCancelable(true);d.setCanceledOnTouchOutside(true)
        d.setOnShowListener{
            d.window?.apply{
                setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
                addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
                setDimAmount(.42f)
                // Single native fade; no realtime blur or background bitmaps.
                setWindowAnimations(android.R.style.Animation_Dialog)
                val screen=c.resources.displayMetrics
                setLayout(minOf(dp(c,280f),(screen.widthPixels-dp(c,36f)).coerceAtLeast(1)),WindowManager.LayoutParams.WRAP_CONTENT)
                setGravity(Gravity.CENTER)
            }
        }
        return d
    }
}
