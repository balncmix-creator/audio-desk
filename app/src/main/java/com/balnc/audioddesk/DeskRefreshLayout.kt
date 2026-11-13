package com.balnc.audioddesk

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Color
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.abs

/** A top-only vertical pull gesture with the desk as its sole loading indicator. */
class DeskRefreshLayout(context: Context) : FrameLayout(context) {
    private val density = resources.displayMetrics.density
    private val threshold = 72f * density
    private val restingOffset = 108f * density
    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    private val desk = DeskLogoView(context)
    private val label = TextView(context).apply {
        textSize = 10f
        setTextColor(Color.LTGRAY)
        gravity = Gravity.CENTER
    }
    private val indicator = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        addView(desk, LinearLayout.LayoutParams(dp(84), dp(84)))
        addView(label, LinearLayout.LayoutParams(-1, dp(20)))
        alpha = 0f
    }
    private var content: View? = null
    private var listener: (() -> Unit)? = null
    private var startX = 0f
    private var startY = 0f
    private var eligible = false
    private var dragging = false
    private var distance = 0f
    private var settle: ValueAnimator? = null

    var isRefreshing = false
        set(value) {
            if (field == value) return
            field = value
            desk.setRefreshing(value)
            label.text = if (value) "UPDATING AUDIO NEWS…" else "PULL TO REFRESH"
            animateOffset(if (value) restingOffset else 0f)
            if (value) announceForAccessibility("Refreshing audio news")
        }

    init {
        setBackgroundColor(Color.rgb(8, 8, 8))
        clipChildren = true
        addView(indicator, LayoutParams(-1, dp(108), Gravity.TOP or Gravity.CENTER_HORIZONTAL))
    }

    fun setContent(view: View) {
        check(content == null)
        content = view
        addView(view, LayoutParams(-1, -1))
    }

    fun setOnRefreshListener(block: () -> Unit) { listener = block }

    override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
        if (!isEnabled || isRefreshing) return false
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                startX = event.x
                startY = event.y
                eligible = content?.canScrollVertically(-1) == false
                dragging = false
            }
            MotionEvent.ACTION_MOVE -> {
                val dy = event.y - startY
                val dx = abs(event.x - startX)
                if (dx > touchSlop && dx > abs(dy)) eligible = false
                if (eligible && dy > touchSlop && dy > dx && content?.canScrollVertically(-1) == false) {
                    dragging = true
                    settle?.cancel()
                    parent?.requestDisallowInterceptTouchEvent(true)
                    return true
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> { eligible = false; dragging = false }
        }
        return dragging
    }

    override fun requestDisallowInterceptTouchEvent(disallowIntercept: Boolean) {
        // WebView may request exclusive touches before a top-edge pull.
        // Horizontal gestures are locked out in onInterceptTouchEvent.
        if (!disallowIntercept || !eligible || content?.canScrollVertically(-1) == true) {
            super.requestDisallowInterceptTouchEvent(disallowIntercept)
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (!dragging) return false
        when (event.actionMasked) {
            MotionEvent.ACTION_MOVE -> {
                showOffset(((event.y - startY) * .5f).coerceIn(0f, 132f * density))
                label.text = if (distance >= threshold) "RELEASE TO REFRESH" else "PULL TO REFRESH"
            }
            MotionEvent.ACTION_UP -> {
                dragging = false
                eligible = false
                if (distance >= threshold) {
                    isRefreshing = true
                    listener?.invoke()
                } else animateOffset(0f)
            }
            MotionEvent.ACTION_CANCEL, MotionEvent.ACTION_POINTER_DOWN -> {
                dragging = false
                eligible = false
                animateOffset(0f)
            }
        }
        return true
    }

    private fun showOffset(value: Float) {
        distance = value
        content?.translationY = value
        indicator.alpha = (value / threshold).coerceIn(0f, 1f)
        desk.showPull(value / threshold)
    }

    private fun animateOffset(target: Float) {
        settle?.cancel()
        settle = ValueAnimator.ofFloat(distance, target).apply {
            duration = 180L
            interpolator = DecelerateInterpolator()
            addUpdateListener { showOffset(it.animatedValue as Float) }
            start()
        }
    }

    override fun onDetachedFromWindow() {
        settle?.cancel()
        super.onDetachedFromWindow()
    }

    private fun dp(value: Int) = (value * density + .5f).toInt()
}
