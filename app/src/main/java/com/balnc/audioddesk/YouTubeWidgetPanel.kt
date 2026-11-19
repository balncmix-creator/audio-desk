package com.balnc.audioddesk

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.browser.customtabs.CustomTabsIntent
import org.json.JSONObject
import kotlin.math.roundToInt

/** Public YouTube page, isolated from the trusted launcher JavaScript bridge.
 * The signed-in Google session remains in the user's browser. */
internal class YouTubeWidgetPanel(private val activity: Activity, private val launcher: WebView) {
    private val root get() = activity.findViewById<FrameLayout>(android.R.id.content)
    private var container: FrameLayout? = null
    private var web: WebView? = null
    private var pending: String? = null
    private var current = "https://m.youtube.com/"
    private var showing = false

    private fun trusted(uri: Uri): Boolean =
        uri.scheme == "https" && uri.host in setOf("m.youtube.com", "www.youtube.com", "youtube.com")
            && uri.path?.startsWith("/signin") != true && uri.path?.startsWith("/account") != true

    private fun external(uri: Uri) {
        if (uri.scheme != "https") return
        try { CustomTabsIntent.Builder().build().launchUrl(activity, uri) }
        catch (_: Exception) { try { activity.startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: Exception) {} }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun ensure(): WebView {
        web?.let { return it }
        val holder = FrameLayout(activity).apply {
            clipChildren = true
            clipToPadding = true
            visibility = View.GONE
        }
        val page = WebView(activity).apply {
            setBackgroundColor(Color.BLACK)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.mediaPlaybackRequiresUserGesture = true
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.setSupportMultipleWindows(false)
            android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    if (!request.isForMainFrame) return false
                    val uri = request.url
                    if (trusted(uri)) return false
                    if (request.hasGesture()) external(uri)
                    return true
                }
                override fun onPageFinished(view: WebView, url: String?) {
                    if (url != null && trusted(Uri.parse(url))) current = url
                }
            }
        }
        holder.addView(page, FrameLayout.LayoutParams(1, 1))
        root.addView(holder, FrameLayout.LayoutParams(1, 1))
        container = holder
        web = page
        return page
    }

    fun navigate(destination: String, query: String) {
        val target = when (destination) {
            "home" -> "https://m.youtube.com/"
            "search" -> {
                val q = query.trim().take(300)
                if (q.isEmpty()) return
                Uri.parse("https://m.youtube.com/results").buildUpon().appendQueryParameter("search_query",q).build().toString()
            }
            else -> return
        }
        pending = target
        if (showing) { web?.loadUrl(target); pending = null; current = target }
    }

    fun layout(payload: String) {
        val o = try { JSONObject(payload) } catch (_: Exception) { hide(); return }
        val viewport = o.optDouble("width", 0.0)
        if (!o.optBoolean("home") || viewport !in 100.0..10000.0 || launcher.width <= 0) { hide(); return }
        val scale = launcher.width / viewport
        fun px(key: String): Int = (o.optDouble(key, 0.0).coerceIn(-20000.0,20000.0)*scale).roundToInt()
        val fx=px("x"); val fy=px("y"); val fw=px("w"); val fh=px("h")
        val x=maxOf(0,fx,px("left")); val y=maxOf(0,fy,px("top"))
        val r=minOf(launcher.width,fx+fw,px("right")); val b=minOf(launcher.height,fy+fh,px("bottom"))
        if (r<=x || b<=y || fw<=0 || fh<=0 || fw>launcher.width*2 || fh>launcher.height*8) { hide(); return }
        val page = ensure()
        val holder = container ?: return
        val wp=IntArray(2); val rp=IntArray(2)
        launcher.getLocationInWindow(wp); root.getLocationInWindow(rp)
        val left=x+wp[0]-rp[0]; val top=y+wp[1]-rp[1]
        val outer=holder.layoutParams as FrameLayout.LayoutParams
        if (outer.width!=r-x || outer.height!=b-y || outer.leftMargin!=left || outer.topMargin!=top)
            holder.layoutParams=FrameLayout.LayoutParams(r-x,b-y).apply { leftMargin=left; topMargin=top }
        val inner=page.layoutParams as FrameLayout.LayoutParams
        if (inner.width!=fw || inner.height!=fh || inner.leftMargin!=fx-x || inner.topMargin!=fy-y)
            page.layoutParams=FrameLayout.LayoutParams(fw,fh).apply { leftMargin=fx-x; topMargin=fy-y }
        if (!showing) {
            holder.visibility=View.VISIBLE
            showing=true
            page.onResume()
            page.loadUrl(pending ?: current)
            pending=null
        }
    }

    fun hide() {
        if (!showing) return
        showing=false
        container?.visibility=View.GONE
        web?.apply {
            // Stop video and network work off Home, without pausing the launcher's WebView.
            stopLoading()
            loadUrl("about:blank")
            onPause()
        }
    }

    fun close() {
        val holder=container
        val page=web
        showing=false
        if (holder!=null) root.removeView(holder)
        if (page!=null) { holder?.removeView(page); page.stopLoading(); page.destroy() }
        container=null;web=null
    }
}
