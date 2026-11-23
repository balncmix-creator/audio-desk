package com.balnc.audioddesk

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.sin

class SpectrumBandsTest {
    @Test fun zeroPcmNeverMakesAVisualWave() {
        val bands = SpectrumBands.fromPcm(FloatArray(1024), 16000)
        assertEquals(SpectrumBands.COUNT, bands.size)
        assertTrue("digital silence is a flat line", SpectrumBands.isSilent(bands))
    }

    @Test fun differentFrequenciesProduceDifferentShapesAtEqualRms() {
        fun tone(frequency: Double): FloatArray =
            FloatArray(1024) { i -> (.70 * sin(2 * PI * i * frequency / 16000)).toFloat() }
        val bass = SpectrumBands.fromPcm(tone(190.0), 16000)
        val treble = SpectrumBands.fromPcm(tone(2900.0), 16000)
        val bassIndex = bass.indices.maxByOrNull { bass[it] } ?: -1
        val trebleIndex = treble.indices.maxByOrNull { treble[it] } ?: -1
        assertTrue(bass.maxOrNull()!! > .3f)
        assertTrue(treble.maxOrNull()!! > .3f)
        assertTrue("equal RMS must still produce separate bass and treble shapes",
            trebleIndex > bassIndex + 4)
    }

    @Test fun androidPackedFftUsesFrequencyNotJustLoudness() {
        val bassFft = ByteArray(1024)
        val hiFft = ByteArray(1024)
        // Packed Android 1024-point FFT at 48 kHz. Magnitude is same;
        // frequency-only change must reposition the maximum.
        bassFft[2 * 5] = 90
        hiFft[2 * 88] = 90
        val bass = SpectrumBands.fromVisualizerFft(bassFft, 48_000_000)
        val high = SpectrumBands.fromVisualizerFft(hiFft, 48_000_000)
        assertTrue(!SpectrumBands.isSilent(bass))
        assertTrue(!SpectrumBands.isSilent(high))
        assertTrue(high.indices.maxByOrNull { high[it] }!! >
            bass.indices.maxByOrNull { bass[it] }!! + 5)
    }
}
