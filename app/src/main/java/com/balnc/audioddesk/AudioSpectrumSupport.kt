package com.balnc.audioddesk

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.media.audiofx.Visualizer
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.sqrt

/**
 * Genuine output-mix PCM waveform data, only while Audio Desk is foreground.
 * Android may refuse global-mix visualization, in which case the UI offers
 * explicit MediaProjection playback capture (Android 10+) or rests at zero.
 *
 * Never uses the microphone as an approximation and never records/saves audio.
 */
internal class AudioSpectrumSupport(
    private val activity: Activity,
    private val deliver: (JSONObject) -> Unit
) {
    private var visualizer: Visualizer? = null
    private var active = false
    private var lastWaveAt = 0L

    fun hasPermission(): Boolean =
        activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    fun start(): Boolean {
        if (!hasPermission()) {
            signal("permission")
            return false
        }
        if (visualizer != null) return true
        try {
            val v = Visualizer(0)
            try {
                v.enabled = false
                val range = Visualizer.getCaptureSizeRange()
                v.captureSize = range[1].coerceAtMost(1024).coerceAtLeast(range[0])
                v.setDataCaptureListener(object : Visualizer.OnDataCaptureListener {
                    override fun onWaveFormDataCapture(
                        visualizer: Visualizer?, waveform: ByteArray?, samplingRate: Int
                    ) {
                        if (!active || waveform == null || waveform.isEmpty()) return
                        val now = android.os.SystemClock.uptimeMillis()
                        if (now - lastWaveAt < 45L) return
                        lastWaveAt = now
                        val samples = FloatArray(96) { i ->
                            val index = (i.toLong() * waveform.size / 96).toInt()
                                .coerceIn(0, waveform.lastIndex)
                            (((waveform[index].toInt() and 255) - 128) / 128f)
                        }
                        deliverWave(samples)
                    }
                    override fun onFftDataCapture(
                        visualizer: Visualizer?, fft: ByteArray?, samplingRate: Int
                    ) { /* The displayed wave uses REAL PCM; never synthetic FFT motion. */ }
                }, Visualizer.getMaxCaptureRate().coerceAtMost(18000), true, false)
                active = true
                v.enabled = true
                visualizer = v
                signal("listening")
                return true
            } catch (exception: Exception) {
                try { v.release() } catch (_: Exception) {}
                throw exception
            }
        } catch (_: SecurityException) {
            active = false
            signal("unsupported")
        } catch (_: RuntimeException) {
            active = false
            signal("unsupported")
        } catch (_: UnsupportedOperationException) {
            active = false
            signal("unsupported")
        }
        return false
    }

    private fun deliverWave(samples: FloatArray) {
        if (!active) return
        val sum = samples.sumOf { it.toDouble() * it.toDouble() } / samples.size
        val rms = sqrt(sum).coerceIn(0.0, 1.0)
        // Silence stays silence: the client must never generate random motion.
        val array = JSONArray()
        if (rms < .006) repeat(samples.size) { array.put(0.0) }
        else for (sample in samples) array.put((sample * 1000).toInt() / 1000.0)
        deliver(JSONObject().put("state", "capturing")
            .put("rms", rms).put("samples", array))
    }

    fun deliverProjection(samples: FloatArray) = deliverWave(samples)

    fun signal(state: String) {
        deliver(JSONObject().put("state", state))
    }

    fun stop() {
        active = false
        val v = visualizer
        visualizer = null
        if (v != null) try {
            v.enabled = false
            v.release()
        } catch (_: RuntimeException) { /* Device visualizers can disappear. */ }
        signal("stopped")
    }

    fun close() = stop()
}
