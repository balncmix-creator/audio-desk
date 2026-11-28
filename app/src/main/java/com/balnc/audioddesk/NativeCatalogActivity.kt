package com.balnc.audioddesk

import android.app.Activity
import android.app.AlertDialog
import android.content.ComponentName
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.text.Editable
import android.text.TextWatcher
import android.util.LruCache
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.*
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONArray
import java.util.Locale

/** Native catalog model. Keep component identity; labels alone are not unique. */
internal data class NativeCatalogApp(val pkg: String, val activity: String, val label: String) {
    val key get() = "$pkg/$activity"
}

internal object NativeCatalog {
    fun search(apps: List<NativeCatalogApp>, query: String): List<NativeCatalogApp> {
        val words = query.trim().lowercase(Locale.ROOT).split(Regex("\\s+")).filter { it.isNotEmpty() }
        return if (words.isEmpty()) apps else apps.filter { app ->
            val haystack = (app.label + " " + app.pkg).lowercase(Locale.ROOT)
            words.all { haystack.contains(it) }
        }
    }

    fun section(label: String): Char {
        val first = label.trim().firstOrNull()?.uppercaseChar() ?: '#'
        return if (first in 'A'..'Z') first else '#'
    }

    fun index(apps: List<NativeCatalogApp>, letter: Char): Int =
        apps.indexOfFirst { section(it.label) == letter }

    fun decode(data: JSONArray): List<NativeCatalogApp> {
        val out = ArrayList<NativeCatalogApp>()
        for (i in 0 until data.length()) {
            val app = data.optJSONObject(i) ?: continue
            val pkg = app.optString("pkg")
            val cls = app.optString("activity")
            if (pkg.isBlank() || cls.isBlank()) continue
            out += NativeCatalogApp(pkg, cls, app.optString("label").ifBlank { pkg })
        }
        return out.distinctBy { it.key }
    }
}

/**
 * Isolated native migration preview, not the default Home activity.
 * Uses the existing package visibility and launch-history backend.
 * No WebView, JS bridge, layout polling or audio capture in this screen.
 */
class NativeCatalogActivity : Activity() {
    private lateinit var support: HomeLauncherSupport
    private lateinit var list: ListView
    private lateinit var adapter: CatalogAdapter
    private lateinit var search: EditText
    private lateinit var status: TextView
    private lateinit var mode: Button
    private lateinit var rail: LinearLayout
    private var all = emptyList<NativeCatalogApp>()
    private var recent = emptyList<NativeCatalogApp>()
    private var recentsOnly = false
    private var closed = false
    private var generation = 0
    private val icons = LruCache<String, Drawable>(48)

