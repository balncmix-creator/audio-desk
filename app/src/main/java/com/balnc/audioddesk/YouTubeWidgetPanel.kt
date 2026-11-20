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
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.json.JSONObject
import kotlin.math.roundToInt

/** Read-only account subscription feed, rendered locally in the widget. Google tokens
 * never enter a WebView, launcher bridge, preferences or logs. Video/search pages
 * remain isolated from the launcher. */
internal class YouTubeWidgetPanel(private val activity: Activity, private val launcher: WebView) {
    private val root get() = activity.findViewById<FrameLayout>(android.R.id.content)
    private var container: FrameLayout? = null
    private var web: WebView? = null
    private var pending: String? = null
    private var current = "https://m.youtube.com/"
    private var showing = false
    private var feedMode = true
    private var busy = false
    private var closed = false
    private var autoAttempted = false
    private val prefs = activity.getSharedPreferences("youtube_widget_account", Activity.MODE_PRIVATE)
    private val worker = Executors.newSingleThreadExecutor()
    private val channels = Executors.newFixedThreadPool(5)
    private var feedBody = "<p>Connect the Google account on this phone to see recent uploads from your YouTube subscriptions.</p><p>This is a subscription feed, not YouTube’s Home recommendations.</p>"
    private val feedHost = "audioddesk.invalid"
    private val videoId = Regex("[A-Za-z0-9_-]{11}")
    private val channelId = Regex("UC[A-Za-z0-9_-]{22}")
    private val scope = "https://www.googleapis.com/auth/youtube.readonly"
    private val authorizationCode = 6239

    private fun trusted(uri: Uri): Boolean =
        uri.scheme == "https" && uri.host in setOf("m.youtube.com", "www.youtube.com", "youtube.com")
            && uri.path?.startsWith("/signin") != true && uri.path?.startsWith("/account") != true

    private fun escape(value: String): String = android.text.TextUtils.htmlEncode(value)

    private fun displayFeed(body: String) {
        feedBody = body
        if (feedMode && showing) renderFeed()
    }

    private fun renderFeed() {
        val page = web ?: return
        page.settings.javaScriptEnabled = false
        val html = """<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="referrer" content="no-referrer"><style>
            body{font:14px sans-serif;color:#eee;background:#171717;margin:10px}
            a{color:inherit;text-decoration:none} .action{display:inline-block;padding:10px 12px;background:#353535;border-radius:6px;margin-bottom:8px}
            article{margin:0 0 14px} img{width:100%;aspect-ratio:16/9;object-fit:cover;background:#292929;border-radius:6px} strong{display:block;margin:6px 0 3px}
            small,p{color:#bbb;line-height:1.4}</style></head>
            <body><a class="action" href="https://$feedHost/connect">Connect / refresh subscriptions</a><br>
            $feedBody</body></html>"""
        page.loadDataWithBaseURL("https://$feedHost/", html, "text/html", "UTF-8", null)
    }

    private fun authorize(interactive: Boolean) {
        if (closed || busy) return
        busy = true
        displayFeed("<p>Connecting to Google…</p>")
        val request = AuthorizationRequest.builder().setRequestedScopes(listOf(Scope(scope))).build()
        Identity.getAuthorizationClient(activity).authorize(request)
            .addOnSuccessListener { result ->
                if (closed) return@addOnSuccessListener
                if (result.hasResolution()) {
                    if (!interactive || !showing) {
                        busy = false
                        displayFeed("<p>Tap Connect to allow read-only access to your subscriptions.</p>")
                    } else try {
                        val sender = result.pendingIntent?.intentSender ?: error("No authorization intent")
                        activity.startIntentSenderForResult(sender, authorizationCode, null, 0, 0, 0)
                    } catch (_: Exception) { authFailed() }
                } else acceptAuthorization(result)
            }
            .addOnFailureListener { authFailed() }
    }

