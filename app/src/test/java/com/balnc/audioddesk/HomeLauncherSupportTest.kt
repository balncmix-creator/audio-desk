package com.balnc.audioddesk

import android.app.Activity
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.ApplicationInfo
import android.content.pm.ResolveInfo
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class HomeLauncherSupportTest {
    @Test fun explicitRefreshFindsNewAppsAndExcludesTheLauncherItself() {
        val controller = Robolectric.buildActivity(Activity::class.java).setup()
        val activity = controller.get()
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        fun add(pkg: String) {
            val info = ResolveInfo().apply {
                activityInfo = ActivityInfo().apply {
                    packageName = pkg; name = "$pkg.Main"; enabled = true; exported = true
                    applicationInfo = ApplicationInfo().apply { packageName = pkg; enabled = true }
                }
            }
            shadowOf(activity.packageManager).addResolveInfoForIntent(intent, info)
        }
        add(activity.packageName); add("test.first")
        val support = HomeLauncherSupport(activity)
        try {
            fun load(force: Boolean): JSONArray {
                val finished = CountDownLatch(1)
                var result = JSONArray()
                support.load(force) { apps, _ -> result = apps; finished.countDown() }
                assertTrue(finished.await(3, TimeUnit.SECONDS))
                return result
            }
            assertEquals(1, load(false).length())
            add("test.second")
            assertEquals(1, load(false).length())
            val refreshed = load(true)
            assertEquals(2, refreshed.length())
            for (i in 0 until refreshed.length()) assertNotEquals(activity.packageName, refreshed.getJSONObject(i).getString("pkg"))
        } finally { support.close(); controller.pause().stop().destroy() }
    }
}
