package com.balnc.audioddesk

import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings

/** Android-native app menu; the launcher never clears data or force-stops silently. */
internal object AppManagementActions {
    val labels = arrayOf("App info", "Uninstall", "Clear cache", "Force stop")
    private val actions = listOf("info", "uninstall", "storage", "force-stop")
    fun validPackage(pkg: String) = pkg.length in 4..160 && '.' in pkg &&
        pkg.all { it.isLetterOrDigit() || it == '.' || it == '_' }
    fun validAction(action: String) = action in actions || action == "settings"
    fun intent(pkg: String, action: String): Intent {
        require(validPackage(pkg) && validAction(action))
        val uri = Uri.parse("package:" + pkg)
        return if (action == "uninstall") Intent(Intent.ACTION_DELETE, uri)
        else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, uri)
    }
    fun dialog(context: Context, title: CharSequence, select: (String) -> Unit): AlertDialog =
        AlertDialog.Builder(context)
            .setTitle(title)
            .setItems(labels) { _, which -> select(actions[which]) }
            .setNegativeButton("Cancel", null)
            .create()
}
