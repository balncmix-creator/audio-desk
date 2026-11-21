package com.balnc.audioddesk

import android.app.Activity
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.WebView
import androidx.documentfile.provider.DocumentFile
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.Executors

/**
 * A scoped Android Storage Access Framework browser. The user chooses a folder;
 * no broad storage, all-files, or media permission is requested.
 * Opaque per-listing IDs ensure JavaScript cannot pass arbitrary content URIs.
 */
class RadialFileSupport(private val activity: Activity, private val webView: WebView) {
    companion object {
        const val PICK_TREE_REQUEST = 6417
        private const val PREFS = "orbit_radial_files"
        private const val ROOT = "chosen_tree"
        private const val MAX_ITEMS = 700
        fun safeName(input: String): String? = input.trim().takeIf {
            it.isNotEmpty() && it.length <= 120 && it != "." && it != ".." &&
                !it.contains('/') && !it.contains('\\') &&
                it.none { char -> char.code < 32 }
        }
    }
    private val io = Executors.newSingleThreadExecutor()
    private val store = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val trail = ArrayList<DocumentFile>()
    private var tokens = emptyMap<String, DocumentFile>()
    private var revision = 0
    private var closed = false
    private var readOnly = false

    private fun emit(message: JSONObject) {
        activity.runOnUiThread {
            if (!closed) webView.evaluateJavascript(
                "window.receiveAudioDeskRadialFiles&&window.receiveAudioDeskRadialFiles(" +
                    message.toString() + ")", null
            )
        }
    }
    private fun signal(type: String, message: String) {
        emit(JSONObject().put("type", type).put("message", message))
    }
    private fun grant(uri: Uri): Boolean =
        activity.contentResolver.persistedUriPermissions.any {
            it.uri == uri && it.isReadPermission
        }
    private fun establish(uri: Uri): Boolean {
        if (uri.scheme != "content" || !grant(uri)) return false
        val root = DocumentFile.fromTreeUri(activity, uri) ?: return false
        if (!root.isDirectory) return false
        trail.clear()
        trail.add(root)
        tokens = emptyMap()
        readOnly = activity.contentResolver.persistedUriPermissions
            .firstOrNull { it.uri == uri }?.isWritePermission != true
        return true
    }
    fun requestListing() {
        if (trail.isEmpty()) {
            val saved = store.getString(ROOT, null)
            val uri = runCatching { saved?.let(Uri::parse) }.getOrNull()
            if (uri == null || !establish(uri)) {
                store.edit().remove(ROOT).apply()
                signal("permission", "Choose a folder to browse. Nothing is scanned without your permission.")
                return
            }
        }
        list()
    }
    fun chooseFolder() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        try {
            @Suppress("DEPRECATION")
            activity.startActivityForResult(intent, PICK_TREE_REQUEST)
        } catch (_: Exception) {
            signal("error", "Android could not open the folder picker.")
        }
    }
    fun result(request: Int, resultCode: Int, data: Intent?): Boolean {
        if (request != PICK_TREE_REQUEST) return false
        val uri = data?.data
        if (resultCode != Activity.RESULT_OK || uri == null) {
            if (trail.isEmpty()) signal("permission", "No folder selected.")
            return true
        }
        val flags = data.flags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        if (flags and Intent.FLAG_GRANT_READ_URI_PERMISSION == 0) {
            signal("error", "The selected folder did not grant read permission.")
            return true
        }
        try {
            activity.contentResolver.takePersistableUriPermission(uri, flags)
            if (!establish(uri)) throw SecurityException("Folder not accessible")
            store.edit().putString(ROOT, uri.toString()).apply()
            list()
        } catch (_: Exception) {
            signal("error", "Cannot access this folder. Select another folder.")
        }
        return true
    }
    private fun list() {
        val folder = trail.lastOrNull() ?: return
        val at = ++revision
        tokens = emptyMap()
        emit(JSONObject().put("type", "loading"))
        val path = trail.map { it.name ?: "Folder" }
        val writable = !readOnly && folder.canWrite()
        io.execute {
            try {
                val children = folder.listFiles()
                    .sortedWith(compareByDescending<DocumentFile> { it.isDirectory }
                        .thenBy(String.CASE_INSENSITIVE_ORDER) { it.name ?: "" })
                val visible = children.take(MAX_ITEMS)
                val newTokens = LinkedHashMap<String, DocumentFile>()
                val entries = JSONArray()
                visible.forEach { file ->
                    val key = UUID.randomUUID().toString()
                    newTokens[key] = file
                    entries.put(JSONObject()
                        .put("id", key)
                        .put("name", file.name ?: "Unnamed")
                        .put("folder", file.isDirectory)
                        .put("mime", file.type ?: "")
                        .put("size", file.length().coerceAtLeast(0))
                        .put("modified", file.lastModified().coerceAtLeast(0))
                        .put("writable", writable && file.canWrite()))
                }
                val data = JSONObject().put("type", "listing")
                    .put("path", JSONArray(path))
                    .put("entries", entries)
                    .put("count", children.size)
                    .put("truncated", children.size > MAX_ITEMS)
                    .put("canGoUp", trail.size > 1)
                    .put("writable", writable)
                activity.runOnUiThread {
                    if (!closed && at == revision) {
                        tokens = newTokens
                        emit(data)
                    }
                }
            } catch (_: Exception) {
                activity.runOnUiThread {
                    if (at == revision && !closed)
                        signal("error", "This folder cannot be read. Check its access in Android Files.")
                }
            }
        }
    }
    fun enter(id: String) {
        val target = tokens[id] ?: return
        if (!target.isDirectory) { open(id); return }
        trail.add(target)
        list()
    }
    fun up() {
        if (trail.size > 1) {
            trail.removeAt(trail.lastIndex)
            list()
        }
    }
    fun refresh() = requestListing()
    private fun file(id: String): DocumentFile? = tokens[id]?.takeIf { !it.isDirectory }
    fun open(id: String) {
        val selected = file(id) ?: return
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(selected.uri, selected.type ?: "*/*")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                clipData = ClipData.newRawUri(selected.name ?: "File", selected.uri)
            }
            activity.startActivity(Intent.createChooser(intent, "Open file with"))
        } catch (_: Exception) { signal("error", "No compatible app could open this file.") }
    }
    fun share(id: String) {
        val selected = file(id) ?: return
        try {
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = selected.type ?: "application/octet-stream"
                putExtra(Intent.EXTRA_STREAM, selected.uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                clipData = ClipData.newRawUri(selected.name ?: "File", selected.uri)
            }
            activity.startActivity(Intent.createChooser(intent, "Share file"))
        } catch (_: Exception) { signal("error", "Cannot share this file.") }
    }
    fun createFolder(name: String) {
        val clean = safeName(name) ?: return signal("error", "Enter a valid folder name.")
        val parent = trail.lastOrNull() ?: return
        if (readOnly) return signal("error", "This folder was granted read-only access.")
        io.execute {
            val success = runCatching { parent.createDirectory(clean) != null }.getOrDefault(false)
            activity.runOnUiThread {
                if (closed) return@runOnUiThread
                if (success) list() else signal("error", "Android could not create this folder.")
            }
        }
    }
    fun rename(id: String, name: String) {
        val target = tokens[id] ?: return
        val clean = safeName(name) ?: return signal("error", "Enter a valid name.")
        if (readOnly || !target.canWrite()) return signal("error", "This item cannot be renamed.")
        io.execute {
            val success = runCatching { target.renameTo(clean) }.getOrDefault(false)
            activity.runOnUiThread {
                if (closed) return@runOnUiThread
                if (success) list() else signal("error", "Android could not rename this item.")
            }
        }
    }
    fun delete(id: String) {
        val target = tokens[id] ?: return
        if (readOnly || !target.canWrite()) return signal("error", "This item cannot be deleted.")
        io.execute {
            val success = runCatching { target.delete() }.getOrDefault(false)
            activity.runOnUiThread {
                if (closed) return@runOnUiThread
                if (success) list() else signal("error", "Android could not delete this item.")
            }
        }
    }
    fun close() {
        closed = true
        revision++
        io.shutdownNow()
    }
}
