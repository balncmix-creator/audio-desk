package com.balnc.audioddesk

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.text.format.DateFormat
import android.view.View
import android.content.Intent
import android.content.IntentFilter

/**
 * 8-bit status indicators inside Audio Desk's pixel Home ONLY.
 *
 * Android's normal status bar is hidden while this view is active.
 * Values are read from Android; we never synthesize notification icons or
 * claim a mobile signal strength we cannot access without extra permissions.
 * No WebView animations, polling loops or persistent background service.
 */
class PixelStatusBar(context: Context) : View(context) {
    private val density = resources.displayMetrics.density
    private val scaledDensity = resources.displayMetrics.scaledDensity
    private val graphics = Paint().apply {
        isAntiAlias = false
        color = Color.WHITE
        style = Paint.Style.FILL
    }
    private val lettering = Paint().apply {
        isAntiAlias = false
        isSubpixelText = false
        color = Color.WHITE
        style = Paint.Style.FILL
        typeface = try {
            Typeface.createFromAsset(context.assets, "fonts/silkscreen-bold.ttf")
        } catch (_: Exception) {
            Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        }
    }
    private val connectivity = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val tickHandler = Handler(Looper.getMainLooper())
    private var running = false
    private var observingNetwork = false
    private var batteryPercent = -1
    private var charging = false
    private var wifi = false
    private var mobile = false
    private var networkConnected = false
    private var lightBackground = false
    private var safeLeft = 0
    private var safeRight = 0
    private var formattedTime = ""

    private val ticker = object : Runnable {
        override fun run() {
            if (!running) return
            refreshData()
            val now = System.currentTimeMillis()
            tickHandler.postDelayed(this, 60000L - now % 60000L + 40L)
        }
    }
    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            post { if (running) refreshData() }
        }
        override fun onLost(network: Network) {
            post { if (running) refreshData() }
        }
        override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
            post { if (running) refreshData() }
        }
    }

    init {
        visibility = GONE
        isClickable = false
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        setBackgroundColor(Color.TRANSPARENT)
    }

    private fun dp(n: Float) = density * n

    fun setInsets(left: Int, right: Int) {
        if (safeLeft != left || safeRight != right) {
            safeLeft = left
            safeRight = right
            invalidate()
        }
    }

    fun setContrast(lightWallpaper: Boolean) {
        lightBackground = lightWallpaper
        invalidate()
    }

    fun startUpdates() {
        if (running) return
        running = true
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                connectivity.registerDefaultNetworkCallback(networkCallback)
                observingNetwork = true
            } catch (_: Exception) {
                observingNetwork = false
            }
        }
        ticker.run()
    }

    fun stopUpdates() {
        running = false
        tickHandler.removeCallbacks(ticker)
        if (observingNetwork) {
            try {
                connectivity.unregisterNetworkCallback(networkCallback)
            } catch (_: Exception) {
                // The OS may already have unregistered this callback.
            }
            observingNetwork = false
        }
    }

    private fun refreshData() {
        formattedTime = DateFormat.format(
            if (DateFormat.is24HourFormat(context)) "HH:mm" else "h:mm",
            System.currentTimeMillis()
        ).toString()
        try {
            val state = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            val level = state?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = state?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
            batteryPercent = if (level >= 0 && scale > 0) (level * 100 / scale).coerceIn(0, 100) else -1
            val batteryStatus = state?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
            charging = batteryStatus == BatteryManager.BATTERY_STATUS_CHARGING ||
                batteryStatus == BatteryManager.BATTERY_STATUS_FULL
        } catch (_: Exception) {
            batteryPercent = -1
            charging = false
        }
        try {
            val capabilities = connectivity.getNetworkCapabilities(connectivity.activeNetwork)
            wifi = capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
            mobile = capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true
            networkConnected = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        } catch (_: SecurityException) {
            wifi = false
            mobile = false
            networkConnected = false
        }
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val color = if (lightBackground) Color.rgb(16, 22, 28) else Color.WHITE
        graphics.color = color
        lettering.color = color
        val middle = height / 2f
        val baseline = middle - (lettering.fontMetrics.ascent + lettering.fontMetrics.descent) / 2f
        val x = safeLeft + dp(13f)
        lettering.textSize = 13f * scaledDensity
        val timeBaseline = middle - (lettering.fontMetrics.ascent + lettering.fontMetrics.descent) / 2f
        canvas.drawText(formattedTime, x, timeBaseline, lettering)

        lettering.textSize = 10.5f * scaledDensity
        val right = width - safeRight - dp(12f)
        val percent = if (batteryPercent >= 0) "$batteryPercent%" else "—%"
        val valueWidth = lettering.measureText(percent)
        val textBaseline = middle - (lettering.fontMetrics.ascent + lettering.fontMetrics.descent) / 2f
        canvas.drawText(percent, right - valueWidth, textBaseline, lettering)
        var cursor = right - valueWidth - dp(7f)

        val bx = cursor - dp(17f)
        val by = middle - dp(6f)
        // Square pixel battery outline and accurate fill level.
        canvas.drawRect(bx, by, bx + dp(14f), by + dp(2f), graphics)
        canvas.drawRect(bx, by + dp(10f), bx + dp(14f), by + dp(12f), graphics)
        canvas.drawRect(bx, by, bx + dp(2f), by + dp(12f), graphics)
        canvas.drawRect(bx + dp(12f), by, bx + dp(14f), by + dp(12f), graphics)
        canvas.drawRect(bx + dp(14f), by + dp(4f), bx + dp(16f), by + dp(8f), graphics)
        if (batteryPercent > 0) {
            val fillWidth = dp(8f) * batteryPercent / 100f
            canvas.drawRect(bx + dp(3f), by + dp(3f), bx + dp(3f) + fillWidth, by + dp(9f), graphics)
        }
        if (charging) {
            canvas.drawRect(bx + dp(6f), by - dp(2f), bx + dp(8f), by + dp(3f), graphics)
        }
        cursor = bx - dp(8f)

        if (wifi) {
            val wx = cursor - dp(18f)
            val wy = middle - dp(6f)
            // Two broad stepped arcs and a square centre, no smooth stock icons.
            canvas.drawRect(wx, wy, wx + dp(4f), wy + dp(2f), graphics)
            canvas.drawRect(wx + dp(4f), wy - dp(2f), wx + dp(14f), wy, graphics)
            canvas.drawRect(wx + dp(14f), wy, wx + dp(18f), wy + dp(2f), graphics)
            canvas.drawRect(wx + dp(4f), wy + dp(4f), wx + dp(7f), wy + dp(6f), graphics)
            canvas.drawRect(wx + dp(7f), wy + dp(2f), wx + dp(11f), wy + dp(4f), graphics)
            canvas.drawRect(wx + dp(11f), wy + dp(4f), wx + dp(14f), wy + dp(6f), graphics)
            canvas.drawRect(wx + dp(8f), wy + dp(8f), wx + dp(11f), wy + dp(11f), graphics)
            cursor = wx - dp(9f)
        }
        if (mobile) {
            // Active mobile network TYPE, not fabricated signal strength.
            lettering.textSize = 7.5f * scaledDensity
            val label = "CELL"
            val w = lettering.measureText(label)
            canvas.drawText(label, cursor - w, textBaseline, lettering)
            cursor -= w + dp(8f)
        } else if (!wifi && networkConnected) {
            // VPN or another transport is online; don't falsely label it Wi-Fi.
            lettering.textSize = 7.5f * scaledDensity
            val label = "NET"
            canvas.drawText(label, cursor - lettering.measureText(label), textBaseline, lettering)
        }
    }
}