    fun result(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != authorizationCode) return false
        if (closed) return true
        if (resultCode != Activity.RESULT_OK || data == null) {
            busy = false
            displayFeed("<p>Account access not granted. Tap Connect to try again.</p>")
        } else try {
            acceptAuthorization(Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(data))
        } catch (_: Exception) { authFailed() }
        return true
    }

    private fun authFailed() {
        if (closed) return
        busy = false
        displayFeed("<p>Google could not authorize Audio Desk. Check the app’s Android OAuth registration and YouTube Data API access, then retry.</p>")
    }

    private fun acceptAuthorization(result: AuthorizationResult) {
        val token = result.accessToken
        if (token.isNullOrBlank()) { authFailed(); return }
        prefs.edit().putBoolean("connected", true).apply()
        displayFeed("<p>Loading recent videos from your subscriptions…</p>")
        worker.execute {
            val body = try { fetchFeed(token) } catch (_: Exception) {
                "<p>Could not load your subscriptions. Check your connection and Google API access, then refresh.</p>"
            }
            activity.runOnUiThread {
                if (!closed) { busy = false; displayFeed(body) }
            }
        }
    }

    private fun api(token: String, endpoint: String, params: Map<String, String>): JSONObject {
        val builder = Uri.parse("https://www.googleapis.com/youtube/v3/$endpoint").buildUpon()
        params.forEach { (k,v) -> builder.appendQueryParameter(k,v) }
        val connection = URL(builder.build().toString()).openConnection() as HttpURLConnection
        try {
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 7000
            connection.readTimeout = 7000
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Accept", "application/json")
            check(connection.responseCode == 200)
            return connection.inputStream.bufferedReader().use { JSONObject(it.readText()) }
        } finally { connection.disconnect() }
    }

    private fun items(obj: JSONObject): List<JSONObject> {
        val array = obj.optJSONArray("items") ?: return emptyList()
        return (0 until array.length()).mapNotNull { array.optJSONObject(it) }
    }

    private data class FeedVideo(val id: String, val title: String, val channel: String, val date: String)

    private fun fetchFeed(token: String): String {
        val subscriptions = api(token, "subscriptions", mapOf("part" to "snippet", "mine" to "true", "maxResults" to "50", "order" to "relevance"))
        val ids = items(subscriptions).mapNotNull {
            it.optJSONObject("snippet")?.optJSONObject("resourceId")?.optString("channelId")?.takeIf(channelId::matches)
        }.distinct()
        if (ids.isEmpty()) return "<p>No YouTube subscriptions found on this account.</p>"
        val details = api(token, "channels", mapOf("part" to "contentDetails", "id" to ids.joinToString(","), "maxResults" to "50"))
        val playlists = items(details).mapNotNull {
            it.optJSONObject("contentDetails")?.optJSONObject("relatedPlaylists")?.optString("uploads")?.takeIf { id -> id.matches(Regex("[A-Za-z0-9_-]{10,80}")) }
        }.distinct()
        val futures = channels.invokeAll(playlists.map { playlist ->
            java.util.concurrent.Callable {
                items(api(token, "playlistItems", mapOf("part" to "snippet", "playlistId" to playlist, "maxResults" to "3"))).mapNotNull { row ->
                    val snippet = row.optJSONObject("snippet") ?: return@mapNotNull null
                    val id = snippet.optJSONObject("resourceId")?.optString("videoId") ?: return@mapNotNull null
                    if (!videoId.matches(id)) return@mapNotNull null
                    val title = snippet.optString("title")
                    if (title.isBlank() || title == "Private video" || title == "Deleted video") return@mapNotNull null
                    FeedVideo(id, title, snippet.optString("videoOwnerChannelTitle", snippet.optString("channelTitle")), snippet.optString("publishedAt"))
                }
            }
        }, 45, TimeUnit.SECONDS)
        var failed = 0
        val videos = futures.flatMap { future -> try { future.get() } catch (_: Exception) { failed++; emptyList() } }
            .distinctBy { it.id }.sortedByDescending { it.date }.take(60)
        val notice = "<p>Recent uploads from your subscriptions · up to 50 channels" + (if (failed > 0) " · some channels unavailable" else "") + ".</p>"
        if (videos.isEmpty()) return notice + "<p>No recent videos could be loaded. Try refreshing.</p>"
        return notice + videos.joinToString("") { video ->
            """<article><a href="https://$feedHost/watch/${video.id}"><img loading="lazy" src="https://i.ytimg.com/vi/${video.id}/hqdefault.jpg" alt=""><strong>${escape(video.title)}</strong><small>${escape(video.channel)}</small></a></article>"""
        }
    }

    private fun showWeb(url: String) {
        feedMode = false
        current = url
        web?.apply { settings.javaScriptEnabled = true; if (showing) loadUrl(url) }
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
                    if (uri.scheme == "https" && uri.host == feedHost) {
                        if (request.hasGesture() && feedMode) {
                            if (uri.path == "/connect") authorize(true)
                            else if (uri.pathSegments.size == 2 && uri.pathSegments[0] == "watch") {
                                val id = uri.pathSegments[1]
                                if (videoId.matches(id)) showWeb("https://m.youtube.com/watch?v=$id")
                            }
                        }
                        return true
                    }
                    return !trusted(uri)
                }
                override fun onPageFinished(view: WebView, url: String?) {
                    if (!feedMode && url != null && trusted(Uri.parse(url))) current = url
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
        if (destination == "home" || destination == "subscriptions" || destination == "connect") {
            feedMode = true
            pending = null
            if (showing) renderFeed()
            if (destination == "connect" && showing) authorize(true)
            return
        }
        val target = when (destination) {
            "search" -> {
                val q = query.trim().take(300)
                if (q.isEmpty()) return
                Uri.parse("https://m.youtube.com/results").buildUpon().appendQueryParameter("search_query",q).build().toString()
            }
            else -> return
        }
        pending = target
        showWeb(target)
        if (showing) pending = null
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
            if (feedMode) {
                renderFeed()
                if (!autoAttempted && prefs.getBoolean("connected", false)) {
                    autoAttempted = true
                    authorize(false)
                }
            } else {
                page.settings.javaScriptEnabled = true
                page.loadUrl(pending ?: current)
            }
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
        closed = true
        worker.shutdownNow()
        channels.shutdownNow()
        val holder=container
        val page=web
        showing=false
        if (holder!=null) root.removeView(holder)
        if (page!=null) { holder?.removeView(page); page.stopLoading(); page.destroy() }
        container=null;web=null
    }
}
