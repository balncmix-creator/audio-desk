package com.balnc.audioddesk

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.os.Build
import android.view.View
import android.view.animation.LinearInterpolator
import androidx.core.graphics.PathParser
import kotlin.math.PI
import kotlin.math.min
import kotlin.math.sin

/** The desk never moves: only the local audio amplitude oscillates before projection. */
class DeskLogoView(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val top = PathParser.createPathFromPathData(DeskLogoPaths.TOP)!!
    private val side = PathParser.createPathFromPathData(DeskLogoPaths.SIDE)!!
    private val legs = PathParser.createPathFromPathData(DeskLogoPaths.LEGS)!!
    private val wave = PathParser.createPathFromPathData(DeskLogoPaths.WAVE)!!
    private val projection = Matrix().apply { setValues(DeskLogoPaths.PROJECTION) }
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
                    amplitude = .68f + .24f * sin(phase) + .08f * sin(3f * phase)
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
        paint.color = Color.rgb(153, 153, 153)
        canvas.drawPath(side, paint)
        paint.color = Color.WHITE
        canvas.drawPath(legs, paint)
        canvas.drawPath(top, paint)
        canvas.concat(projection)
        canvas.scale(1f, amplitude)
        paint.color = Color.BLACK
        canvas.drawPath(wave, paint)
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
