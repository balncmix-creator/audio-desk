package com.balnc.audioddesk

import android.Manifest
import android.app.Activity
import android.content.ContentUris
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.CalendarContract
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** Read-only device calendar integration. No Google credentials, remote
 * requests, event writes, or persistent copies of private event contents. */
internal class AgendaSupport(private val activity: Activity,
                             private val deliver: (JSONObject) -> Unit) {
    private val worker = Executors.newSingleThreadExecutor()
    private val busy = AtomicBoolean(false)
    @Volatile private var closed = false
    fun granted() = activity.checkSelfPermission(Manifest.permission.READ_CALENDAR) ==
        PackageManager.PERMISSION_GRANTED

    fun refresh() {
        if (closed) return
        if (!granted()) {
            deliver(JSONObject().put("state", "permission"))
            return
        }
        if (!busy.compareAndSet(false, true)) return
        worker.execute {
            try {
                val start = Calendar.getInstance().apply {
                    set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
                    add(Calendar.DATE, -1) // accommodates UTC all-day dates
                }.timeInMillis
                val end = Calendar.getInstance().apply { add(Calendar.DATE, 91) }.timeInMillis
                val rows = JSONArray()
                val fields = arrayOf("event_id", "begin", "end", "title", "allDay",
                    "eventLocation", "displayColor", "eventStatus", "selfAttendeeStatus")
                CalendarContract.Instances.query(activity.contentResolver, fields, start, end)?.use { c ->
                    while (c.moveToNext() && rows.length() < 2000) {
                        // Exclude cancelled and personally declined occurrences.
                        if (c.getInt(7) == CalendarContract.Events.STATUS_CANCELED ||
                            c.getInt(8) == CalendarContract.Attendees.ATTENDEE_STATUS_DECLINED) continue
                        val id = c.getLong(0)
                        val begin = c.getLong(1)
                        val finish = c.getLong(2)
                        rows.put(JSONObject().put("id", id.toString())
                            .put("begin", begin).put("end", finish)
                            .put("title", c.getString(3)?.take(220) ?: "(Untitled event)")
                            .put("allDay", c.getInt(4) != 0)
                            .put("location", c.getString(5)?.take(300) ?: "")
                            .put("color", if (c.isNull(6)) "" else
                                String.format(java.util.Locale.ROOT, "#%06X", c.getInt(6) and 0xFFFFFF)))
                    }
                }
                if (!closed) deliver(if (granted()) JSONObject().put("state", "ready")
                    .put("events", rows) else JSONObject().put("state", "permission"))
            } catch (_: SecurityException) {
                if (!closed) deliver(JSONObject().put("state", "permission"))
            } catch (_: Exception) {
                if (!closed) deliver(JSONObject().put("state", "error"))
            } finally { busy.set(false) }
        }
    }

    fun openEvent(id: String, begin: Long, end: Long) {
        val eventId = id.toLongOrNull() ?: return
        if (eventId < 0 || !granted()) return
        launch(Intent(Intent.ACTION_VIEW, ContentUris.withAppendedId(
            CalendarContract.Events.CONTENT_URI, eventId))
            .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, begin)
            .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end))
    }

    fun newEvent(begin: Long) {
        launch(Intent(Intent.ACTION_INSERT, CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, begin)
            .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, begin + 3600000L))
    }

    private fun launch(intent: Intent) {
        // Prefer Google Calendar when installed; otherwise use the device's calendar.
        try { activity.startActivity(Intent(intent).setPackage("com.google.android.calendar")) }
        catch (_: Exception) {
            try { activity.startActivity(intent) }
            catch (_: Exception) {
                Toast.makeText(activity, "No calendar app available", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun close() { closed = true; worker.shutdownNow() }
}
