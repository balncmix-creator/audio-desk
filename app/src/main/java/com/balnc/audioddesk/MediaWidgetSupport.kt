package com.balnc.audioddesk

import android.app.Activity
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import org.json.JSONObject

/**
 * User-authorized media sessions for the launcher Home widget.
 * Only public media metadata and transport actions are inspected. Never read,
 * cache or upload notification contents. Never bypass a player's ad policy.
 */
class MediaWidgetSupport(private val activity: Activity) {
    private val manager = activity.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager
    private val component = ComponentName(activity, AudioDeskMediaAccessService::class.java)
    private val notificationManager =
        activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    private fun hasAccess(): Boolean {
        return if (Build.VERSION.SDK_INT >= 27) {
            notificationManager.isNotificationListenerAccessGranted(component)
        } else {
            val enabled = Settings.Secure.getString(
                activity.contentResolver, "enabled_notification_listeners"
            ) ?: ""
            enabled.split(':').any { ComponentName.unflattenFromString(it) == component }
        }
    }

    /**
     * Only opt-in, locally displayed notification counts for verified app
     * packages. No title, body, sender, icon or other notification data.
     */
    fun liveTileCounts(packages: Set<String>): JSONObject {
        val granted = hasAccess()
        val result = JSONObject().put("enabled", granted)
        val counts = JSONObject()
        if (granted) for ((pkg, count) in AudioDeskMediaAccessService.activeCounts(packages))
            counts.put(pkg, count)
        return result.put("counts", counts)
    }

    fun openAccessSettings() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        try { activity.startActivity(intent) }
        catch (_: Exception) { /* Managed devices may disable the settings screen. */ }
    }

    private fun sessions(): List<MediaController> =
        if (hasAccess()) try { manager.getActiveSessions(component) }
        catch (_: SecurityException) { emptyList() }
        catch (_: RuntimeException) { emptyList() }
        else emptyList()

    private fun current(): MediaController? {
        val available = sessions()
        return available.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PLAYING }
            ?: available.firstOrNull()
    }

    fun state(): JSONObject {
        val obj = JSONObject()
        val enabled = hasAccess()
        obj.put("enabled", enabled)
        val media = if (enabled) current() else null
        obj.put("available", media != null)
        if (media != null) {
            val playback = media.playbackState
            val info = media.metadata
            val actions = playback?.actions ?: 0L
            obj.put("playing", playback?.state == PlaybackState.STATE_PLAYING)
            obj.put("title", info?.getString(MediaMetadata.METADATA_KEY_TITLE).orEmpty().take(120))
            obj.put("artist", info?.getString(MediaMetadata.METADATA_KEY_ARTIST).orEmpty().take(100))
            obj.put("app", media.packageName.take(110))
            val duration = info?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: 0L
            val rawPosition = playback?.position ?: -1L
            val elapsed = if (playback?.state == PlaybackState.STATE_PLAYING && playback.lastPositionUpdateTime > 0)
                (SystemClock.elapsedRealtime() - playback.lastPositionUpdateTime).coerceAtLeast(0L) * playback.playbackSpeed else 0f
            val position = if (rawPosition >= 0 && duration > 0) (rawPosition + elapsed.toLong()).coerceIn(0L, duration) else -1L
            obj.put("durationMs", duration.coerceAtLeast(0L))
            obj.put("positionMs", position)
            obj.put("canSeek", duration > 0 && position >= 0 && (actions and PlaybackState.ACTION_SEEK_TO) != 0L)
            obj.put("canNext", (actions and PlaybackState.ACTION_SKIP_TO_NEXT) != 0L)
            obj.put("canPrevious", (actions and PlaybackState.ACTION_SKIP_TO_PREVIOUS) != 0L)
            obj.put("canToggle", (actions and (PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE)) != 0L)
        }
        return obj
    }

    fun seek(positionMs: Long): JSONObject {
        val media = current()
        val duration = media?.metadata?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: 0L
        val actions = media?.playbackState?.actions ?: 0L
        if (media != null && duration > 0L && (actions and PlaybackState.ACTION_SEEK_TO) != 0L) {
            try { media.transportControls.seekTo(positionMs.coerceIn(0L, duration)) }
            catch (_: RuntimeException) { /* Session may have closed. */ }
        }
        return state()
    }

    fun command(action: String): JSONObject {
        val media = current()
        val state = media?.playbackState
        val actions = state?.actions ?: 0L
        if (media != null && state != null) {
            val controls = media.transportControls
            when (action) {
                "next" -> if ((actions and PlaybackState.ACTION_SKIP_TO_NEXT) != 0L)
                    controls.skipToNext()
                "previous" -> if ((actions and PlaybackState.ACTION_SKIP_TO_PREVIOUS) != 0L)
                    controls.skipToPrevious()
                "toggle" -> {
                    if (state.state == PlaybackState.STATE_PLAYING) {
                        if ((actions and (PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE)) != 0L)
                            controls.pause()
                    } else if ((actions and (PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PLAY_PAUSE)) != 0L)
                        controls.play()
                }
            }
        }
        return state()
    }
}
