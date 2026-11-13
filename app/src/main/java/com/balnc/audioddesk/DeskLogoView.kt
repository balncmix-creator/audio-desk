package com.balnc.audioddesk

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.os.Build
import android.view.View
import android.view.animation.LinearInterpolator
import kotlin.math.PI
import kotlin.math.min
import kotlin.math.sin

/** Uses the premium Audio Desk artwork for the native refresh indicator. */
class DeskLogoView(context: Context) : View(context) {
    private val artwork = BitmapFactory.decodeResource(resources, R.drawable.audio_desk_premium)
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val target = RectF(0f, 0f, 128f, 128f)
    private var amplitude = 1f
    private var refreshing = false
    private var oscillator: ValueAnimator? = null

    fun showPull(progress: Float) {
        if (!refreshing) { amplitude = .4f + .6f * progress.coerceIn(0f, 1f); invalidate() }
    }

    fun setRefreshing(value: Boolean) {
        refreshing = value
        updateAnimation()
    }

    private fun updateAnimation() {
        oscillator?.cancel()
        oscillator = null
        amplitude = 1f
        val motionEnabled = Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled()
        if (refreshing && isAttachedToWindow && isShown && windowVisibility == VISIBLE && motionEnabled) {
            oscillator = ValueAnimator.ofFloat(0f, (2 * PI).toFloat()).apply {
                duration = DeskLogoPaths.CYCLE_MS
                repeatCount = ValueAnimator.INFINITE
                interpolator = LinearInterpolator()
                addUpdateListener {
                    val phase = it.animatedValue as Float
                    amplitude = .82f + .14f * sin(phase) + .04f * sin(3f * phase)
                    invalidate()
                }
                start()
            }
        }
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val scale = min(width, height) / 128f
        canvas.save()
        canvas.translate((width - 128f * scale) / 2f, (height - 128f * scale) / 2f)
        canvas.scale(scale, scale)
        // Only subtle light intensity varies; dimensions and proportions never change.
        paint.alpha = (247 + 8 * amplitude).toInt().coerceIn(0, 255)
        canvas.drawBitmap(artwork, null, target, paint)
        canvas.restore()
    }

    override fun onAttachedToWindow() { super.onAttachedToWindow(); updateAnimation() }
    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        updateAnimation()
    }
    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView, visibility)
        if (isAttachedToWindow) updateAnimation()
    }
    override fun onDetachedFromWindow() {
        oscillator?.cancel()
        oscillator = null
        super.onDetachedFromWindow()
    }
}
