package com.balnc.audioddesk

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Explicitly enabled direct browser for Android SHARED storage only.
 *
 * MANAGE_EXTERNAL_STORAGE does NOT grant root /data access or access to other
 * apps' Android/data or Android/obb folders. This browser never attempts either.
 * The permission is declared only in the sideload/debug manifest, not Play.
 *
 * JavaScript only gets opaque, per-listing UUIDs, never absolute paths or
 * content URIs. Every operation re-checks canonical containment and protected
 * paths to block traversal, including symlinks.
 */
class SharedStorageSupport(
    private val activity: Activity,
    private val send: (JSONObject) -> Unit,
    private val onActivated: () -> Unit
) {
    companion object {
        private const val MAX_ITEMS = 3000
        private const val FILE_PROVIDER = ".orbit.files"
        private val LOCATIONS = mapOf(
            "downloads" to Environment.DIRECTORY_DOWNLOADS,
            "music" to Environment.DIRECTORY_MUSIC,
            "documents" to Environment.DIRECTORY_DOCUMENTS,
            "pictures" to Environment.DIRECTORY_PICTURES,
            "dcim" to Environment.DIRECTORY_DCIM
        )
    }
    private val worker = Executors.newSingleThreadExecutor()
    private val folders = ArrayList<File>()
    private var tokens: Map<String, File> = emptyMap()
    private var revision = 0
    private var waitingForSettings = false
    private var requestedLocation = "root"
    private var stopped = false
    var active = false
        private set

    fun supported(): Boolean {
        if (Build.VERSION.SDK_INT < 30) return false
        return runCatching {
            @Suppress("DEPRECATION")
            val info = activity.packageManager.getPackageInfo(
                activity.packageName, PackageManager.GET_PERMISSIONS
            )
            info.requestedPermissions?.contains(android.Manifest.permission.MANAGE_EXTERNAL_STORAGE) == true
        }.getOrDefault(false)
    }
    fun granted(): Boolean =
        Build.VERSION.SDK_INT >= 30 && Environment.isExternalStorageManager() && supported()

    private fun notice(type: String, message: String) {
        send(JSONObject().put("type", type).put("message", message)
            .put("allFilesAvailable", supported()))
    }
    fun deactivate() {
        revision++
        active = false
        tokens = emptyMap()
        folders.clear()
        waitingForSettings = false
    }
    fun requestAccess(location: String) {
        val option = location.takeIf { it == "root" || it in LOCATIONS } ?: "root"
        requestedLocation = option
        if (!supported()) {
            notice("permission", "All files access isn't included in this edition. Use Folder for limited access.")
            return
        }
        if (granted()) {
            openLocation(option)
            return
        }
        waitingForSettings = true
        try {
            val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                Uri.parse("package:${activity.packageName}"))
            activity.startActivity(intent)
        } catch (_: Exception) {
            try {
                activity.startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
            } catch (_: Exception) {
                waitingForSettings = false
                notice("error", "Android couldn't open All files access settings.")
            }
        }
    }
    fun onResume() {
        if (!waitingForSettings) return
        waitingForSettings = false
        if (granted()) openLocation(requestedLocation)
        else notice("permission", "All files access is off. Enable it in Android Settings, or select Folder.")
    }
    private fun root(): File? = runCatching {
        Environment.getExternalStorageDirectory().canonicalFile
    }.getOrNull()
    private fun inside(file: File, base: File): Boolean {
        val candidate = runCatching { file.canonicalFile }.getOrNull() ?: return false
        val bp = base.path.trimEnd(File.separatorChar)
        val cp = candidate.path
        if (cp != bp && !cp.startsWith(bp + File.separator)) return false
        val relative = cp.removePrefix(bp).trimStart(File.separatorChar)
        val parts = relative.split(File.separatorChar)
        // Android's OS restricts other apps' private storage despite All files.
        if (parts.size >= 2 && parts[0].equals("Android", true) &&
            (parts[1].equals("data", true) || parts[1].equals("obb", true))) return false
        return true
    }
    private fun checked(file: File): File? {
        val base = root() ?: return null
        val canonical = runCatching { file.canonicalFile }.getOrNull() ?: return null
        return canonical.takeIf { inside(it, base) }
    }
    fun openLocation(location: String = "root") {
        if (!granted()) {
            notice("permission", "Tap Device storage to grant access in Android Settings.")
            return
        }
        val base = root() ?: return notice("error", "Android shared storage isn't available.")
        val directory = LOCATIONS[location]?.let { File(base, it) } ?: base
        val destination = checked(directory)?.takeIf { it.isDirectory && it.canRead() } ?: base
        revision++
        folders.clear()
        folders.add(base)
        if (destination != base) folders.add(destination)
        tokens = emptyMap()
        active = true
        onActivated()
        list()
    }
    private fun mime(file: File): String {
        val ext = file.extension.lowercase()
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)
            ?: when (ext) {
                "wav" -> "audio/wav"
                "flac" -> "audio/flac"
                "aiff", "aif" -> "audio/aiff"
                "mkv" -> "video/x-matroska"
                else -> "application/octet-stream"
            }
    }
    fun list() {
        if (!active) return
        if (!granted()) {
            deactivate()
            notice("permission", "All files access was revoked. Enable it again, or use Folder.")
            return
        }
        val base = root() ?: return notice("error", "Shared storage isn't mounted.")
        val current = folders.lastOrNull() ?: base
        if (!inside(current, base) || !current.isDirectory) {
            openLocation("root")
            return
        }
        val revisionAtStart = ++revision
        tokens = emptyMap()
        send(JSONObject().put("type", "loading"))
        val path = JSONArray().put("Internal storage")
        folders.drop(1).forEach { path.put(it.name) }
        worker.execute {
            try {
                val children = current.listFiles()
                    ?: throw SecurityException("Storage directory cannot be listed")
                val sorted = children.asSequence().mapNotNull { checked(it) }
                    .filter { it.exists() && it.canRead() }
                    .sortedWith(compareByDescending<File> { it.isDirectory }
                        .thenBy(String.CASE_INSENSITIVE_ORDER) { it.name }).toList()
                val allowed = sorted.take(MAX_ITEMS)
                val entries = JSONArray()
                val fresh = LinkedHashMap<String, File>()
                allowed.forEach { file ->
                    val key = UUID.randomUUID().toString()
                    fresh[key] = file
                    entries.put(JSONObject().put("id", key)
                        .put("name", file.name)
                        .put("folder", file.isDirectory)
                        .put("mime", if (file.isDirectory) "" else mime(file))
                        .put("size", if (file.isFile) file.length().coerceAtLeast(0) else 0)
                        .put("modified", file.lastModified().coerceAtLeast(0))
                        .put("writable", file.canWrite()))
                }
                val data = JSONObject().put("type", "listing")
                    .put("mode", "device")
                    .put("path", path).put("entries", entries)
                    .put("count", sorted.size).put("truncated", sorted.size > MAX_ITEMS)
                    .put("canGoUp", folders.size > 1)
                    .put("writable", current.canWrite())
                activity.runOnUiThread {
                    if (!stopped && active && revisionAtStart == revision) {
                        tokens = fresh
                        send(data)
                    }
                }
            } catch (_: Exception) {
                activity.runOnUiThread {
                    if (!stopped && active && revisionAtStart == revision)
                        notice("error", "Android doesn't allow reading this folder.")
                }
            }
        }
    }
    fun enter(id: String) {
        val directory = tokens[id]?.takeIf { it.isDirectory } ?: return
        val canonical = checked(directory) ?: return
        if (!canonical.canRead()) return notice("error", "Android blocks this directory.")
        folders.add(canonical)
        list()
    }
    fun up() {
        if (folders.size > 1) {
            folders.removeAt(folders.lastIndex)
            list()
        }
    }
    private fun selectedFile(id: String): File? = tokens[id]?.takeIf {
        it.isFile && checked(it) != null && it.canRead()
    }
    private fun uri(file: File): Uri = FileProvider.getUriForFile(
        activity, activity.packageName + FILE_PROVIDER, file
    )
    fun open(id: String) {
        val file = selectedFile(id) ?: return
        try {
            val fileUri = uri(file)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(fileUri, mime(file))
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                clipData = ClipData.newRawUri(file.name, fileUri)
            }
            activity.startActivity(Intent.createChooser(intent, "Open file with"))
        } catch (_: Exception) {
            notice("error", "No compatible app could open this file.")
        }
    }
    fun share(id: String) {
        val file = selectedFile(id) ?: return
        try {
            val fileUri = uri(file)
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = mime(file)
                putExtra(Intent.EXTRA_STREAM, fileUri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                clipData = ClipData.newRawUri(file.name, fileUri)
            }
            activity.startActivity(Intent.createChooser(intent, "Share file"))
        } catch (_: Exception) {
            notice("error", "Android couldn't share this file.")
        }
    }
    fun create(name: String) {
        val clean = RadialFileSupport.safeName(name)
            ?: return notice("error", "Enter a valid folder name.")
        val parent = folders.lastOrNull() ?: return
        if (checked(parent) == null || !parent.canWrite()) return notice("error", "Folder is read-only.")
        worker.execute {
            val next = checked(File(parent, clean))
            val ok = next != null && !next.exists() && next.mkdir()
            activity.runOnUiThread {
                if (stopped || !active) return@runOnUiThread
                if (ok) list() else notice("error", "Couldn't create folder here.")
            }
        }
    }
    fun rename(id: String, name: String) {
        val original = tokens[id] ?: return
        val clean = RadialFileSupport.safeName(name)
            ?: return notice("error", "Enter a valid name.")
        val parent = original.parentFile ?: return
        if (checked(original) == null || !original.canWrite()) return notice("error", "Item is read-only.")
        worker.execute {
            val next = checked(File(parent, clean))
            val ok = next != null && !next.exists() && original.renameTo(next)
            activity.runOnUiThread {
                if (stopped || !active) return@runOnUiThread
                if (ok) list() else notice("error", "Couldn't rename this item.")
            }
        }
    }
    fun delete(id: String) {
        val selected = tokens[id] ?: return
        if (checked(selected) == null || !selected.canWrite())
            return notice("error", "This item cannot be deleted.")
        worker.execute {
            // Avoid silently recursively deleting an entire directory tree.
            val nonempty = selected.isDirectory && (selected.listFiles()?.isNotEmpty() != false)
            val ok = !nonempty && selected.delete()
            activity.runOnUiThread {
                if (stopped || !active) return@runOnUiThread
                if (ok) list() else notice("error",
                    if (nonempty) "Only empty folders can be deleted in this version."
                    else "Android blocked deletion.")
            }
        }
    }
    fun close() {
        stopped = true
        revision++
        worker.shutdownNow()
    }
}
