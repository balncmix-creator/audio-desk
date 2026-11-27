package com.balnc.audioddesk

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.os.SystemClock

/**
 * Optional Android 10+ fallback when Visualizer(0) is unavailable.
 * Requires fresh, explicit Android MediaProjection consent, displays an active
 * foreground-service notification, never saves or uploads captured PCM.
 *
 * Only playback from apps which allow capture is included. Calls and DRM /
 * private players must remain silent. Stopped when the launcher leaves Home.
 */
class SpectrumProjectionService : Service() {
    companion object {
        const val SAMPLE_RATE = 48000
        private const val ANALYSIS_WINDOW = 8192
        const val ACTION_START = "com.balnc.audioddesk.START_SPECTRUM_PROJECTION"
        const val ACTION_STOP = "com.balnc.audioddesk.STOP_SPECTRUM_PROJECTION"
        const val EXTRA_RESULT = "resultCode"
        const val EXTRA_DATA = "projectionData"
        private const val CHANNEL = "audio_desk_spectrum_capture"
        private const val NOTIFICATION_ID = 3106
        @Volatile var observer: ((FloatArray) -> Unit)? = null
    }

    @Volatile private var running = false
    private var worker: Thread? = null
    private var audio: AudioRecord? = null
    private var projection: MediaProjection? = null
    private var projectionCallback: MediaProjection.Callback? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (intent?.action != ACTION_START || Build.VERSION.SDK_INT < 29) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (running) return START_NOT_STICKY
        try {
            createNotification()
            val resultCode = intent.getIntExtra(EXTRA_RESULT, 0)
            @Suppress("DEPRECATION")
            val data: Intent? = intent.getParcelableExtra(EXTRA_DATA)
            if (resultCode == 0 || data == null) {
                stopSelf()
                return START_NOT_STICKY
            }
            val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            val token = manager.getMediaProjection(resultCode, data)
                ?: throw IllegalStateException("MediaProjection token unavailable")
            projection = token
            val callback = object : MediaProjection.Callback() {
                override fun onStop() { stopSelf() }
            }
            projectionCallback = callback
            token.registerCallback(callback, android.os.Handler(mainLooper))
            val policy = AudioPlaybackCaptureConfiguration.Builder(token)
                .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                .addMatchingUsage(AudioAttributes.USAGE_GAME)
                .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
                .build()
            val min = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT)
            val record = AudioRecord.Builder()
                .setAudioFormat(AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_IN_MONO).build())
                .setBufferSizeInBytes(maxOf(8192, if (min > 0) min * 2 else 8192))
                .setAudioPlaybackCaptureConfig(policy)
                .build()
            if (record.state != AudioRecord.STATE_INITIALIZED) {
                record.release()
                throw IllegalStateException("Playback capture is unavailable")
            }
            audio = record
            record.startRecording()
            running = true
            worker = Thread({
                val wave = ShortArray(1024)
                val ring = FloatArray(ANALYSIS_WINDOW)
                var cursor = 0
                var filled = 0
                var sent = 0L
                while (running && !Thread.currentThread().isInterrupted) {
                    val n = try {
                        record.read(wave, 0, wave.size, AudioRecord.READ_BLOCKING)
                    } catch (_: RuntimeException) { break }
                    if (n <= 0) break
                    // Maintain a CONTIGUOUS rolling PCM window (not stitched
                    // snapshots). Overlapping analysis improves sub-bass
                    // resolution while keeping frequent visual updates.
                    for (i in 0 until n) {
                        ring[cursor] = wave[i] / 32768f
                        cursor = (cursor + 1) % ANALYSIS_WINDOW
                        filled = minOf(ANALYSIS_WINDOW, filled + 1)
                    }
                    val now = SystemClock.uptimeMillis()
                    if (filled < ANALYSIS_WINDOW || now - sent < 32L) continue
                    sent = now
                    val samples = FloatArray(ANALYSIS_WINDOW) { i ->
                        ring[(cursor + i) % ANALYSIS_WINDOW]
                    }
                    observer?.invoke(samples)
                }
            }, "AudioDesk-playback-visualizer").apply {
                isDaemon = true
                start()
            }
        } catch (_: Exception) {
            stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun createNotification() {
        val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            mgr.createNotificationChannel(NotificationChannel(CHANNEL,
                "Audio Desk spectrum capture", NotificationManager.IMPORTANCE_LOW))
        }
        val builder = if (Build.VERSION.SDK_INT >= 26)
            Notification.Builder(this, CHANNEL) else Notification.Builder(this)
        val notification = builder.setContentTitle("Audio Desk waveform")
            .setContentText("Visualizing permitted playback · stop by leaving Audio Desk")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true).build()
        if (Build.VERSION.SDK_INT >= 29)
            startForeground(NOTIFICATION_ID, notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        else startForeground(NOTIFICATION_ID, notification)
    }

    override fun onTaskRemoved(rootIntent: Intent?) { stopSelf() }

    override fun onDestroy() {
        running = false
        worker?.interrupt()
        worker = null
        try { audio?.stop() } catch (_: Exception) {}
        try { audio?.release() } catch (_: Exception) {}
        audio = null
        try { projectionCallback?.let { projection?.unregisterCallback(it) } } catch (_: Exception) {}
        try { projection?.stop() } catch (_: Exception) {}
        projection = null
        projectionCallback = null
        super.onDestroy()
    }
}
