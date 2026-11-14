package com.balnc.audioddesk

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebView
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.util.ReflectionHelpers

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class WallpaperPickerTest {
    @Test fun photoChooserUsesSystemDocumentPickerAndCompletesCancellation() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        val web = ReflectionHelpers.getField<WebView>(activity, "appWebView")
        var completed = false
        var selected: Array<Uri>? = arrayOf(Uri.EMPTY)
        val callback = ValueCallback<Array<Uri>> { completed = true; selected = it }
        assertTrue(web.webChromeClient!!.onShowFileChooser(web, callback, null))
        val request = shadowOf(activity).nextStartedActivityForResult
        assertEquals(Intent.ACTION_OPEN_DOCUMENT, request.intent.action)
        assertTrue(request.intent.hasCategory(Intent.CATEGORY_OPENABLE))
        assertEquals("image/*", request.intent.type)
        assertFalse(request.intent.getBooleanExtra(Intent.EXTRA_ALLOW_MULTIPLE, false))
        shadowOf(activity).receiveResult(request.intent, Activity.RESULT_CANCELED, null)
        assertTrue(completed)
        assertNull(selected)
        controller.pause().stop().destroy()
    }

    @Test fun chooserRejectsRemotePagesAndNonContentUris() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        val web = ReflectionHelpers.getField<WebView>(activity, "appWebView")
        web.loadUrl("https://example.com")
        assertFalse(web.webChromeClient!!.onShowFileChooser(web, ValueCallback { }, null))
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html")
        var completed = false
        var selected: Array<Uri>? = arrayOf(Uri.EMPTY)
        assertTrue(web.webChromeClient!!.onShowFileChooser(web, ValueCallback { completed = true; selected = it }, null))
        val request = shadowOf(activity).nextStartedActivityForResult
        shadowOf(activity).receiveResult(request.intent, Activity.RESULT_OK, Intent().setData(Uri.parse("file:///private/photo.jpg")))
        assertTrue(completed)
        assertNull(selected)
        controller.pause().stop().destroy()
    }
}
