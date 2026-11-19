package com.balnc.audioddesk

import kotlin.math.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class AcousticDspTest {
    private fun signal(hz:Double, duration:Int=3): ShortArray =
        ShortArray(48000*duration){ (8192*sin(2*PI*hz*it/48000)).toInt().toShort() }
    @Test fun weightingAndBallistics() {
        val dsp=AcousticDsp(48000)
        val tone=signal(1000.0)
        dsp.consume(tone,tone.size,true,false)
        val levels=dsp.levels()
        val z=levels.getJSONObject("Z").getDouble("fast")
        assertEquals(-15.05,z,0.15)
        assertEquals(z,levels.getJSONObject("A").getDouble("fast"),0.2)
        assertEquals(z,levels.getJSONObject("C").getDouble("fast"),0.2)
        dsp.consume(ShortArray(12000),12000,true,false)
        val quiet=dsp.levels()
        assertTrue(quiet.getJSONObject("Z").getDouble("fast") <
            quiet.getJSONObject("Z").getDouble("slow")-5)
    }
    @Test fun bassWeightingAndSpectrumFrequency() {
        val dsp=AcousticDsp(48000)
        val tone=signal(100.0)
        dsp.consume(tone,tone.size)
        val values=dsp.levels()
        assertTrue(values.getJSONObject("A").getDouble("fast") <
            values.getJSONObject("Z").getDouble("fast")-15)
        val bands=dsp.spectrum()
        val peak=bands.indices.maxByOrNull{bands[it]}!!
        val hz=20*1000.0.pow(peak.toDouble()/(bands.size-1))
        assertEquals(100.0,hz,12.0)
        assertTrue(AcousticDsp(48000).spectrum().all{it<=-130})
    }
}
