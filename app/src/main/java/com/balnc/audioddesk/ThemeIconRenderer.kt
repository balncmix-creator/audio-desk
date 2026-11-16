package com.balnc.audioddesk

import android.app.Activity
import android.content.ComponentName
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.drawable.Drawable
import android.util.Base64
import android.util.LruCache
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest

/**
 * A lightweight, entirely offline icon designer. It uses only icon artwork exposed
 * by the app's Android launcher activity, preserving recognisable details, and
 * remaps tones to Audio Desk's selected visual style. No network, screenshots,
 * AI downloads, or permission to enumerate arbitrary packages.
 *
 * Disk cache is private to Audio Desk, bounded to 6 MB; browser asks only for
 * icons in or near the visible viewport. Android may safely evict this cache.
 */
internal class ThemeIconRenderer(private val activity: Activity) {
    private val memory = object : LruCache<String, String>(2 * 1024 * 1024) {
        override fun sizeOf(key: String, value: String): Int = value.length * 2
    }
    private val directory by lazy { File(activity.cacheDir, "themed-app-icons-v1") }
    private var sincePrune = 0
    private val maxCacheBytes = 6L * 1024 * 1024

    fun render(pkg: String, className: String, theme: String): String? {
        if (theme !in setOf("minimal", "pixel", "windows", "warm")) return null
        val updated = try {
            @Suppress("DEPRECATION")
            activity.packageManager.getPackageInfo(pkg, 0).lastUpdateTime
        } catch (_: Exception) { 0L }
        val key = "$pkg/$className|$theme|$updated|v1"
        memory.get(key)?.let { return it }

        val cacheFile = File(directory, key.sha256() + ".png")
        if (cacheFile.isFile && cacheFile.length() in 64..50_000) {
            try {
                val raw = cacheFile.readBytes()
                val uri = pngUrl(raw)
                memory.put(key, uri)
                cacheFile.setLastModified(System.currentTimeMillis())
                return uri
            } catch (_: Exception) { /* regenerate */ }
        }

        val drawable = try {
            activity.packageManager.getActivityIcon(ComponentName(pkg, className))
        } catch (_: Exception) {
            try { activity.packageManager.getApplicationIcon(pkg) }
            catch (_: Exception) { return null }
        }
        val bytes = try { design(drawable, theme) } catch (_: Exception) { null } ?: return null
        try {
            directory.mkdirs()
            cacheFile.writeBytes(bytes)
            if (++sincePrune >= 24) { sincePrune = 0; prune() }
        } catch (_: Exception) { /* cache is optional */ }
        return pngUrl(bytes).also { memory.put(key, it) }
    }

    private fun design(drawable: Drawable, theme: String): ByteArray? {
        val sourceSize = if (theme == "pixel") 24 else 72
        val source = Bitmap.createBitmap(sourceSize, sourceSize, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(source)
        try {
            drawable.mutate().setBounds(0, 0, sourceSize, sourceSize)
            drawable.draw(canvas)
        } catch (_: Exception) {
            source.recycle()
            return null
        }

        val data = IntArray(sourceSize * sourceSize)
        source.getPixels(data, 0, sourceSize, 0, 0, sourceSize, sourceSize)
        val palette = when (theme) {
            "warm" -> intArrayOf(0xFF34272D.toInt(), 0xFF745A64.toInt(),
                0xFFC79C9B.toInt(), 0xFFF6E6DE.toInt())
            "windows" -> intArrayOf(0xFF0A2745.toInt(), 0xFF1B5489.toInt(),
                0xFF3DA8E0.toInt(), 0xFFDCF4FF.toInt())
            "pixel" -> intArrayOf(0xFF100C26.toInt(), 0xFF473075.toInt(),
                0xFFA783DB.toInt(), 0xFFF1C7FD.toInt())
            else -> intArrayOf(0xFF20272B.toInt(), 0xFF68757D.toInt(),
                0xFFB6C0C6.toInt(), 0xFFF4F6F7.toInt())
        }

        // We preserve the original icon's luminance and alpha rather than filling
        // all opaque adaptive icon backgrounds with an indistinguishable silhouette.
        // Four complementary tonal inks supply coherent, recognisable theme art.
        for (i in data.indices) {
            val pixel = data[i]
            val alpha = Color.alpha(pixel)
            if (alpha < 8) { data[i] = Color.TRANSPARENT; continue }
            val lum = (Color.red(pixel) * 0.2126f +
                Color.green(pixel) * 0.7152f + Color.blue(pixel) * 0.0722f).toInt()
            val index = when {
                lum < 62 -> 0
                lum < 128 -> 1
                lum < 196 -> 2
                else -> 3
            }
            val ink = palette[index]
            data[i] = Color.argb(alpha, Color.red(ink), Color.green(ink), Color.blue(ink))
        }
        source.setPixels(data, 0, sourceSize, 0, 0, sourceSize, sourceSize)
        val sized = if (theme == "pixel") {
            val target = Bitmap.createBitmap(72, 72, Bitmap.Config.ARGB_8888)
            Canvas(target).drawBitmap(source, null,
                android.graphics.Rect(0, 0, 72, 72), Paint().apply { isFilterBitmap = false })
            target
        } else source

        val output = ByteArrayOutputStream()
        sized.compress(Bitmap.CompressFormat.PNG, 100, output)
        if (sized !== source) sized.recycle()
        source.recycle()
        return output.toByteArray().takeIf { it.size in 64..50_000 }
    }

    private fun prune() {
        try {
            val entries = directory.listFiles()?.filter { it.isFile && it.extension == "png" }
                ?.sortedByDescending { it.lastModified() } ?: return
            var size = 0L
            entries.forEach { file ->
                size += file.length()
                if (size > maxCacheBytes) file.delete()
            }
        } catch (_: Exception) { }
    }

    private fun pngUrl(data: ByteArray) =
        "data:image/png;base64," + Base64.encodeToString(data, Base64.NO_WRAP)

    private fun String.sha256(): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }
}
