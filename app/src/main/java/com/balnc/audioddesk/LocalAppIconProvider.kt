package com.balnc.audioddesk

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.Drawable
import android.graphics.drawable.AdaptiveIconDrawable
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
    // Twenty original, on-device generated icon families. Unlike downloaded
    // third-party artwork, all packs cover every launchable application.
    private val packInk = mapOf(
        "ink" to intArrayOf(26, 28, 31, 241, 242, 240),
        "pearl" to intArrayOf(67, 70, 74, 249, 244, 233),
        "graphite" to intArrayOf(57, 63, 69, 218, 227, 232),
        "sage" to intArrayOf(53, 85, 68, 212, 234, 216),
        "moss" to intArrayOf(32, 70, 54, 184, 221, 153),
        "copper" to intArrayOf(101, 48, 33, 251, 186, 129),
        "sand" to intArrayOf(119, 92, 62, 244, 218, 177),
        "rose" to intArrayOf(121, 61, 86, 248, 194, 207),
        "lavender" to intArrayOf(74, 55, 122, 219, 193, 248),
        "ocean" to intArrayOf(23, 71, 120, 151, 210, 250),
        "sky" to intArrayOf(18, 100, 130, 178, 231, 246),
        "ember" to intArrayOf(107, 32, 39, 251, 156, 103),
        "citrus" to intArrayOf(99, 91, 20, 249, 245, 151),
        "mint" to intArrayOf(22, 106, 78, 171, 251, 191),
        "neon" to intArrayOf(33, 84, 119, 116, 252, 244),
        "dusk" to intArrayOf(54, 42, 98, 209, 152, 238),
        "arcade" to intArrayOf(80, 49, 124, 246, 192, 249),
        "blueprint" to intArrayOf(22, 57, 111, 173, 214, 255),
        "paper" to intArrayOf(58, 51, 45, 239, 223, 199),
        "glass" to intArrayOf(40, 50, 60, 240, 240, 240)
    )
    private val route = Regex("^(original|minimal|pixel|windows|warm|orbit|pack-[a-z0-9-]{2,20})/([A-Za-z0-9_.]{4,180})\\.png$")
    private val cache = object : LruCache<String, ByteArray>(8 * 1024) {
        override fun sizeOf(key: String, value: ByteArray): Int =
            (value.size + 1023) / 1024
    }

    override fun handle(path: String): WebResourceResponse {
        val match = route.matchEntire(path)
        if (match == null) return empty()
        val theme = match.groupValues[1]
        if (theme.startsWith("pack-") && theme.removePrefix("pack-") !in packInk) return empty()
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

    /**
     * A legacy icon may include an opaque rectangular matte. Remove ONLY the
     * edge-connected matte (not internal whites in app logos). Adaptive icons
     * use their actual foreground layer instead and never need guessing.
     */
    private fun clearUniformLegacyBackground(pixels: IntArray, size: Int) {
        val n = size * size
        val corners = intArrayOf(
            pixels[6 * size + 6], pixels[6 * size + size - 7],
            pixels[(size - 7) * size + 6], pixels[(size - 7) * size + size - 7]
        )
        if (corners.any { Color.alpha(it) < 225 }) return
        val anchor = corners[0]
        fun distance(a: Int, b: Int): Int =
            maxOf(kotlin.math.abs(Color.red(a) - Color.red(b)),
                kotlin.math.abs(Color.green(a) - Color.green(b)),
                kotlin.math.abs(Color.blue(a) - Color.blue(b)))
        if (corners.any { distance(it, anchor) > 25 }) return
        val work = IntArray(n)
        val visited = BooleanArray(n)
        var end = 0
        // Seed near drawable's original bounds; corners of the transparent
        // 4px padding are ignored while checking a possible solid matte.
        for (i in 5 until size - 5) {
            for (at in intArrayOf(5 * size + i, (size - 6) * size + i,
                i * size + 5, i * size + size - 6)) {
                if (!visited[at] && Color.alpha(pixels[at]) > 180 &&
                    distance(pixels[at], anchor) < 35) {
                    visited[at] = true
                    work[end++] = at
                }
            }
        }
        var first = 0
        while (first < end) {
            val at = work[first++]
            val x = at % size
            val y = at / size
            val neighbors = intArrayOf(
                if (x > 0) at - 1 else -1,
                if (x < size - 1) at + 1 else -1,
                if (y > 0) at - size else -1,
                if (y < size - 1) at + size else -1
            )
            for (next in neighbors) {
                if (next < 0 || visited[next]) continue
                if (Color.alpha(pixels[next]) < 180 ||
                    distance(pixels[next], anchor) >= 35) continue
                visited[next] = true
                work[end++] = next
            }
        }
        // Don't strip a legitimate near-solid app glyph.
        if (end < 40 || end >= n * 90 / 100) return
        for (i in 0 until end) pixels[work[i]] = Color.TRANSPARENT
    }

    private fun generate(drawable: Drawable, theme: String): ByteArray? {
        val size = if (theme == "pixel" || theme == "pack-arcade") 32 else 128
        val raw = Bitmap.createBitmap(128, 128, Bitmap.Config.ARGB_8888)
        try {
            val canvas = Canvas(raw)
            // The Windows tile itself supplies the background color. Draw
            // only an adaptive icon's FOREGROUND layer to avoid the double
            // square/circle backing seen around GPay, ChatGPT, WhatsApp, etc.
            val pack = theme.removePrefix("pack-").takeIf { theme.startsWith("pack-") }
            // For all generated packs, draw the logo rather than stacking the
            // stock adaptive-icon background inside another tile.
            val glyph: Drawable = if ((theme == "windows" ||
                    (pack != null && pack != "glass")) && drawable is AdaptiveIconDrawable)
                drawable.foreground ?: drawable else drawable
            val original = glyph.bounds
            glyph.setBounds(4, 4, 124, 124)
            glyph.draw(canvas)
            glyph.bounds = original

            val scaled = if (size == 128) raw else
                Bitmap.createScaledBitmap(raw, size, size, false)
            val result: Bitmap
            if (theme == "original" || theme == "pack-glass") {
                result = scaled
            } else {
                result = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
                val pixels = IntArray(size * size)
                scaled.getPixels(pixels, 0, size, 0, 0, size, size)
                // Legacy matte removal was designed for white Windows tiles.
                // Running it over arbitrary pack colors can ERASE app glyphs
                // (especially white logos and near-solid branded icons), leaving
                // only fragmentary marks on the dial. Keep source silhouettes
                // intact for generated pack styles.
                if (theme == "windows" && drawable !is AdaptiveIconDrawable &&
                    size == 128)
                    clearUniformLegacyBackground(pixels, size)
                for (i in pixels.indices) {
                    val p = pixels[i]
                    val alpha = Color.alpha(p)
                    if (alpha == 0) continue
                    val luminance =
                        (Color.red(p) * 54 + Color.green(p) * 183 +
                            Color.blue(p) * 19) / 256
                    val mapped = when {
                        pack != null -> {
                            val swatch = packInk[pack] ?: return null
                            // A consistent two-tone graphic is generated from
                            // the user's own installed app artwork, locally.
                            // Preserve original alpha for edge quality.
                            val tone = if (pack == "ink" || pack == "blueprint" ||
                                pack == "paper") {
                                if (luminance < 113) 0.13f else 0.92f
                            } else if (pack == "arcade") {
                                (luminance / 85).coerceIn(0, 3) / 3f
                            } else {
                                (luminance / 255f).coerceIn(0f, 1f)
                            }
                            Color.rgb(
                                (swatch[0] + (swatch[3] - swatch[0]) * tone).toInt().coerceIn(0,255),
                                (swatch[1] + (swatch[4] - swatch[1]) * tone).toInt().coerceIn(0,255),
                                (swatch[2] + (swatch[5] - swatch[2]) * tone).toInt().coerceIn(0,255)
                            )
                        }
                        theme == "warm" -> Color.rgb(
                            39 + luminance * 195 / 255,
                            32 + luminance * 181 / 255,
                            37 + luminance * 181 / 255
                        )
                        theme == "windows" -> Color.rgb(255, 255, 255)
                        // Orbit uses a muted sage-coloured foreground matching the radial dial.
                        theme == "orbit" -> {
                            val grey = 72 + luminance * 177 / 255
                            Color.rgb((grey - 8).coerceAtLeast(0), grey,
                                (grey - 3).coerceAtLeast(0))
                        }
                        theme == "pixel" -> {
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
