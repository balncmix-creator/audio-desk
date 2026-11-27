package com.balnc.audioddesk

import android.app.Notification
import android.service.notification.NotificationListenerService

/**
 * User-granted Android notification listener: media-session permission gateway,
 * plus optional Live Tile notification COUNTS on the launcher Home screen.
 * Never extracts titles, message text, contact names or notification extras.
 * Does not persist notifications or send notification data over the network.
 */
class AudioDeskMediaAccessService : NotificationListenerService() {
    companion object {
        @Volatile private var connectedService: AudioDeskMediaAccessService? = null

        fun activeCounts(packages: Set<String>): Map<String, Int> {
            val service = connectedService ?: return emptyMap()
            if (packages.isEmpty()) return emptyMap()
            val notifications = try { service.activeNotifications ?: return emptyMap() }
            catch (_: SecurityException) { return emptyMap() }
            catch (_: RuntimeException) { return emptyMap() }
            val counts = mutableMapOf<String, Int>()
            for (entry in notifications) {
                val pkg = entry.packageName
                if (pkg !in packages) continue
                val flags = entry.notification.flags
                if ((flags and (Notification.FLAG_GROUP_SUMMARY or
                     Notification.FLAG_ONGOING_EVENT or
                     Notification.FLAG_FOREGROUND_SERVICE)) != 0) continue
                // These are counts of ACTIVE notification cards, never unread
                // message counts, as apps can group messages arbitrarily.
                counts[pkg] = ((counts[pkg] ?: 0) + 1).coerceAtMost(99)
            }
            return counts
        }
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        connectedService = this
    }
    override fun onListenerDisconnected() {
        if (connectedService === this) connectedService = null
        super.onListenerDisconnected()
    }
    override fun onDestroy() {
        if (connectedService === this) connectedService = null
        super.onDestroy()
    }
}
