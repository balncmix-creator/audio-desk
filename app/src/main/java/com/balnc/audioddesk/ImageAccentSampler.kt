package com.balnc.audioddesk

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.util.LruCache
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.URL
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Samples public publisher images off the UI thread without requiring canvas CORS. */
class ImageAccentSampler(private val userAgent: String) {
    private val cache = LruCache<String, Int>(64)
    private val executor = ThreadPoolExecutor(2, 2, 30, TimeUnit.SECONDS, ArrayBlockingQueue<Runnable>(16), ThreadPoolExecutor.DiscardPolicy())

    fun sample(raw: String, result: (Int?) -> Unit) {
        executor.execute {
            val cached = cache.get(raw)
            if (cached != null) { result(cached.takeUnless { it == Color.TRANSPARENT }); return@execute }
            val color = try { readImage(raw)?.let { bitmap ->
                try { dominantColor(bitmap) } finally { bitmap.recycle() }
            } } catch (_: Exception) { null }
            cache.put(raw, color ?: Color.TRANSPARENT)
            result(color)
        }
    }

    fun close() { executor.shutdownNow() }

    private fun readImage(raw: String): Bitmap? {
        if (raw.length > 4096) return null
        var url = URL(raw)
        repeat(4) {
            if (url.protocol != "https" || url.userInfo != null || (url.port != -1 && url.port != 443)) return null
            val addresses = InetAddress.getAllByName(url.host)
            if (addresses.isEmpty() || addresses.any { !isPublicAddress(it) }) return null
            val connection = url.openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = 3000
                connection.readTimeout = 3000
                connection.instanceFollowRedirects = false
                connection.setRequestProperty("Accept", "image/*")
                connection.setRequestProperty("User-Agent", userAgent)
                val status = connection.responseCode
                if (status in listOf(301, 302, 303, 307, 308)) {
                    url = URL(url, connection.getHeaderField("Location") ?: return null)
                    return@repeat
                }
                if (status != 200 || connection.contentLength > MAX_BYTES) return null
                val bytes = connection.inputStream.use { input ->
                    val output = java.io.ByteArrayOutputStream()
                    val buffer = ByteArray(8192)
                    while (!Thread.currentThread().isInterrupted) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        if (output.size() + count > MAX_BYTES) return null
                        output.write(buffer, 0, count)
                    }
                    output.toByteArray()
                }
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || bounds.outWidth.toLong() * bounds.outHeight > 50_000_000L) return null
                var sample = 1
                while (max(bounds.outWidth, bounds.outHeight) / sample > 64) sample *= 2
                return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
            } finally { connection.disconnect() }
        }
        return null
    }

    companion object {
        private const val MAX_BYTES = 3 * 1024 * 1024

        internal fun isPublicAddress(address: InetAddress): Boolean {
            val first = address.address[0].toInt() and 255
            return !address.isAnyLocalAddress && !address.isLoopbackAddress && !address.isLinkLocalAddress &&
                !address.isSiteLocalAddress && !address.isMulticastAddress &&
                !(address.address.size == 16 && (first and 254) == 252)
        }

        internal fun dominantColor(bitmap: Bitmap): Int? {
            val buckets = Array(24) { DoubleArray(4) }
            val hsv = FloatArray(3)
            for (y in 0 until bitmap.height) for (x in 0 until bitmap.width) {
                val color = bitmap.getPixel(x, y)
                val alpha = Color.alpha(color) / 255.0
                Color.colorToHSV(color, hsv)
                if (alpha < .5 || hsv[1] < .18f || hsv[2] < .12f) continue
                val weight = hsv[1] * (.3 + hsv[2]) * alpha
                val bucket = buckets[min(23, (hsv[0] / 15).toInt())]
                bucket[0] += weight
                bucket[1] += Color.red(color) * weight
                bucket[2] += Color.green(color) * weight
                bucket[3] += Color.blue(color) * weight
            }
            val best = buckets.maxByOrNull { it[0] } ?: return null
            if (best[0] == 0.0) return null
            return Color.rgb((best[1]/best[0]).roundToInt(), (best[2]/best[0]).roundToInt(), (best[3]/best[0]).roundToInt())
        }
    }
}
