package com.balnc.audioddesk

import android.service.notification.NotificationListenerService

/**
 * Permission gateway only. The launcher does not read notification text,
 * send notifications to a server or inspect other apps' private data.
 * Android requires an enabled NotificationListenerService to discover
 * third-party public MediaSession transport controls.
 */
class AudioDeskMediaAccessService : NotificationListenerService()
