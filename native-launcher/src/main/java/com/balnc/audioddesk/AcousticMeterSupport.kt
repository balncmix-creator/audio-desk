package com.balnc.audioddesk

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.*

/** One foreground-only microphone stream. PCM stays in memory. */
internal class AcousticMeterSupport(private val context: Context,
 private val deliver: (JSONObject) -> Unit) {
    private val captureLock = Any()
    @Volatile private var generation = 0
    @Volatile private var worker: Thread? = null
    @Volatile private var spectrum = false
    @Volatile private var meter = false
    fun permitted() = context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    fun state(value: String) = deliver(JSONObject().put("state", value))
    @Synchronized fun setActive(spl: Boolean, fft: Boolean) {
        meter = spl; spectrum = fft
        if (!spl && !fft) { stop(); return }
        if (!permitted()) { state("permission"); return }
        if (worker?.isAlive == true) return
        val token = ++generation
        worker = Thread({ synchronized(captureLock) { if(token == generation) capture(token) } }, "AudioDesk-acoustic").apply { start() }
    }
    @Synchronized fun stop() {
        generation++
        worker?.interrupt()
        worker = null
    }
    @SuppressLint("MissingPermission")
    private fun capture(token: Int) {
        var recorder: AudioRecord? = null
        try {
            val rate = 48000
            val min = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            if (min <= 0) { if (token == generation) state("unavailable"); return }
            val manager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val raw = Build.VERSION.SDK_INT >= 24 &&
                manager.getProperty(AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED) == "true"
            val source = if (raw) MediaRecorder.AudioSource.UNPROCESSED else MediaRecorder.AudioSource.VOICE_RECOGNITION
            val input = AudioRecord(source, rate, AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT, max(min * 2, 8192))
            recorder = input
            if (input.state != AudioRecord.STATE_INITIALIZED) { if (token == generation) state("unavailable"); return }
            val dsp = AcousticDsp(rate)
            val chunk = ShortArray(1024)
            input.startRecording()
            var frames = 0
            var lastSent = 0L
            while (token == generation && !Thread.currentThread().isInterrupted) {
                val count = input.read(chunk, 0, chunk.size)
                if (count <= 0) { if (token == generation) state("unavailable"); break }
                dsp.consume(chunk, count, meter, spectrum)
                frames += count
                val now = android.os.SystemClock.elapsedRealtime()
                if (now - lastSent < 100 || token != generation) continue
                lastSent = now
                val data = JSONObject().put("state", "active").put("raw", raw)
                    .put("sampleRate", rate).put("fftSize", AcousticDsp.N)
                if (meter) data.put("levels", dsp.levels())
                if (spectrum && frames >= AcousticDsp.N) {
                    data.put("bands", JSONArray(dsp.spectrum().toList()))
                }
                if (token == generation) deliver(data)
            }
        } catch (_: Exception) {
            if (token == generation) state("unavailable")
        } finally {
            try { recorder?.stop() } catch (_: Exception) {}
            recorder?.release()
            synchronized(this) { if (token == generation) worker = null }
        }
    }
}

/** Standard-shaped A/C filters (bilinear approximation), energy ballistics,
 * and actual Hann-windowed FFT. Not an IEC-certified sound level meter. */