    private fun dp(value: Int) = (value * resources.displayMetrics.density + .5f).toInt()
    private val surface = Color.rgb(23, 25, 28)
    private val ink = Color.rgb(240, 242, 245)
    private val muted = Color.rgb(181, 188, 198)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        support = HomeLauncherSupport(this)
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN or WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(surface)
            isFocusableInTouchMode = true
        }
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left + dp(12), bars.top + dp(8), bars.right + dp(12), maxOf(bars.bottom, ime.bottom))
            insets
        }
        root.addView(TextView(this).apply {
            text = "Audio Desk · Native catalog"
            textSize = 21f
            setTextColor(ink)
            typeface = Typeface.DEFAULT_BOLD
            setPadding(dp(4), dp(8), dp(4), dp(8))
        })
        search = EditText(this).apply {
            hint = "Search apps"
            setTextColor(ink)
            setHintTextColor(muted)
            setSingleLine(true)
            inputType = android.text.InputType.TYPE_CLASS_TEXT
            minHeight = dp(48)
            contentDescription = "Search installed apps"
        }
        root.addView(search)
        mode = Button(this).apply {
            text = "Show recent apps"
            isAllCaps = false
            minHeight = dp(48)
            setOnClickListener {
                recentsOnly = !recentsOnly
                text = if (recentsOnly) "Show all apps" else "Show recent apps"
                render()
            }
        }
        root.addView(mode)
        val horizontal = HorizontalScrollView(this).apply { isHorizontalScrollBarEnabled = false }
        rail = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        for (letter in ('A'..'Z').toList() + '#') {
            rail.addView(Button(this).apply {
                text = letter.toString()
                contentDescription = "Apps beginning with $letter"
                isAllCaps = false
                minWidth = 0
                minimumWidth = 0
                setPadding(0, 0, 0, 0)
                setOnClickListener {
                    val position = NativeCatalog.index(adapter.rows, letter)
                    if (position >= 0) list.setSelection(position)
                }
            }, LinearLayout.LayoutParams(dp(48), dp(48)))
        }
        horizontal.addView(rail)
        root.addView(horizontal)
        status = TextView(this).apply {
            setTextColor(muted)
            text = "Loading apps…"
            setPadding(dp(4), dp(6), dp(4), dp(6))
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        root.addView(status)
        adapter = CatalogAdapter()
        list = ListView(this).apply {
            adapter = this@NativeCatalogActivity.adapter
            dividerHeight = 0
            setOnItemClickListener { _, _, position, _ ->
                val app = this@NativeCatalogActivity.adapter.getItem(position)
                if (!support.launch(app.pkg, app.activity)) message("App unavailable")
            }
            setOnItemLongClickListener { _, _, position, _ ->
                showActions(this@NativeCatalogActivity.adapter.getItem(position))
                true
            }
        }
        root.addView(list, LinearLayout.LayoutParams(-1, 0, 1f))
        search.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { render() }
            override fun afterTextChanged(s: Editable?) {}
        })
        setContentView(root)
        root.requestFocus()
        ViewCompat.requestApplyInsets(root)
    }

    override fun onResume() {
        super.onResume()
        val request = ++generation
        support.load(forceRefresh = true) { apps, recents ->
            val decoded = NativeCatalog.decode(apps)
            val history = NativeCatalog.decode(recents)
            runOnUiThread {
                if (closed || request != generation) return@runOnUiThread
                all = decoded
                recent = history
                icons.evictAll()
                render()
            }
        }
    }

    private fun render() {
        adapter.rows = NativeCatalog.search(if (recentsOnly) recent else all, search.text.toString())
        adapter.notifyDataSetChanged()
        status.text = if (adapter.rows.isEmpty()) "No matching apps" else "${adapter.rows.size} apps"
        for (i in 0 until rail.childCount) {
            val letter = (rail.getChildAt(i) as Button).text.first()
            rail.getChildAt(i).isEnabled = NativeCatalog.index(adapter.rows, letter) >= 0
        }
    }

    private fun message(text: String) = Toast.makeText(this, text, Toast.LENGTH_SHORT).show()

    private fun showActions(app: NativeCatalogApp) {
        support.shortcuts(app.pkg, app.activity) { result ->
            runOnUiThread {
                if (closed || isFinishing || !hasWindowFocus()) return@runOnUiThread
                val entries = (0 until result.length()).mapNotNull { result.optJSONObject(it) }
                    .filter { it.optString("id").isNotBlank() && it.optString("label").isNotBlank() }
                val labels = listOf("App info") + entries.map { it.optString("label") }
                AlertDialog.Builder(this).setTitle(app.label)
                    .setItems(labels.toTypedArray()) { _, position ->
                        if (position == 0) {
                            try {
                                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", app.pkg, null)))
                            } catch (_: Exception) { message("App settings unavailable") }
                        } else if (!support.launchShortcut(app.pkg, app.activity, entries[position - 1].optString("id"))) {
                            message("Shortcut unavailable")
                        }
                    }.setNegativeButton("Cancel", null).show()
            }
        }
    }

    private inner class CatalogAdapter : BaseAdapter() {
        var rows = emptyList<NativeCatalogApp>()
        override fun getCount() = rows.size
        override fun getItem(position: Int) = rows[position]
        override fun getItemId(position: Int) = position.toLong()
        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val row = (convertView as? LinearLayout) ?: LinearLayout(this@NativeCatalogActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                minimumHeight = dp(56)
                setPadding(dp(8), dp(6), dp(8), dp(6))
                addView(ImageView(context), LinearLayout.LayoutParams(dp(40), dp(40)))
                addView(TextView(context).apply {
                    textSize = 16f
                    setTextColor(ink)
                    maxLines = 2
                    setPadding(dp(12), 0, dp(4), 0)
                }, LinearLayout.LayoutParams(0, -2, 1f))
            }
            val app = getItem(position)
            val icon = icons.get(app.key) ?: try {
                packageManager.getActivityIcon(ComponentName(app.pkg, app.activity)).also { icons.put(app.key, it) }
            } catch (_: Exception) { packageManager.defaultActivityIcon }
            (row.getChildAt(0) as ImageView).setImageDrawable(icon)
            (row.getChildAt(1) as TextView).text = app.label
            return row
        }
    }

    override fun onDestroy() {
        closed = true
        generation++
        support.close()
        icons.evictAll()
        super.onDestroy()
    }
}
