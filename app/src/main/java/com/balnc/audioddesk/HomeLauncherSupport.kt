package com.balnc.audioddesk

import android.app.Activity
import android.app.role.RoleManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.os.Build
import android.provider.Settings
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

/**
 * Home launcher integration without QUERY_ALL_PACKAGES or privileged task APIs.
 * The "Recents" panel lists apps opened through this launcher, NOT live tasks.
 */
internal class HomeLauncherSupport(private val activity: Activity) {
    internal data class App(val pkg: String, val activityName: String, val label: String, val icon: String)
    private val prefs = activity.getSharedPreferences("audio_desk_home", Context.MODE_PRIVATE)
    private val executor = Executors.newSingleThreadExecutor()
    @Volatile private var knownApps: List<App> = emptyList()

    @Suppress("DEPRECATION")
    private fun query(): List<App> {
        val pm = activity.packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val activities = pm.queryIntentActivities(intent, 0)
        val result = ArrayList<App>(activities.size)
        val used = HashSet<String>()
        for (resolve in activities) {
            val info = resolve.activityInfo ?: continue
            if (!info.enabled || !info.applicationInfo.enabled || !info.exported) continue
            val pkg = info.packageName
            val cls = info.name
            if (pkg.isBlank() || cls.isBlank()) continue
            if (!used.add(pkg + "/" + cls)) continue
            val name = try { resolve.loadLabel(pm)?.toString().orEmpty().ifBlank { pkg } }
                catch (_: Exception) { pkg }
            val icon = try { makeIcon(resolve.loadIcon(pm)) } catch (_: Exception) { "" }
            result.add(App(pkg, cls, name.take(100), icon))
        }
        return result.sortedBy { it.label.lowercase() }
    }

    private fun makeIcon(drawable: Drawable): String {
        val target = 76
        val bmp = Bitmap.createBitmap(target, target, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        drawable.setBounds(0, 0, target, target)
        drawable.draw(canvas)
        val stream = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.PNG, 85, stream)
        bmp.recycle()
        return "data:image/png;base64," + Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
    }

    fun load(callback: (JSONArray, JSONArray) -> Unit) {
        executor.execute {
            val apps = try { query() } catch (_: Exception) { emptyList() }
            knownApps = apps
            val all = JSONArray()
            for (app in apps) all.put(app.toJson())
            callback(all, recents(apps))
        }
    }

    private fun App.toJson(): JSONObject = JSONObject()
        .put("pkg", pkg).put("activity", activityName)
        .put("label", label).put("icon", icon)
        // These counts cover app launches through Audio Desk only.
        // Android deliberately restricts global app-usage history without permission.
        .put("uses", prefs.getInt("count:" + pkg + "/" + activityName, 0))

    private fun recents(apps: List<App>): JSONArray {
        val available = apps.associateBy { it.pkg + "/" + it.activityName }
        val out = JSONArray()
        val history = try { JSONArray(prefs.getString("recent", "[]") ?: "[]") }
            catch (_: Exception) { JSONArray() }
        for (i in 0 until minOf(history.length(), 20)) {
            val item = history.optJSONObject(i) ?: continue
            val key = item.optString("pkg") + "/" + item.optString("activity")
            val app = available[key] ?: continue
            out.put(app.toJson().put("opened", item.optLong("opened")))
        }
        return out
    }

    fun launch(pkg: String, activityName: String): Boolean {
        if (pkg.length > 255 || activityName.length > 300 ||
            knownApps.none { it.pkg == pkg && it.activityName == activityName }) return false
        return try {
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
                component = ComponentName(pkg, activityName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
            }
            activity.startActivity(intent)
            recordLaunch(pkg, activityName)
            true
        } catch (_: Exception) { false }
    }

    private fun recordLaunch(pkg: String, activityName: String) {
        val old = try { JSONArray(prefs.getString("recent", "[]") ?: "[]") }
            catch (_: Exception) { JSONArray() }
        val next = JSONArray()
        next.put(JSONObject().put("pkg", pkg).put("activity", activityName)
            .put("opened", System.currentTimeMillis()))
        for (i in 0 until old.length()) {
            val item = old.optJSONObject(i) ?: continue
            if (item.optString("pkg") == pkg && item.optString("activity") == activityName) continue
            if (next.length() >= 16) break
            next.put(item)
        }
        val countKey = "count:" + pkg + "/" + activityName
        val nextCount = (prefs.getInt(countKey, 0) + 1).coerceAtMost(1_000_000)
        prefs.edit().putString("recent", next.toString())
            .putInt(countKey, nextCount).apply()
    }

    fun isDefaultHome(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val manager = activity.getSystemService(RoleManager::class.java)
            if (manager?.isRoleAvailable(RoleManager.ROLE_HOME) == true)
                return manager.isRoleHeld(RoleManager.ROLE_HOME)
        }
        return try {
            val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
            val resolved = activity.packageManager.resolveActivity(home, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)
            resolved?.activityInfo?.packageName == activity.packageName
        } catch (_: Exception) { false }
    }

    fun requestDefaultHome() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val manager = activity.getSystemService(RoleManager::class.java)
            if (manager?.isRoleAvailable(RoleManager.ROLE_HOME) == true) {
                if (!manager.isRoleHeld(RoleManager.ROLE_HOME))
                    activity.startActivityForResult(manager.createRequestRoleIntent(RoleManager.ROLE_HOME), 2902)
                return
            }
        }
        try { activity.startActivity(Intent(Settings.ACTION_HOME_SETTINGS)) }
        catch (_: Exception) { /* System settings may be missing on some devices. */ }
    }

    fun close() { executor.shutdownNow() }
}
