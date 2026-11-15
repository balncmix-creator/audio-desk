package com.balnc.audioddesk

import android.content.Intent
import android.view.View
import android.webkit.WebView
import android.widget.LinearLayout
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.util.ReflectionHelpers

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [23, 28, 35])
class LauncherLifecycleTest {
    @Test fun homeStartsWithoutPullRefreshAndOnlyLocalViewReadsSelectedPhotos() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        val refresh = ReflectionHelpers.getField<DeskRefreshLayout>(activity, "swipeRefresh")
        val local = ReflectionHelpers.getField<WebView>(activity, "appWebView")
        val remote = ReflectionHelpers.getField<WebView>(activity, "browserWebView")
        assertFalse(refresh.isEnabled)
        assertFalse(refresh.isRefreshing)
        assertTrue(local.settings.allowContentAccess)
        assertFalse(local.settings.allowFileAccess)
        assertFalse(remote.settings.allowContentAccess)
        assertFalse(remote.settings.allowFileAccess)
        controller.pause().stop().destroy()
    }

    @Test fun homeIntentClosesTheArticleBrowserAndRetractsRefresh() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        val panel = ReflectionHelpers.getField<LinearLayout>(activity, "browserPanel")
        val refresh = ReflectionHelpers.getField<DeskRefreshLayout>(activity, "swipeRefresh")
        ReflectionHelpers.callInstanceMethod<Void>(activity, "openInBrowser",
            ReflectionHelpers.ClassParameter.from(String::class.java, "https://example.com/article"))
        assertEquals(View.VISIBLE, panel.visibility)
        assertFalse(refresh.isEnabled)
        ReflectionHelpers.callInstanceMethod<Void>(activity, "onNewIntent",
            ReflectionHelpers.ClassParameter.from(Intent::class.java, Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)))
        assertEquals(View.GONE, panel.visibility)
        assertEquals(View.VISIBLE, refresh.visibility)
        assertFalse(refresh.isRefreshing)
        controller.pause().stop().destroy()
    }
}
