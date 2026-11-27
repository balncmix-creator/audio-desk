package com.balnc.audioddesk

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.view.ActionMode
import android.view.MotionEvent
import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.graphics.Color
import android.net.Uri
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
import android.webkit.ValueCallback
import android.widget.Button
import android.widget.LinearLayout
import android.widget.FrameLayout
import android.widget.TextView
import android.window.OnBackInvokedDispatcher
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.browser.customtabs.CustomTabsIntent
import androidx.browser.customtabs.CustomTabsClient
import org.json.JSONObject

class MainActivity : Activity() {
    private lateinit var appWebView: WebView
    private lateinit var browserWebView: WebView
    private lateinit var swipeRefresh: DeskRefreshLayout
    private lateinit var browserPanel: LinearLayout
    private lateinit var browserAddress: TextView
    private lateinit var scanFeedsButton: Button
    private var googleDiscoveryMode = false
    private val refreshHandler = Handler(Looper.getMainLooper())
    private val refreshFailsafe = Runnable { swipeRefresh.isRefreshing = false }
    private lateinit var imageAccents: ImageAccentSampler
    private lateinit var articleImages: ArticleImageFinder
    private lateinit var feedDiscovery: PublisherFeedDiscovery
    private lateinit var sampleDemos: SampleDemoFinder
    private lateinit var launcherSupport: HomeLauncherSupport
    private lateinit var systemWallpaperInstaller: SystemWallpaperInstaller
    private lateinit var mediaWidgetSupport: MediaWidgetSupport
    private lateinit var spectrumSupport: AudioSpectrumSupport
    private lateinit var agendaSupport: AgendaSupport
    private lateinit var acousticSupport: AcousticMeterSupport
    private lateinit var nativeWidgets: NativeWidgetPanel
    private lateinit var radialFiles: RadialFileSupport
    private lateinit var youtubeWidget: YouTubeWidgetPanel
    private val acousticPermissionRequest = 6212
    private val agendaPermissionRequest = 6211
    private var spectrumVisible = false
    private var projectionInUse = false
    private val spectrumPermissionRequest = 6209
    private val spectrumProjectionRequest = 6210
    private lateinit var pixelStatusBar: PixelStatusBar
    private var pixelHomeThemeRequested = false
    private var windowsHomeThemeRequested = false
    private var systemStatusHidden = false
    private var pixelBarActive = false
    private var pixelBarSuspended = false
    private var destroyed = false
    private var launcherSelectionBlocked = true
    private var launcherTouchX = 0f
    private var launcherTouchY = 0f
    private var appManagementDialog: AlertDialog? = null
    private var statusInsetDp = 24
    private var bottomInsetDp = 0
    private var refreshAllowed = false
    private var wallpaperFileCallback: ValueCallback<Array<Uri>>? = null
    private var audioFileRequest = false
    private val wallpaperFileRequest = 2405

    @SuppressLint("SetJavaScriptEnabled")
    private fun configure(webView: WebView) {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.loadsImagesAutomatically = true
        webView.settings.mediaPlaybackRequiresUserGesture = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.webChromeClient = WebChromeClient()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isStatusBarContrastEnforced = false
        }
        window.navigationBarColor = Color.rgb(8, 8, 8)

