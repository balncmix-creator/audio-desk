package com.balnc.audioddesk

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.window.OnBackInvokedDispatcher
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

class MainActivity : Activity() {
    private lateinit var appWebView: WebView
    private lateinit var browserWebView: WebView
    private lateinit var swipeRefresh: DeskRefreshLayout
    private lateinit var browserPanel: LinearLayout
    private lateinit var browserAddress: TextView
    private val refreshHandler = Handler(Looper.getMainLooper())
    private val refreshFailsafe = Runnable { swipeRefresh.isRefreshing = false }
    private val imageAccents = ImageAccentSampler()
    private var destroyed = false

    @SuppressLint("SetJavaScriptEnabled")
    private fun configure(webView: WebView) {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.loadsImagesAutomatically = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.webChromeClient = WebChromeClient()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.rgb(8, 8, 8)
        window.navigationBarColor = Color.rgb(8, 8, 8)

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(8, 8, 8))
        }
        // Android 15+ enforces edge-to-edge for target SDK 35. Apply the
        // system-bar and cutout insets to the native root, not the WebView,
        // so the HTML header starts below the status bar on every device.
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val safe = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
            insets
        }

        swipeRefresh = DeskRefreshLayout(this)
        appWebView = WebView(this)
        configure(appWebView)
        appWebView.addJavascriptInterface(AppBridge(), "AudioDesk")
        appWebView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?) =
                request?.url?.let { loader.shouldInterceptRequest(it) }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("https://") || url.startsWith("http://")) {
                    openInBrowser(url)
                    return true
                }
                return false
            }
        }
        swipeRefresh.setContent(appWebView)
        swipeRefresh.setOnRefreshListener {
            refreshHandler.removeCallbacks(refreshFailsafe)
            // Prevent a lost WebView callback from leaving the native spinner running.
            refreshHandler.postDelayed(refreshFailsafe, 15000L)
            appWebView.evaluateJavascript(
                "if(typeof loadFeeds==='function'){loadFeeds();}else if(window.AudioDesk&&AudioDesk.refreshFinished){AudioDesk.refreshFinished();}",
                null
            )
        }
        root.addView(swipeRefresh, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        ))

        browserPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            setBackgroundColor(Color.rgb(8, 8, 8))
        }
        val browserToolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(8, 8, 8, 8)
            setBackgroundColor(Color.BLACK)
        }
        fun toolbarButton(label: String, action: () -> Unit) = Button(this).apply {
            text = label
            textSize = 11f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(30, 30, 30))
            setOnClickListener { action() }
        }
        browserToolbar.addView(toolbarButton("‹ BACK") {
            if (browserWebView.canGoBack()) browserWebView.goBack() else closeBrowser()
        })
        browserToolbar.addView(toolbarButton("↻") { browserWebView.reload() })
        browserAddress = TextView(this).apply {
            setTextColor(Color.LTGRAY)
            textSize = 10f
            maxLines = 1
            setPadding(8, 0, 8, 0)
        }
        browserToolbar.addView(browserAddress, LinearLayout.LayoutParams(0, -2, 1f))
        browserToolbar.addView(toolbarButton("CLOSE ×") { closeBrowser() })
        browserPanel.addView(browserToolbar)

        browserWebView = WebView(this)
        configure(browserWebView)
        browserWebView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?) = false
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                browserAddress.text = url ?: ""
            }
            override fun onPageFinished(view: WebView?, url: String?) {
                browserAddress.text = url ?: ""
            }
        }
        browserPanel.addView(browserWebView, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        ))
        root.addView(browserPanel, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        ))

        setContentView(root)
        ViewCompat.requestApplyInsets(root)
        appWebView.loadUrl("https://appassets.androidplatform.net/assets/index.html")
        // Android 16 no longer dispatches onBackPressed for apps targeting API 36.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT
            ) { handleBack() }
        }
    }

    private inner class AppBridge {
        @JavascriptInterface fun sampleImageAccent(url: String, requestId: String) {
            if (requestId.length > 32 || requestId.isEmpty() || !requestId.all { it.isDigit() }) return
            imageAccents.sample(url) { color ->
                runOnUiThread {
                    if (!destroyed) {
                        val rgb = color?.let { "[${Color.red(it)},${Color.green(it)},${Color.blue(it)}]" } ?: "null"
                        appWebView.evaluateJavascript("window.receiveImageAccent&&window.receiveImageAccent(${JSONObject.quote(requestId)},$rgb)", null)
                    }
                }
            }
        }
        @JavascriptInterface fun openArticle(url: String) { runOnUiThread { openInBrowser(url) } }
        @JavascriptInterface fun refreshStarted() {
            runOnUiThread {
                swipeRefresh.isRefreshing = true
                refreshHandler.removeCallbacks(refreshFailsafe)
                refreshHandler.postDelayed(refreshFailsafe, 15000L)
            }
        }
        @JavascriptInterface fun refreshFinished() {
            runOnUiThread {
                refreshHandler.removeCallbacks(refreshFailsafe)
                swipeRefresh.isRefreshing = false
            }
        }
    }

    private fun openInBrowser(url: String) {
        if (!url.startsWith("https://") && !url.startsWith("http://")) return
        swipeRefresh.visibility = View.GONE
        browserPanel.visibility = View.VISIBLE
        browserWebView.loadUrl(url)
    }

    private fun closeBrowser() {
        browserWebView.stopLoading()
        browserWebView.loadUrl("about:blank")
        browserPanel.visibility = View.GONE
        swipeRefresh.visibility = View.VISIBLE
    }

    @Deprecated("Deprecated in Android API")
    override fun onBackPressed() {
        handleBack()
    }

    private fun handleBack() {
        if (::browserPanel.isInitialized && browserPanel.visibility == View.VISIBLE) {
            if (browserWebView.canGoBack()) browserWebView.goBack() else closeBrowser()
        } else if (::appWebView.isInitialized && appWebView.canGoBack()) {
            appWebView.goBack()
        } else finish()
    }

    override fun onDestroy() {
        destroyed = true
        imageAccents.close()
        refreshHandler.removeCallbacks(refreshFailsafe)
        if (::browserWebView.isInitialized) browserWebView.destroy()
        if (::appWebView.isInitialized) appWebView.destroy()
        super.onDestroy()
    }
}
