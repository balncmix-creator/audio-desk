package com.balnc.audioddesk

import android.app.Activity
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.LooperMode
import java.time.Duration

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
@LooperMode(LooperMode.Mode.PAUSED)
class DeskRefreshLayoutTest {
    private lateinit var layout: DeskRefreshLayout
    private lateinit var content: View
    private var scrolled = false
    private var calls = 0
    private var density = 1f

    @Before fun setup() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        density = activity.resources.displayMetrics.density
        content = object : View(activity) {
            override fun canScrollVertically(direction: Int) = scrolled
            override fun onTouchEvent(event: MotionEvent) = true
        }
        layout = DeskRefreshLayout(activity)
        layout.setContent(content)
        layout.setOnRefreshListener { calls++ }
        activity.setContentView(layout)
        layout.measure(View.MeasureSpec.makeMeasureSpec(400, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(900, View.MeasureSpec.EXACTLY))
        layout.layout(0, 0, 400, 900)
    }

    private fun touch(action: Int, x: Float, y: Float) {
        val event = MotionEvent.obtain(0, 100, action, x * density, y * density, 0)
        layout.dispatchTouchEvent(event)
        event.recycle()
    }

    private fun pull(to: Float, ending: Int = MotionEvent.ACTION_UP) {
        touch(MotionEvent.ACTION_DOWN, 20f, 20f)
        touch(MotionEvent.ACTION_MOVE, 20f, to)
        touch(MotionEvent.ACTION_MOVE, 20f, to)
        touch(ending, 20f, to)
    }

    @Test fun completePullRefreshesOnceAndCompletionRetractsContent() {
        pull(240f)
        assertTrue(layout.isRefreshing)
        assertEquals(1, calls)
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(250))
        assertTrue(content.translationY > 0f)
        pull(240f)
        assertEquals(1, calls)
        layout.isRefreshing = false
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(250))
        assertEquals(0f, content.translationY, .1f)
    }

    @Test fun shortPullDoesNotRefresh() {
        pull(70f)
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(250))
        assertFalse(layout.isRefreshing)
        assertEquals(0, calls)
        assertEquals(0f, content.translationY, .1f)
    }

    @Test fun cancelledPullDoesNotRefresh() {
        pull(240f, MotionEvent.ACTION_CANCEL)
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(250))
        assertFalse(layout.isRefreshing)
        assertEquals(0, calls)
        assertEquals(0f, content.translationY, .1f)
    }

    @Test fun scrolledContentDoesNotTriggerRefresh() {
        scrolled = true
        pull(240f)
        assertFalse(layout.isRefreshing)
        assertEquals(0, calls)
    }

    @Test fun horizontalSwipeDoesNotTriggerRefresh() {
        touch(MotionEvent.ACTION_DOWN, 20f, 20f)
        touch(MotionEvent.ACTION_MOVE, 230f, 60f)
        touch(MotionEvent.ACTION_UP, 230f, 60f)
        assertFalse(layout.isRefreshing)
        assertEquals(0, calls)
    }
}