        val appIconProvider = LocalAppIconProvider(applicationContext) { pkg ->
            ::launcherSupport.isInitialized && launcherSupport.hasLaunchablePackage(pkg)
        }
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/app-icons/", appIconProvider)
            .build()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(8, 8, 8))
        }
        // Wallpaper fills the WebView behind the status bar; HTML applies
        // the safe top/bottom insets to interactive content only.
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val safe = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            // Let the wallpaper draw behind the Android status bar.
            view.setPadding(safe.left, 0, safe.right, 0)
            val density = resources.displayMetrics.density
            // When the OS status bar is hidden for 8-bit Home, the WebView
            // must still reserve the physical status/cutout height.
            val stableTop = insets.getInsetsIgnoringVisibility(
                WindowInsetsCompat.Type.statusBars() or WindowInsetsCompat.Type.displayCutout()
            ).top
            val top = when {
                pixelBarActive -> maxOf(stableTop, (24f * density).toInt())
                systemStatusHidden -> insets.getInsetsIgnoringVisibility(WindowInsetsCompat.Type.displayCutout()).top
                else -> safe.top
            }
            statusInsetDp = (top / density).toInt()
            bottomInsetDp = (safe.bottom / density).toInt()
            if (::pixelStatusBar.isInitialized) {
                pixelStatusBar.setInsets(safe.left, safe.right)
                val params = pixelStatusBar.layoutParams as FrameLayout.LayoutParams
                if (params.height != top.coerceAtLeast((24f * density).toInt())) {
                    params.height = top.coerceAtLeast((24f * density).toInt())
                    pixelStatusBar.layoutParams = params
                }
            }
            if (::appWebView.isInitialized) applyWebInsets()
            if (::browserPanel.isInitialized) browserPanel.setPadding(0, safe.top, 0, safe.bottom)
            insets
        }

        swipeRefresh = DeskRefreshLayout(this).apply { isEnabled = false }
        appWebView = WebView(this)
        // Only the trusted local interface reads user-picked content URIs.
        configure(appWebView)
        appWebView.settings.allowContentAccess = true
        // Consume native browser long-clicks on launcher surfaces, but never on editable inputs.
        appWebView.setOnTouchListener { _, event ->
            if (event.actionMasked == MotionEvent.ACTION_DOWN) {
                launcherTouchX = event.x
                launcherTouchY = event.y
            }
            false
        }
        appWebView.setOnLongClickListener {
            if (!blocksLauncherSelection()) false else {
                val width = appWebView.width.coerceAtLeast(1)
                val x = launcherTouchX / width
                val y = launcherTouchY / width
                if (appManagementDialog?.isShowing != true) {
                    appWebView.evaluateJavascript("window.audioDeskNativeHold&&window.audioDeskNativeHold(" + x + "," + y + ")", null)
                }
                true
            }
        }
        appWebView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?, callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                if (webView?.url != "https://appassets.androidplatform.net/assets/index.html") return false
                wallpaperFileCallback?.onReceiveValue(null)
                wallpaperFileCallback = callback
                val types = params?.acceptTypes.orEmpty().filter { it.isNotBlank() }
                audioFileRequest = types.isNotEmpty() && types.all { it.startsWith("audio/", ignoreCase = true) }
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = if (audioFileRequest) "audio/*" else "image/*"
                    if (!audioFileRequest) putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/jpeg", "image/png", "image/webp"))
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                try {
                    @Suppress("DEPRECATION")
                    startActivityForResult(intent, wallpaperFileRequest)
                } catch (_: android.content.ActivityNotFoundException) {
                    audioFileRequest = false
                    wallpaperFileCallback?.onReceiveValue(null)
                    wallpaperFileCallback = null
                }
                return true
            }
        }
        // The news interface handles two-finger gestures to change card density.
        // Disable WebView's own page-scale pinch (the article browser is separate).
        appWebView.settings.setSupportZoom(false)
        appWebView.settings.builtInZoomControls = false
        // Only the explicitly tapped sample-preview control starts asynchronous playback.
        // Native lookup returns after the original click, so WebView gesture gating must be disabled.
        appWebView.settings.mediaPlaybackRequiresUserGesture = false
        imageAccents = ImageAccentSampler(appWebView.settings.userAgentString)
        articleImages = ArticleImageFinder(appWebView.settings.userAgentString)
        feedDiscovery = PublisherFeedDiscovery(appWebView.settings.userAgentString)
        sampleDemos = SampleDemoFinder(appWebView.settings.userAgentString)
        launcherSupport = HomeLauncherSupport(this)
        systemWallpaperInstaller = SystemWallpaperInstaller(applicationContext)
        mediaWidgetSupport = MediaWidgetSupport(this)
        spectrumSupport = AudioSpectrumSupport(this, ::sendSpectrum)
        agendaSupport = AgendaSupport(this) { data ->
            runOnUiThread {
                if (!destroyed && ::appWebView.isInitialized)
                    appWebView.evaluateJavascript("window.receiveAudioDeskAgenda&&window.receiveAudioDeskAgenda(" +
                        data.toString() + ")", null)
            }
        }
        acousticSupport = AcousticMeterSupport(this) { data ->
            runOnUiThread {
                if (!destroyed && ::appWebView.isInitialized && (!pixelBarSuspended || data.optString("state") != "active"))
                    appWebView.evaluateJavascript("window.receiveAudioDeskAcoustics&&window.receiveAudioDeskAcoustics(" + data.toString() + ")", null)
            }
        }
        nativeWidgets = NativeWidgetPanel(this, appWebView)
        radialFiles = RadialFileSupport(this, appWebView)
        appWebView.addJavascriptInterface(AppBridge(), "AudioDesk")
        appWebView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                applyWebInsets()
            }
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
            // Twelve-at-a-time mobile RSS refreshes may legitimately require
                // more than 15s when several publishers are unavailable.
                // Keep the refresh indicator alive until JS reports completion,
                // while still providing a bounded safety stop for crashes.
                refreshHandler.postDelayed(refreshFailsafe, 60000L)
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
        scanFeedsButton = toolbarButton("SCAN FEEDS") { scanGoogleResults() }.apply { visibility = View.GONE }
        browserToolbar.addView(scanFeedsButton)
        browserToolbar.addView(toolbarButton("CLOSE ×") { closeBrowser() })
        browserPanel.addView(browserToolbar)

        browserWebView = WebView(this)
        configure(browserWebView)
        browserWebView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?) = false
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                browserAddress.text = url ?: ""
                updateDiscoveryButton(url)
            }
            override fun onPageFinished(view: WebView?, url: String?) {
                browserAddress.text = url ?: ""
                updateDiscoveryButton(url)
            }
        }
        browserPanel.addView(browserWebView, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        ))
        root.addView(browserPanel, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        ))

        setContentView(root)
        youtubeWidget = YouTubeWidgetPanel(this, appWebView)
        // The 8-bit bar is a *native Android View* layered over the wallpaper,
        // not HTML and not an attempt to reskin SystemUI outside this app.
        pixelStatusBar = PixelStatusBar(this)
        findViewById<FrameLayout>(android.R.id.content).addView(
            pixelStatusBar,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                (24f * resources.displayMetrics.density).toInt(),
                Gravity.TOP
            )
        )
        ViewCompat.requestApplyInsets(root)
        appWebView.loadUrl("https://appassets.androidplatform.net/assets/index.html")
        // Android 16 no longer dispatches onBackPressed for apps targeting API 36.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT
            ) { handleBack() }
        }
    }

    private fun applyPixelStatusMode() {
        if (!::pixelStatusBar.isInitialized) return
        val homeVisible = !pixelBarSuspended &&
            !(::browserPanel.isInitialized && browserPanel.visibility == View.VISIBLE)
        val shouldShow = pixelHomeThemeRequested && homeVisible
        val shouldHide = homeVisible && (pixelHomeThemeRequested || windowsHomeThemeRequested)
        if (pixelBarActive == shouldShow && systemStatusHidden == shouldHide) return
        val pixelChanged = pixelBarActive != shouldShow
        pixelBarActive = shouldShow
        systemStatusHidden = shouldHide
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        if (pixelChanged) {
            pixelStatusBar.visibility = if (shouldShow) View.VISIBLE else View.GONE
            if (shouldShow) pixelStatusBar.startUpdates() else pixelStatusBar.stopUpdates()
        }
        if (shouldHide) {
            controller.systemBarsBehavior =
                androidx.core.view.WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            controller.hide(WindowInsetsCompat.Type.statusBars())
        } else {
            controller.show(WindowInsetsCompat.Type.statusBars())
        }
        // Retain clock and alphabet safe areas despite hiding the system bar.
        ViewCompat.requestApplyInsets(window.decorView)
    }

    private fun applyWebInsets() {
        if (destroyed || !::appWebView.isInitialized) return
        appWebView.evaluateJavascript(
            "document.documentElement.style.setProperty('--status-top','" + statusInsetDp + "px');" +
            "document.documentElement.style.setProperty('--system-bottom','" + bottomInsetDp + "px')", null
        )
    }

    private fun sendLauncherApps(forceRefresh: Boolean = false) {
        if (!::launcherSupport.isInitialized || destroyed) return
        launcherSupport.load(forceRefresh) { apps, recents ->
            runOnUiThread {
                if (!destroyed && ::appWebView.isInitialized) {
                    val home = launcherSupport.isDefaultHome()
                    appWebView.evaluateJavascript(
                        "window.receiveLauncherApps&&window.receiveLauncherApps(" +
                            apps.toString() + "," + recents.toString() + "," + home + ")", null
                    )
                }
            }
        }
    }

    private fun reportSystemWallpaperResult(id: Int, success: Boolean, detail: String) {
        runOnUiThread {
            if (!destroyed && ::appWebView.isInitialized) {
                appWebView.evaluateJavascript(
                    "window.audioDeskWallpaperResult&&window.audioDeskWallpaperResult(" +
                        id + "," + success + "," + JSONObject.quote(detail) + ")", null
                )
            }
        }
    }

    private fun sendMediaState(data: JSONObject) {
        runOnUiThread {
            if (!destroyed && ::appWebView.isInitialized)
                appWebView.evaluateJavascript(
                    "window.receiveAudioDeskMedia&&window.receiveAudioDeskMedia(" + data.toString() + ")", null
                )
        }
    }

    private fun sendSpectrum(data: JSONObject) {
        runOnUiThread {
            if (!destroyed && ::appWebView.isInitialized)
                appWebView.evaluateJavascript(
                    "window.receiveAudioDeskSpectrum&&window.receiveAudioDeskSpectrum(" +
                        data.toString() + ")", null)
        }
    }

    private fun requestSpectrumCapture() {
        spectrumVisible = true
        if (!::spectrumSupport.isInitialized) return
        if (spectrumSupport.hasPermission()) {
            if (!projectionInUse) spectrumSupport.start()
        } else {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO),
                spectrumPermissionRequest)
        }
    }

    private fun requestPlaybackProjection() {
        if (Build.VERSION.SDK_INT < 29) {
            spectrumSupport.signal("unsupported")
            return
        }
        if (!spectrumSupport.hasPermission()) {
            requestSpectrumCapture()
            return
        }
        val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        try {
            @Suppress("DEPRECATION")
            startActivityForResult(manager.createScreenCaptureIntent(), spectrumProjectionRequest)
        } catch (_: Exception) {
            spectrumSupport.signal("unsupported")
        }
    }

    private fun stopSpectrumProjection() {
        SpectrumProjectionService.observer = null
        if (projectionInUse) {
            projectionInUse = false
            try { stopService(Intent(this, SpectrumProjectionService::class.java)) }
            catch (_: Exception) {}
        }
    }

    private inner class AppBridge {
        // Expose only a generic rendering profile, never raw model identifiers.
        @JavascriptInterface fun getOrbitDeviceProfile(): String =
            OrbitDeviceProfile.classify(Build.MANUFACTURER, Build.MODEL, Build.DEVICE)

        @JavascriptInterface fun isLowRamDevice(): Boolean =
            (getSystemService(android.content.Context.ACTIVITY_SERVICE) as? android.app.ActivityManager)?.isLowRamDevice == true

        @JavascriptInterface fun layoutYouTubeWidget(payload: String) {
            if (payload.length > 2048) return
            runOnUiThread {
                if (!destroyed && ::youtubeWidget.isInitialized) {
                    if (pixelBarSuspended || browserPanel.visibility == View.VISIBLE) youtubeWidget.hide()
                    else youtubeWidget.layout(payload)
                }
            }
        }

        @JavascriptInterface fun navigateYouTubeWidget(destination: String, query: String) {
            runOnUiThread {
                if (!destroyed && !pixelBarSuspended && ::youtubeWidget.isInitialized)
                    youtubeWidget.navigate(destination, query)
            }
        }

        @JavascriptInterface fun openYouTubePage(destination: String, query: String) {
            runOnUiThread {
                if (destroyed || pixelBarSuspended) return@runOnUiThread
                val uri = when (destination) {
                    "home" -> Uri.parse("https://m.youtube.com/")
                    "subscriptions" -> Uri.parse("https://m.youtube.com/feed/subscriptions")
                    "search" -> {
                        val text = query.trim().take(300)
                        if (text.isEmpty()) return@runOnUiThread
                        Uri.parse("https://m.youtube.com/results").buildUpon()
                            .appendQueryParameter("search_query", text).build()
                    }
                    else -> return@runOnUiThread
                }
                // The trusted browser owns the authenticated session, not our
                // news WebView. Never access Google credentials or cookies.
                try {
                    val tab = CustomTabsIntent.Builder().setShowTitle(true).build()
                    CustomTabsClient.getPackageName(this@MainActivity, null)?.let {
                        tab.intent.setPackage(it)
                    }
                    tab.launchUrl(this@MainActivity, uri)
                } catch (_: Exception) {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, uri))
                    } catch (_: Exception) {
                        android.widget.Toast.makeText(this@MainActivity,
                            "Open YouTube requires a compatible browser or the YouTube app",
                            android.widget.Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }

        @JavascriptInterface fun enableAcousticMic() {
            runOnUiThread {
                if (destroyed || pixelBarSuspended) return@runOnUiThread
                if (!acousticSupport.permitted())
                    requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), acousticPermissionRequest)
                else acousticSupport.state("granted")
            }
        }
        @JavascriptInterface fun setAcousticActive(spl: Boolean, fft: Boolean) {
            runOnUiThread {
                if (destroyed) return@runOnUiThread
                val visible = !pixelBarSuspended && browserPanel.visibility != View.VISIBLE
                acousticSupport.setActive(spl && visible, fft && visible)
            }
        }
        @JavascriptInterface fun radialFilesList() {
            runOnUiThread { if (!destroyed && ::radialFiles.isInitialized) radialFiles.requestListing() }
        }
        // Only an explicit user tap opens Android's special access settings.
        // The debug edition declares MANAGE_EXTERNAL_STORAGE; the release
        // edition keeps scoped SAF access as the Play-compliant fallback.
        @JavascriptInterface fun radialFilesRequestFullAccess(location: String) {
            if (location !in setOf("root", "downloads", "music", "documents", "pictures", "dcim")) return
            runOnUiThread {
                if (!destroyed && ::radialFiles.isInitialized)
                    radialFiles.requestDeviceAccess(location)
            }
        }
        @JavascriptInterface fun radialFilesPick() {
            runOnUiThread { if (!destroyed && ::radialFiles.isInitialized) radialFiles.chooseFolder() }
        }
        @JavascriptInterface fun radialFilesUp() {
            runOnUiThread { if (!destroyed && ::radialFiles.isInitialized) radialFiles.up() }
        }
        @JavascriptInterface fun radialFilesEnter(id: String) {
            runOnUiThread { if (!destroyed && ::radialFiles.isInitialized) radialFiles.enter(id) }
        }
        @JavascriptInterface fun radialFilesOpen(id: String) {
            runOnUiThread { if (!destroyed && ::radialFiles.isInitialized) radialFiles.open(id) }
        }
        @JavascriptInterface fun radialFilesShare(id: String) {
            runOnUiThread { if (!destroyed && ::radialFiles.isInitialized) radialFiles.share(id) }
        }
        @JavascriptInterface fun radialFilesCreate(name: String) {
            runOnUiThread { if (!destroyed && ::radialFiles.isInitialized) radialFiles.createFolder(name) }
        }
        @JavascriptInterface fun radialFilesRename(id: String, name: String) {
            runOnUiThread { if (!destroyed && ::radialFiles.isInitialized) radialFiles.rename(id, name) }
        }
        @JavascriptInterface fun radialFilesDelete(id: String) {
            runOnUiThread { if (!destroyed && ::radialFiles.isInitialized) radialFiles.delete(id) }
        }

        @JavascriptInterface fun openNativeWidgets() {
            runOnUiThread { if (!destroyed && !pixelBarSuspended) nativeWidgets.open() }
        }
        @JavascriptInterface fun requestNativeWidgets() {
            runOnUiThread { if (!destroyed) nativeWidgets.publish() }
        }
        @JavascriptInterface fun layoutNativeWidgets(payload: String) {
            runOnUiThread { if (!destroyed && !pixelBarSuspended && browserPanel.visibility != View.VISIBLE) nativeWidgets.layout(payload) }
        }
        @JavascriptInterface fun deleteNativeWidget(id: Int) {
            runOnUiThread { if (!destroyed) nativeWidgets.delete(id) }
        }

        @JavascriptInterface fun requestAgenda() {
            runOnUiThread { if (!destroyed && ::agendaSupport.isInitialized) agendaSupport.refresh() }
        }

        @JavascriptInterface fun enableAgenda() {
            runOnUiThread {
                if (destroyed || !::agendaSupport.isInitialized) return@runOnUiThread
                if (agendaSupport.granted()) agendaSupport.refresh()
                else requestPermissions(arrayOf(Manifest.permission.READ_CALENDAR), agendaPermissionRequest)
            }
        }

        @JavascriptInterface fun openAgendaEvent(id: String, begin: Long, end: Long) {
            runOnUiThread { if (!destroyed && ::agendaSupport.isInitialized) agendaSupport.openEvent(id, begin, end) }
        }

        @JavascriptInterface fun newAgendaEvent(begin: Long) {
            runOnUiThread { if (!destroyed && ::agendaSupport.isInitialized) agendaSupport.newEvent(begin) }
        }

        @JavascriptInterface fun supportsAdaptiveAppIcons(): Boolean = true

        @JavascriptInterface fun requestSpectrumCapture() {
            runOnUiThread { if (!destroyed) this@MainActivity.requestSpectrumCapture() }
        }
        @JavascriptInterface fun requestSpectrumProjection() {
            runOnUiThread { if (!destroyed) this@MainActivity.requestPlaybackProjection() }
        }
        @JavascriptInterface fun setSpectrumActive(visible: Boolean) {
            runOnUiThread {
                if (destroyed || !::spectrumSupport.isInitialized) return@runOnUiThread
                spectrumVisible = visible
                if (visible && !pixelBarSuspended && browserPanel.visibility != View.VISIBLE && spectrumSupport.hasPermission() && !projectionInUse)
                    spectrumSupport.start()
                else if (!visible) {
                    spectrumSupport.stop()
                    stopSpectrumProjection()
                }
            }
        }

        @JavascriptInterface fun requestMediaState() {
            runOnUiThread {
                if (!destroyed && ::mediaWidgetSupport.isInitialized)
                    sendMediaState(mediaWidgetSupport.state())
            }
        }
        @JavascriptInterface fun seekMedia(positionMs: Long) {
            if (positionMs < 0L) return
            runOnUiThread {
                if (!destroyed && ::mediaWidgetSupport.isInitialized)
                    sendMediaState(mediaWidgetSupport.seek(positionMs))
            }
        }
        @JavascriptInterface fun mediaCommand(action: String) {
            if (action !in setOf("next", "previous", "toggle")) return
            runOnUiThread {
                if (!destroyed && ::mediaWidgetSupport.isInitialized)
                    sendMediaState(mediaWidgetSupport.command(action))
            }
        }
        /**
         * Live Tiles: opt-in active notification counts. Only verified installed
         * launcher packages are accepted; no notification text crosses the bridge.
         * The WebView never requests this until the user enables the feature.
         */
        @JavascriptInterface fun requestLiveTileCounts(packagesJson: String) {
            if (packagesJson.length > 4096) return
            runOnUiThread {
                if (destroyed || !::mediaWidgetSupport.isInitialized ||
                    !::launcherSupport.isInitialized || !::appWebView.isInitialized) return@runOnUiThread
                val requested = try {
                    val json = org.json.JSONArray(packagesJson)
                    (0 until minOf(json.length(), 24))
                        .mapNotNull { json.optString(it).takeIf { pkg ->
                            pkg.length in 4..180 && pkg.matches(Regex("[A-Za-z0-9_.]+")) &&
                                launcherSupport.hasLaunchablePackage(pkg)
                        } }.toSet()
                } catch (_: Exception) { emptySet<String>() }
                val data = mediaWidgetSupport.liveTileCounts(requested)
                appWebView.evaluateJavascript(
                    "window.receiveAudioDeskLiveTileCounts&&window.receiveAudioDeskLiveTileCounts(" +
                        data.toString() + ")", null
                )
            }
        }

        @JavascriptInterface fun requestMediaAccess() {
            runOnUiThread {
                if (!destroyed && ::mediaWidgetSupport.isInitialized)
                    mediaWidgetSupport.openAccessSettings()
            }
        }
        @JavascriptInterface fun setSystemWallpaperBundled(
            id: String, position: Int, alsoLock: Boolean, requestId: Int
        ) {
            if (destroyed || !::systemWallpaperInstaller.isInitialized) return
            systemWallpaperInstaller.applyBundled(id, position, alsoLock, requestId,
                ::reportSystemWallpaperResult)
        }

        @JavascriptInterface fun setSystemWallpaperCustom(
            dataUrl: String, position: Int, alsoLock: Boolean, requestId: Int
        ) {
            if (destroyed || !::systemWallpaperInstaller.isInitialized) return
            systemWallpaperInstaller.applyCustom(dataUrl, position, alsoLock, requestId,
                ::reportSystemWallpaperResult)
        }

        @JavascriptInterface fun setWallpaperTone(light: Boolean) {
            runOnUiThread {
                if (!destroyed) {
                    WindowCompat.getInsetsController(window, window.decorView)
                        .isAppearanceLightStatusBars = light
                }
            }
        }
        @JavascriptInterface fun setStatusBarTheme(theme: String, light: Boolean) {
            runOnUiThread {
                if (!destroyed) {
                    val windowsHome = theme == "windows"
                    pixelHomeThemeRequested = theme == "pixel"
                    windowsHomeThemeRequested = windowsHome
                    if (::pixelStatusBar.isInitialized) pixelStatusBar.setContrast(light)
                    applyPixelStatusMode()
                    // Wallpaper fills the entire status inset in every Home theme.
                    // Android 15+ mandates a transparent status bar; older versions use
                    // the same transparent behavior so no tinted band appears.
                    window.statusBarColor = Color.TRANSPARENT
                    window.navigationBarColor = if (windowsHome) Color.rgb(13, 13, 13) else Color.rgb(8, 8, 8)
                    WindowCompat.getInsetsController(window, window.decorView)
                        .isAppearanceLightStatusBars = !windowsHome && light
                }
            }
        }
        @JavascriptInterface fun requestSearchKeyboard() {
            runOnUiThread {
                if (!destroyed && ::appWebView.isInitialized) {
                    appWebView.requestFocus()
                    val manager = getSystemService(android.content.Context.INPUT_METHOD_SERVICE)
                        as android.view.inputmethod.InputMethodManager
                    manager.showSoftInput(appWebView, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT)
                }
            }
        }
        @JavascriptInterface fun getAppShortcuts(pkg: String, activityName: String) {
            if (!::launcherSupport.isInitialized || destroyed) return
            launcherSupport.shortcuts(pkg, activityName) { list ->
                runOnUiThread {
                    if (!destroyed && ::appWebView.isInitialized)
                        appWebView.evaluateJavascript(
                            "window.receiveAppShortcuts&&window.receiveAppShortcuts(" +
                                JSONObject.quote(pkg) + "," +
                                JSONObject.quote(activityName) + "," +
                                list.toString() + ")", null
                        )
                }
            }
        }
        @JavascriptInterface fun launchAppShortcut(pkg: String, activityName: String, id: String) {
            runOnUiThread {
                if (!destroyed && ::launcherSupport.isInitialized) {
                    val ok = launcherSupport.launchShortcut(pkg, activityName, id)
                    appWebView.evaluateJavascript(
                        "window.launcherLaunchResult&&window.launcherLaunchResult(" + ok + ")", null
                    )
                }
            }
        }
        @JavascriptInterface fun hideSearchKeyboard() {
            runOnUiThread {
                if (!destroyed && ::appWebView.isInitialized) {
                    val manager = getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
                    manager.hideSoftInputFromWindow(appWebView.windowToken, 0)
                }
            }
        }
        @JavascriptInterface fun setRefreshEnabled(enabled: Boolean) {
            runOnUiThread {
                if (!destroyed) {
                    refreshAllowed = enabled
                    swipeRefresh.isEnabled = enabled && browserPanel.visibility != View.VISIBLE
                }
            }
        }
        @JavascriptInterface fun requestLauncherApps(forceRefresh: Boolean) {
            runOnUiThread { sendLauncherApps(forceRefresh) }
        }
        @JavascriptInterface fun launchExternalApp(pkg: String, activityName: String) {
            runOnUiThread {
                if (!destroyed) {
                    val opened = launcherSupport.launch(pkg, activityName)
                    appWebView.evaluateJavascript(
                        "window.launcherLaunchResult&&window.launcherLaunchResult(" + opened + ")", null
                    )
                }
            }
        }
        @JavascriptInterface fun setLauncherSelectionBlocked(blocked: Boolean) {
            runOnUiThread { launcherSelectionBlocked = blocked }
        }
        @JavascriptInterface fun showNativeAppManagement(pkg: String) {
            if (!AppManagementActions.validPackage(pkg)) return
            runOnUiThread {
                if (destroyed || isFinishing || appManagementDialog?.isShowing == true) return@runOnUiThread
                if (!launcherSupport.hasLaunchablePackage(pkg)) return@runOnUiThread
                try {
                    val info = packageManager.getApplicationInfo(pkg, 0)
                    val dialog = AppManagementActions.dialog(this@MainActivity, packageManager.getApplicationLabel(info)) { action ->
                        launchAppManagementAction(pkg, action)
                    }
                    appManagementDialog = dialog
                    dialog.setOnDismissListener { if (appManagementDialog === dialog) appManagementDialog = null }
                    dialog.show()
                } catch (_: Exception) {
                    android.widget.Toast.makeText(this@MainActivity, "App is no longer available.", android.widget.Toast.LENGTH_SHORT).show()
                }
            }
        }
        /** Open Android-owned application management. Android restricts force-stop and
         * cache deletion to Settings; the launcher never claims to do them itself. */
        @JavascriptInterface fun openAppSettings(pkg: String, action: String) {
            if (!AppManagementActions.validPackage(pkg) || !AppManagementActions.validAction(action)) return
            runOnUiThread { launchAppManagementAction(pkg, action) }
        }
        @JavascriptInterface fun requestDefaultLauncher() {
            runOnUiThread { if (!destroyed) launcherSupport.requestDefaultHome() }
        }
        @JavascriptInterface fun isDefaultLauncher(): Boolean =
            !destroyed && ::launcherSupport.isInitialized && launcherSupport.isDefaultHome()
        @JavascriptInterface fun lookupSampleDemo(url: String, title: String, requestId: String) {
            if (requestId.length !in 1..32 || !requestId.all { it.isDigit() }) return
            sampleDemos.find(url, title) { result ->
                runOnUiThread {
                    if (!destroyed) {
                        val record = result?.let {
                            JSONObject().put("kind", it.kind).put("url", it.url).toString()
                        } ?: "null"
                        appWebView.evaluateJavascript(
                            "window.receiveSampleDemo&&window.receiveSampleDemo(" +
                                JSONObject.quote(requestId) + "," + record + ")", null
                        )
                    }
                }
            }
        }
        @JavascriptInterface fun openGoogleDiscovery(query: String) {
            if (query.length !in 1..200) return
            runOnUiThread {
                if (!destroyed) {
                    googleDiscoveryMode = true
                    openInBrowser("https://www.google.com/search?q=" + Uri.encode(query))
                }
            }
        }
        @JavascriptInterface fun discoverPublisherFeeds(seeds: String, requestId: String) {
            if (requestId.length !in 1..32 || !requestId.all { it.isDigit() } || seeds.length > 8000) return
            feedDiscovery.discover(seeds) { found ->
                runOnUiThread {
                    if (!destroyed) {
                        appWebView.evaluateJavascript(
                            "window.receiveDiscoveredFeeds&&window.receiveDiscoveredFeeds(" +
                                JSONObject.quote(requestId) + "," + found.toString() + ")", null)
                    }
                }
            }
        }
        @JavascriptInterface fun lookupArticleImage(url: String, requestId: String) {
            if (requestId.isEmpty() || requestId.length > 32 || !requestId.all { it.isDigit() }) return
            articleImages.find(url) { imageUrl ->
                runOnUiThread {
                    if (!destroyed) {
                        val image = imageUrl?.let { JSONObject.quote(it) } ?: "null"
                        appWebView.evaluateJavascript("window.receiveArticleImage&&window.receiveArticleImage(" +
                            JSONObject.quote(requestId) + "," + image + ")", null)
                    }
                }
            }
        }
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
                if (swipeRefresh.isEnabled) swipeRefresh.isRefreshing = true
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

    override fun onNewIntent(intent: android.content.Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (::appWebView.isInitialized && intent?.hasCategory(android.content.Intent.CATEGORY_HOME) == true) {
            if (::browserPanel.isInitialized && browserPanel.visibility == View.VISIBLE) closeBrowser()
            appWebView.evaluateJavascript("window.launcherGoHome&&window.launcherGoHome()", null)
        }
    }

    override fun onResume() {
        super.onResume()
        if (::nativeWidgets.isInitialized) nativeWidgets.resume()
        if (::radialFiles.isInitialized) radialFiles.onResume()
        pixelBarSuspended = false
        applyPixelStatusMode()
        if (::mediaWidgetSupport.isInitialized) sendMediaState(mediaWidgetSupport.state())
        if (::spectrumSupport.isInitialized && spectrumVisible &&
            spectrumSupport.hasPermission() && !projectionInUse) spectrumSupport.start()
        // Refresh installed apps after returning from another app or installing a package.
        if (::appWebView.isInitialized && ::launcherSupport.isInitialized)
            appWebView.evaluateJavascript(
                "window.audioDeskSetForeground&&window.audioDeskSetForeground(" + (browserPanel.visibility != View.VISIBLE) + ");" +
                    "window.launcherOnResume&&window.launcherOnResume();" +
                    "window.launcherWallpaperActive&&window.launcherWallpaperActive(" + (browserPanel.visibility != View.VISIBLE) + ")", null)
    }

    override fun onPause() {
        if (::acousticSupport.isInitialized) acousticSupport.stop()
        if (::nativeWidgets.isInitialized) nativeWidgets.pause()
        if (::youtubeWidget.isInitialized) youtubeWidget.hide()
        if (::spectrumSupport.isInitialized) spectrumSupport.stop()
        stopSpectrumProjection()
        pixelBarSuspended = true
        applyPixelStatusMode()
        if (::appWebView.isInitialized && !destroyed) appWebView.evaluateJavascript(
            "window.audioDeskSetForeground&&window.audioDeskSetForeground(false);" +
                "window.launcherWallpaperActive&&window.launcherWallpaperActive(false);" +
                "if(typeof pauseSampleDemos==='function')pauseSampleDemos()", null)
        super.onPause()
    }

    @Deprecated("Runtime permission callback compatibility")
    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<out String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == agendaPermissionRequest && ::agendaSupport.isInitialized) agendaSupport.refresh()
        if (requestCode == acousticPermissionRequest && ::acousticSupport.isInitialized)
            acousticSupport.state(if (acousticSupport.permitted()) "granted" else "permission")
        if (requestCode == spectrumPermissionRequest && ::spectrumSupport.isInitialized) {
            if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED &&
                spectrumVisible) spectrumSupport.start()
            else spectrumSupport.signal("permission")
        }
    }

    @Deprecated("Activity result compatibility for minSdk 23")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (::radialFiles.isInitialized && radialFiles.result(requestCode, resultCode, data)) return
        if (::nativeWidgets.isInitialized && nativeWidgets.result(requestCode, resultCode)) return
        if (requestCode == spectrumProjectionRequest) {
            if (resultCode == RESULT_OK && data != null && spectrumVisible &&
                Build.VERSION.SDK_INT >= 29) {
                spectrumSupport.stop()
                projectionInUse = true
                SpectrumProjectionService.observer = { samples ->
                    if (!destroyed && projectionInUse && spectrumVisible)
                        spectrumSupport.deliverProjection(samples)
                }
                val service = Intent(this, SpectrumProjectionService::class.java).apply {
                    action = SpectrumProjectionService.ACTION_START
                    putExtra(SpectrumProjectionService.EXTRA_RESULT, resultCode)
                    putExtra(SpectrumProjectionService.EXTRA_DATA, data)
                }
                try {
                    startForegroundService(service)
                    spectrumSupport.signal("listening")
                } catch (_: Exception) {
                    stopSpectrumProjection()
                    spectrumSupport.signal("unsupported")
                }
            } else {
                spectrumSupport.signal("unsupported")
            }
            return
        }
        if (requestCode != wallpaperFileRequest) return
        val callback = wallpaperFileCallback
        val audioRequest = audioFileRequest
        audioFileRequest = false
        wallpaperFileCallback = null
        val uri = data?.data?.takeIf { resultCode == RESULT_OK && it.scheme == "content" }
        val allowed = uri?.let {
            try {
                val mime = contentResolver.getType(it)
                if (audioRequest) mime?.startsWith("audio/", ignoreCase = true) == true
                else mime == null || mime in setOf("image/jpeg", "image/jpg", "image/png", "image/webp")
            } catch (_: Exception) { false }
        } ?: false
        callback?.onReceiveValue(if (uri != null && allowed) arrayOf(uri) else null)
    }

    private fun updateDiscoveryButton(url: String?) {
        if (::scanFeedsButton.isInitialized) {
            scanFeedsButton.visibility = if (googleDiscoveryMode) View.VISIBLE else View.GONE
            scanFeedsButton.isEnabled = GoogleResultDiscovery.isGoogleResults(url)
        }
    }

    private fun scanGoogleResults() {
        if (!googleDiscoveryMode || !GoogleResultDiscovery.isGoogleResults(browserWebView.url)) return
        scanFeedsButton.isEnabled = false
        // Read only result headings and their public links after an explicit tap.
        // The external browser never receives the privileged AudioDesk bridge.
        browserWebView.evaluateJavascript(GoogleResultDiscovery.resultScript) { raw ->
            if (destroyed || !googleDiscoveryMode || !GoogleResultDiscovery.isGoogleResults(browserWebView.url)) return@evaluateJavascript
            val rows = GoogleResultDiscovery.decodeRows(raw)
            googleDiscoveryMode = false
            closeBrowser()
            appWebView.evaluateJavascript(
                "window.receiveGoogleDiscoveryLinks&&window.receiveGoogleDiscoveryLinks(" + rows.toString() + ")", null
            )
        }
    }

    private fun blocksLauncherSelection(): Boolean =
        launcherSelectionBlocked && ::appWebView.isInitialized &&
            appWebView.hitTestResult?.type != WebView.HitTestResult.EDIT_TEXT_TYPE &&
            (!::browserPanel.isInitialized || browserPanel.visibility != View.VISIBLE)

    override fun onActionModeStarted(mode: ActionMode?) {
        super.onActionModeStarted(mode)
        if (::appWebView.isInitialized && appWebView.hasFocus() && blocksLauncherSelection()) mode?.finish()
    }

    private fun launchAppManagementAction(pkg: String, action: String) {
        if (destroyed || !AppManagementActions.validPackage(pkg) || !AppManagementActions.validAction(action)) return
        try {
            packageManager.getApplicationInfo(pkg, 0)
            startActivity(AppManagementActions.intent(pkg, action))
            if (action == "storage" || action == "force-stop") {
                val instruction = if (action == "storage") "Open Storage, then Clear cache." else "Tap Force stop in App info."
                android.widget.Toast.makeText(this, instruction, android.widget.Toast.LENGTH_LONG).show()
            }
        } catch (_: Exception) {
            android.widget.Toast.makeText(this, "Android could not open this app action.", android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    private fun openInBrowser(url: String) {
        if (!url.startsWith("https://") && !url.startsWith("http://")) return
        if (::nativeWidgets.isInitialized) nativeWidgets.pause()
        if (::acousticSupport.isInitialized) acousticSupport.stop()
        if (::spectrumSupport.isInitialized) spectrumSupport.stop()
        stopSpectrumProjection()
        appWebView.evaluateJavascript("window.audioDeskSetForeground&&window.audioDeskSetForeground(false);if(typeof pauseSampleDemos==='function')pauseSampleDemos();window.launcherWallpaperActive&&window.launcherWallpaperActive(false)", null)
        swipeRefresh.isEnabled = false
        applyPixelStatusMode()
        WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = false
        swipeRefresh.visibility = View.GONE
        browserPanel.visibility = View.VISIBLE
        applyPixelStatusMode()
        updateDiscoveryButton(url)
        browserWebView.loadUrl(url)
    }

    private fun closeBrowser() {
        googleDiscoveryMode = false
        updateDiscoveryButton(null)
        browserWebView.stopLoading()
        browserWebView.loadUrl("about:blank")
        browserPanel.visibility = View.GONE
        if (::nativeWidgets.isInitialized) nativeWidgets.resume()
        applyPixelStatusMode()
        swipeRefresh.visibility = View.VISIBLE
        swipeRefresh.isEnabled = refreshAllowed
        appWebView.evaluateJavascript("window.audioDeskSetForeground&&window.audioDeskSetForeground(true);window.launcherWallpaperActive&&window.launcherWallpaperActive(true)", null)
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
        } else if (::appWebView.isInitialized) {
            // A selected Home app must not silently exit on Back.
            appWebView.evaluateJavascript("window.launcherBack&&window.launcherBack()", null)
        }
    }

    override fun onDestroy() {
        destroyed = true
        appManagementDialog?.dismiss()
        appManagementDialog = null
        if (::pixelStatusBar.isInitialized) pixelStatusBar.stopUpdates()
        wallpaperFileCallback?.onReceiveValue(null)
        wallpaperFileCallback = null
        if (::imageAccents.isInitialized) imageAccents.close()
        if (::articleImages.isInitialized) articleImages.close()
        if (::feedDiscovery.isInitialized) feedDiscovery.close()
        if (::sampleDemos.isInitialized) sampleDemos.close()
        if (::launcherSupport.isInitialized) launcherSupport.close()
        if (::agendaSupport.isInitialized) agendaSupport.close()
        if (::acousticSupport.isInitialized) acousticSupport.stop()
        if (::radialFiles.isInitialized) radialFiles.close()
        if (::nativeWidgets.isInitialized) nativeWidgets.close()
        if (::youtubeWidget.isInitialized) youtubeWidget.close()
        stopSpectrumProjection()
        if (::spectrumSupport.isInitialized) spectrumSupport.close()
        if (::systemWallpaperInstaller.isInitialized) systemWallpaperInstaller.close()
        refreshHandler.removeCallbacks(refreshFailsafe)
        if (::browserWebView.isInitialized) browserWebView.destroy()
        if (::appWebView.isInitialized) appWebView.destroy()
        super.onDestroy()
    }
}
