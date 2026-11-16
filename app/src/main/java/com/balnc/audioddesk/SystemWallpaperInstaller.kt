package com.balnc.audioddesk

import android.app.WallpaperManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import android.os.Build
import android.util.Base64
import java.io.IOException
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/**
 * Applies a user-selected, static image to Android's actual system Home wallpaper.
 * This runs off the UI thread, never polls, and drops superseded selections.
 * Animation effects are intentionally local to the launcher WebView; Android live
 * wallpaper needs a separate WallpaperService implementation.
 */
class SystemWallpaperInstaller(private val context: Context) {
    private val worker = Executors.newSingleThreadExecutor()
    private val latest = AtomicInteger()

    fun applyBundled(
        id: String, position: Int, lock: Boolean, requestId: Int,
        result: (Int, Boolean, String) -> Unit
    ) {
        if (!id.matches(Regex("^[a-z0-9-]{1,64}$"))) {
            result(requestId, false, "Invalid bundled wallpaper.")
            return
        }
        submit(position, lock, requestId, result) {
            context.assets.open("wallpapers/$id.webp").use { it.readBytes() }
        }
    }

    fun applyCustom(
        dataUrl: String, position: Int, lock: Boolean, requestId: Int,
        result: (Int, Boolean, String) -> Unit
    ) {
        val match = Regex("^data:image/(?:webp|png|jpeg);base64,([A-Za-z0-9+/=]+)$")
            .matchEntire(dataUrl)
        if (match == null || dataUrl.length > 12_000_000) {
            result(requestId, false, "Invalid or oversized photo.")
            return
        }
        val encoded = match.groupValues[1]
        submit(position, lock, requestId, result) {
            Base64.decode(encoded, Base64.DEFAULT).also {
                if (it.isEmpty() || it.size > 9_000_000)
                    throw IOException("Photo exceeds the supported wallpaper size.")
            }
        }
    }

    private fun submit(
        position: Int, lock: Boolean, requestId: Int,
        result: (Int, Boolean, String) -> Unit, source: () -> ByteArray
    ) {
        val token = latest.incrementAndGet()
        worker.execute {
            try {
                if (token != latest.get()) return@execute
                val bytes = source()
                if (token != latest.get()) return@execute
                val bitmap = decodeBounded(bytes)
                try {
                    if (token != latest.get()) return@execute
                    val manager = WallpaperManager.getInstance(context)
                    if (!manager.isWallpaperSupported ||
                        (Build.VERSION.SDK_INT >= 24 && !manager.isSetWallpaperAllowed))
                        throw SecurityException("System wallpaper changes are disabled on this device.")
                    val crop = cropForPhone(bitmap, position)
                    if (Build.VERSION.SDK_INT >= 24) {
                        val flags = WallpaperManager.FLAG_SYSTEM or
                            (if (lock) WallpaperManager.FLAG_LOCK else 0)
                        if (manager.setBitmap(bitmap, crop, false, flags) == 0)
                            throw IOException("Android did not accept the image.")
                    } else {
                        // Android 6 has no separate FLAG_SYSTEM / FLAG_LOCK API.
                        manager.setBitmap(bitmap)
                    }
                    if (token == latest.get()) result(requestId, true, "Applied")
                } finally {
                    bitmap.recycle()
                }
            } catch (e: OutOfMemoryError) {
                if (token == latest.get())
                    result(requestId, false, "Not enough free memory. Try a smaller image.")
            } catch (e: Exception) {
                if (token == latest.get())
                    result(requestId, false, e.message ?: "Android rejected the wallpaper.")
            }
        }
    }

    private fun decodeBounded(bytes: ByteArray): Bitmap {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth < 1 || bounds.outHeight < 1)
            throw IOException("This image format cannot be decoded as a wallpaper.")
        var sample = 1
        while (bounds.outWidth / sample > 1920 || bounds.outHeight / sample > 3200)
            sample *= 2
        val options = BitmapFactory.Options().apply {
            inSampleSize = sample
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
            ?: throw IOException("Android could not decode the wallpaper image.")
    }

    private fun cropForPhone(bitmap: Bitmap, position: Int): Rect {
        val metrics = context.resources.displayMetrics
        val deviceRatio = (metrics.widthPixels.toFloat() /
            metrics.heightPixels.coerceAtLeast(1)).coerceIn(.2f, 2f)
        val bitmapRatio = bitmap.width.toFloat() / bitmap.height.coerceAtLeast(1)
        return if (bitmapRatio > deviceRatio) {
            val width = (bitmap.height * deviceRatio).toInt().coerceIn(1, bitmap.width)
            val left = ((bitmap.width - width) * position.coerceIn(0, 100) / 100f)
                .toInt().coerceIn(0, bitmap.width - width)
            Rect(left, 0, left + width, bitmap.height)
        } else {
            val height = (bitmap.width / deviceRatio).toInt().coerceIn(1, bitmap.height)
            val top = (bitmap.height - height) / 2
            Rect(0, top, bitmap.width, top + height)
        }
    }

    fun close() {
        latest.incrementAndGet()
        worker.shutdownNow()
    }
}
