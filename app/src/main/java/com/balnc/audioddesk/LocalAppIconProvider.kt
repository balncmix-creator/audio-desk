package com.balnc.audioddesk

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.Drawable
import android.util.LruCache
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

/**
 * Private, on-device, lazily generated icon pack for every installed launchable app.
 *
 * The WebView requests only icons that enter its viewport (loading=lazy). The
 * request is served by WebViewAssetLoader, never by the network, and may access
 * only packages already verified in HomeLauncherSupport's launcher app scan.
 * No installed-app list, drawable or icon is uploaded anywhere.
 */
internal class LocalAppIconProvider(
    private val context: Context,
    private val isLaunchable: (String) -> Boolean
) : WebViewAssetLoader.PathHandler {
    private val route = Regex("^(original|minimal|pixel|windows|warm)/([A-Za-z0-9_.]{4,180})\\.png$")
    private val cache = object : LruCache<String, ByteArray>(8 * 1024) {
        override fun sizeOf(key: String, value: ByteArray): Int =
            (value.size + 1023) / 1024
    }

    override fun handle(path: String): WebResourceResponse {
        val match = route.matchEntire(path)
        if (match == null) return empty()
        val theme = match.groupValues[1]
        val pkg = match.groupValues[2]
        if (!isLaunchable(pkg)) return empty()
        val key = "$theme/$pkg"
        cache.get(key)?.let { return png(it) }
        val bytes = try {
            val drawable = context.packageManager.getApplicationIcon(pkg)
            generate(drawable, theme)
        } catch (_: Exception) { null }
        if (bytes == null || bytes.isEmpty()) return empty()
        cache.put(key, bytes)
        return png(bytes)
    }

    private fun png(bytes: ByteArray) =
        WebResourceResponse("image/png", null, ByteArrayInputStream(bytes))

    private fun empty() =
        WebResourceResponse("text/plain", "UTF-8", ByteArrayInputStream(ByteArray(0)))

    private fun generate(drawable: Drawable, theme: String): ByteArray? {
        val size = if (theme == "pixel") 32 else 128
        val raw = Bitmap.createBitmap(128, 128, Bitmap.Config.ARGB_8888)
        try {
            val canvas = Canvas(raw)
            val original = drawable.bounds
            drawable.setBounds(4, 4, 124, 124)
            drawable.draw(canvas)
            drawable.bounds = original

            val scaled = if (size == 128) raw else
                Bitmap.createScaledBitmap(raw, size, size, false)
            val result: Bitmap
            if (theme == "original") {
                result = scaled
            } else {
                result = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
                val pixels = IntArray(size * size)
                scaled.getPixels(pixels, 0, size, 0, 0, size, size)
                for (i in pixels.indices) {
                    val p = pixels[i]
                    val alpha = Color.alpha(p)
                    if (alpha == 0) continue
                    val luminance =
                        (Color.red(p) * 54 + Color.green(p) * 183 +
                            Color.blue(p) * 19) / 256
                    val mapped = when (theme) {
                        "warm" -> Color.rgb(
                            39 + luminance * 195 / 255,
                            32 + luminance * 181 / 255,
                            37 + luminance * 181 / 255
                        )
                        "windows" -> Color.rgb(
                            30 + luminance * 190 / 255,
                            72 + luminance * 172 / 255,
                            111 + luminance * 138 / 255
                        )
                        "pixel" -> {
                            val swatch = intArrayOf(
                                Color.rgb(28, 19, 42),
                                Color.rgb(86, 63, 112),
                                Color.rgb(163, 126, 199),
                                Color.rgb(241, 220, 255)
                            )
                            swatch[(luminance / 64).coerceIn(0, 3)]
                        }
                        else -> {
                            val grey = 47 + luminance * 190 / 255
                            Color.rgb(grey, (grey + 3).coerceAtMost(255),
                                (grey + 6).coerceAtMost(255))
                        }
                    }
                    pixels[i] = Color.argb(alpha, Color.red(mapped),
                        Color.green(mapped), Color.blue(mapped))
                }
                result.setPixels(pixels, 0, size, 0, 0, size, size)
            }
            val out = ByteArrayOutputStream(16 * 1024)
            return try {
                if (result.compress(Bitmap.CompressFormat.PNG, 100, out)) out.toByteArray()
                else null
            } finally {
                if (result !== raw) result.recycle()
                if (scaled !== raw && scaled !== result) scaled.recycle()
                out.close()
            }
        } finally { raw.recycle() }
    }
}