internal class AcousticDsp(private val rate: Int) {
    companion object { const val N = 8192; const val BANDS = 160 }
    private class Pole(hz: Double, rate: Int, private val high: Boolean) {
        private val k = tan(PI * hz / rate)
        private val b = if (high) 1.0 / (1+k) else k / (1+k)
        private val a = (1-k)/(1+k)
        private var x = 0.0; private var y = 0.0
        fun next(v: Double): Double {
            val out = b*(v + (if (high) -x else x)) + a*y
            x=v; y=out; return out
        }
        fun gain(hz: Double, rate: Int): Double {
            val t = tan(PI*hz/rate)
            return (if(high)t else k)/sqrt(t*t+k*k)
        }
    }
    private fun chain(a: Boolean): List<Pole> =
        listOf(Pole(20.598997,rate,true),Pole(20.598997,rate,true)) +
        (if(a) listOf(Pole(107.65265,rate,true),Pole(737.86223,rate,true)) else emptyList()) +
        listOf(Pole(12194.217,rate,false),Pole(12194.217,rate,false))
    private val af = chain(true); private val cf = chain(false)
    private val ag = 1.0/af.fold(1.0){v,p->v*p.gain(1000.0,rate)}
    private val cg = 1.0/cf.fold(1.0){v,p->v*p.gain(1000.0,rate)}
    private val fast = DoubleArray(3); private val slow = DoubleArray(3)
    private val afactor = 1-exp(-1.0/(rate*.125)); private val sfactor = 1-exp(-1.0/rate)
    private val ring = DoubleArray(N); private var cursor = 0
    private val real = DoubleArray(N); private val imag = DoubleArray(N)
    private val window = DoubleArray(N){.5-.5*cos(2*PI*it/(N-1))}
    private val energy = DoubleArray(3)
    fun consume(samples: ShortArray, n: Int, meter: Boolean = true, fft: Boolean = true) {
        for(i in 0 until n) {
            val x = samples[i]/32768.0
            if(fft){ring[cursor]=x;cursor=(cursor+1)%N}
            if(meter){
                var a=x;var c=x
                for(p in af)a=p.next(a)
                for(p in cf)c=p.next(c)
                energy[0]=a*a*ag*ag; energy[1]=c*c*cg*cg; energy[2]=x*x
                for(j in 0..2){
                    fast[j]+=afactor*(energy[j]-fast[j])
                    slow[j]+=sfactor*(energy[j]-slow[j])
                }
            }
        }
    }
    private fun db(e:Double)=10*log10(max(1e-14,e))
    fun levels():JSONObject {
        val out=JSONObject()
        for((i,name) in listOf("A","C","Z").withIndex())
            out.put(name,JSONObject().put("fast",db(fast[i])).put("slow",db(slow[i])))
        return out
    }
    fun spectrum(): DoubleArray {
        for(i in 0 until N){real[i]=ring[(cursor+i)%N]*window[i];imag[i]=0.0}
        var j=0
        for(i in 1 until N){
            var bit=N shr 1
            while((j and bit) != 0){j=j xor bit;bit=bit shr 1}
            j=j xor bit
            if(i<j){val v=real[i];real[i]=real[j];real[j]=v}
        }
        var len=2
        while(len<=N){
            val theta=-2*PI/len
            val wr=cos(theta);val wi=sin(theta)
            for(start in 0 until N step len){
                var cr=1.0;var ci=0.0
                for(k in 0 until len/2){
                    val a=start+k;val b=a+len/2
                    val tr=cr*real[b]-ci*imag[b];val ti=cr*imag[b]+ci*real[b]
                    real[b]=real[a]-tr;imag[b]=imag[a]-ti;real[a]+=tr;imag[a]+=ti
                    val r=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=r
                }
            }
            len=len shl 1
        }
        // 20 Hz–20 kHz display, actual FFT bin magnitudes, interpolated only
        // between adjacent measured values. dBFS peak magnitude, not SPL.
        return DoubleArray(BANDS){i->
            val hz=20.0*1000.0.pow(i.toDouble()/(BANDS-1))
            val bin=(hz*N/rate).coerceIn(1.0,(N/2-2).toDouble())
            val lo=bin.toInt();val t=bin-lo
            val a=hypot(real[lo],imag[lo]);val b=hypot(real[lo+1],imag[lo+1])
            var peak=a*(1-t)+b*t
            val half=1000.0.pow(.5/(BANDS-1))
            val first=ceil(bin/half).toInt().coerceAtLeast(1)
            val last=floor(bin*half).toInt().coerceAtMost(N/2-1)
            for(k in first..last) peak=max(peak,hypot(real[k],imag[k]))
            20*log10(max(1e-7,peak*4/N))
        }
    }
}
