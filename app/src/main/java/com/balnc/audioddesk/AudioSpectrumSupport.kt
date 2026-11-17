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
    @Volatile private var active = false
    private var lastWaveAt = 0L
    private var lastFftAt = 0L
    @Volatile private var latestRms = 0.0

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
                        if (now - lastWaveAt < 30L) return
                        lastWaveAt = now
                        var sumSquares = 0.0
                        for (value in waveform) {
                            val pcm = ((value.toInt() and 255) - 128) / 128.0
                            sumSquares += pcm * pcm
                        }
                        latestRms = sqrt(sumSquares / waveform.size)
                        // Android devices may return waveform but no FFT callback.
                        // A genuine FFT of the ORIGINAL buffer handles that case;
                        // it does not convert the overall RMS to an oval.
                        if (now - lastFftAt > 450L) {
                            val pcm = FloatArray(waveform.size) { index ->
                                ((waveform[index].toInt() and 255) - 128) / 128f
                            }
                            val bands = SpectrumBands.fromPcm(pcm, samplingRate / 1000)
                            deliverSpectrum(latestRms, bands, "pcm-fft")
                        }
                    }
                    override fun onFftDataCapture(
                        visualizer: Visualizer?, fft: ByteArray?, samplingRate: Int
                    ) {
                        if (!active || fft == null || fft.size < 32) return
                        val now = android.os.SystemClock.uptimeMillis()
                        if (now - lastFftAt < 30L) return
                        lastFftAt = now
                        val bands = SpectrumBands.fromVisualizerFft(fft, samplingRate)
                        deliverSpectrum(latestRms, bands, "android-fft")
                    }
                }, Visualizer.getMaxCaptureRate().coerceAtMost(30000), true, true)
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

    private fun deliverSpectrum(rms: Double, bands: FloatArray, source: String) {
        if (!active && source != "projection-fft") return
        // No synthetic movement: silence yields 28 exact zeros.
        val output = JSONArray()
        for (band in bands) output.put(
            if (rms < .006) 0.0 else (band * 1000).toInt() / 1000.0
        )
        deliver(JSONObject().put("state", "capturing")
            .put("rms", rms.coerceIn(0.0, 1.0))
            .put("bands", output)
            .put("source", source))
    }

    fun deliverProjection(samples: FloatArray) {
        if (samples.isEmpty()) return
        val sum = samples.sumOf { it.toDouble() * it.toDouble() } / samples.size
        val rms = sqrt(sum).coerceIn(0.0, 1.0)
        // Projection supplies full PCM frames. The FFT is derived from that
        // audio, so even this fallback reacts to frequencies, not RMS alone.
        val bands = SpectrumBands.fromPcm(samples, 16000)
        deliverSpectrum(rms, bands, "projection-fft")
    }

    fun signal(state: String) {
        deliver(JSONObject().put("state", state))
    }

    fun stop() {
        active = false
        val v = visualizer
        visualizer = null
        latestRms = 0.0
        lastFftAt = 0L
        if (v != null) try {
            v.enabled = false
            v.release()
        } catch (_: RuntimeException) { /* Device visualizers can disappear. */ }
        signal("stopped")
    }

    fun close() = stop()
}
