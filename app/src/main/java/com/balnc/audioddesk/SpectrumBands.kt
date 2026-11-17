package com.balnc.audioddesk

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Real frequency energy for a multi-line music spectrum.
 * 28 logarithmic 80–10000Hz bands, not a single RMS-filled oval.
 *
 * Visualizer(0) supplies Android's packed real/imag FFT (8-bit).
 * Projection supplies genuine PCM from which an FFT is calculated locally.
 * Both paths are deliberately silence-preserving.
 */
internal object SpectrumBands {
    const val COUNT = 28
    private const val LOW_HZ = 75.0
    private const val HIGH_HZ = 10500.0

    private fun bandForFrequency(hz: Double): Int {
        if (hz <= LOW_HZ) return 0
        val fraction = ln(hz / LOW_HZ) / ln(HIGH_HZ / LOW_HZ)
        return (fraction * COUNT).toInt().coerceIn(0, COUNT - 1)
    }

    fun fromVisualizerFft(fft: ByteArray, rateMilliHz: Int): FloatArray {
        val out = FloatArray(COUNT)
        val size = fft.size
        if (size < 32 || rateMilliHz <= 0) return out
        // Android's Visualizer FFT packing: [DC, Nyquist, re(1), im(1), ...].
        // The samplingRate callback uses milliHertz, not Hertz.
        val rateHz = rateMilliHz / 1000.0
        for (bin in 1 until size / 2) {
            val frequency = bin * rateHz / size
            if (frequency < LOW_HZ || frequency > HIGH_HZ) continue
            val real = fft[bin * 2].toDouble()
            val imag = fft[bin * 2 + 1].toDouble()
            val magnitude = sqrt(real * real + imag * imag)
            // Ignore the ADC/FFT floor and use logarithmic dynamic range.
            val normalized = (ln(1.0 + max(0.0, magnitude - 2.0)) /
                ln(1.0 + 90.0)).coerceIn(0.0, 1.0)
            val band = bandForFrequency(frequency)
            out[band] = max(out[band], normalized.toFloat())
        }
        return out
    }

    fun fromPcm(pcm: FloatArray, sampleRate: Int): FloatArray {
        val out = FloatArray(COUNT)
        if (pcm.size < 128 || sampleRate < 8000) return out
        val n = Integer.highestOneBit(min(2048, pcm.size))
        if (n < 128) return out
        // Decimation of the raw output is NOT used. A Hanning window prevents
        // harsh leakage at the edges of a streaming 1024-frame record.
        val real = DoubleArray(n)
        val imag = DoubleArray(n)
        for (i in 0 until n) {
            val w = .5 - .5 * cos(2.0 * PI * i / (n - 1))
            real[i] = pcm[i].toDouble().coerceIn(-1.0, 1.0) * w
        }
        // Iterative radix-2 FFT. O(N log N), no JNI or third-party library.
        var j = 0
        for (i in 1 until n) {
            var bit = n shr 1
            while ((j and bit) != 0) {
                j = j xor bit
                bit = bit shr 1
            }
            j = j xor bit
            if (i < j) {
                val r = real[i];real[i] = real[j];real[j] = r
                val im = imag[i];imag[i] = imag[j];imag[j] = im
            }
        }
        var length = 2
        while (length <= n) {
            val angle = -2.0 * PI / length
            val wr = cos(angle);val wi = sin(angle)
            var start = 0
            while (start < n) {
                var cr = 1.0;var ci = 0.0
                for (k in 0 until length / 2) {
                    val even = start + k;val odd = even + length / 2
                    val tr = cr * real[odd] - ci * imag[odd]
                    val ti = cr * imag[odd] + ci * real[odd]
                    real[odd] = real[even] - tr
                    imag[odd] = imag[even] - ti
                    real[even] += tr;imag[even] += ti
                    val nr = cr * wr - ci * wi
                    ci = cr * wi;cr = nr
                }
                start += length
            }
            length = length shl 1
        }
        for (bin in 1 until n / 2) {
            val frequency = bin * sampleRate.toDouble() / n
            if (frequency < LOW_HZ || frequency > HIGH_HZ) continue
            // Window-corrected single-sided magnitude is a physical PCM
            // amplitude, not a simulated frequency-activity score.
            val magnitude = sqrt(real[bin] * real[bin] +
                imag[bin] * imag[bin]) * 4.0 / n
            val normalized = (ln(1.0 + magnitude * 140.0) /
                ln(1.0 + 140.0)).coerceIn(0.0, 1.0)
            val band = bandForFrequency(frequency)
            out[band] = max(out[band], normalized.toFloat())
        }
        return out
    }

    fun isSilent(bands: FloatArray): Boolean = bands.all { it < .001f }
}
