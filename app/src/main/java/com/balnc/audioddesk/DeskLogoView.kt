package com.balnc.audioddesk

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.os.Build
import android.view.View
import android.view.animation.LinearInterpolator
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Actual 3D rotating Audio Desk for the pull-to-refresh indicator.
 * Uses the same tabletop, four legs, waveform and orthographic geometry as
 * the rotating desk in the HTML header. No bitmap rotation/flat spinner.
 */
class DeskLogoView(context: Context) : View(context) {
    private data class Point3(val x: Float, val y: Float, val z: Float)
    private data class Point2(val x: Float, val y: Float, val depth: Float)
    private data class Face(
        val points: List<Point3>,
        val normal: Point3,
        val color: Int,
        val tabletop: Boolean = false
    )
    private data class Projected(val face: Face, val corners: List<Point2>, val depth: Float)

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        strokeJoin = Paint.Join.ROUND
        strokeCap = Paint.Cap.ROUND
    }
    private val shape = Path()
    private val tilt = sqrt(1f - PITCH * PITCH)
    private val wave = listOf(
        -.69f to 0f, -.60f to -.035f, -.53f to -.035f, -.47f to -.16f,
        -.39f to -.16f, -.32f to .05f, -.23f to .05f, -.15f to -.28f,
        -.07f to -.28f, 0f to .15f, .09f to .15f, .17f to -.24f,
        .25f to -.24f, .33f to .04f, .42f to .04f, .49f to -.12f,
        .56f to -.12f, .69f to 0f
    )
    private val legFaces = mutableListOf<Face>().apply {
        for (x in listOf(-.72f, .72f)) for (z in listOf(-.43f, .43f)) {
            addAll(box(x - .105f, x + .105f, -.61f, .30f, z - .105f, z + .105f, true))
        }
    }
    private val topFaces = box(-.94f, .94f, .30f, .47f, -.63f, .63f, false)
    private var rotation = .68f
    private var refreshing = false
    private var oscillator: ValueAnimator? = null

    fun showPull(progress: Float) {
        if (!refreshing) {
            // Scrub into a slightly turned desk while pulling down.
            rotation = .68f + progress.coerceIn(0f, 1f) * PI.toFloat() * .7f
            invalidate()
        }
    }

    fun setRefreshing(value: Boolean) {
        if (refreshing == value) return
        refreshing = value
        updateAnimation()
    }

    private fun updateAnimation() {
        oscillator?.cancel()
        oscillator = null
        val motionEnabled = Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled()
        if (refreshing && isAttachedToWindow && isShown &&
            windowVisibility == VISIBLE && motionEnabled
        ) {
            // 360-degree continuous yaw, with a complete, seamless loop.
            val start = rotation
            oscillator = ValueAnimator.ofFloat(start, start + 2f * PI.toFloat()).apply {
                duration = 6200L
                repeatCount = ValueAnimator.INFINITE
                interpolator = LinearInterpolator()
                addUpdateListener {
                    rotation = it.animatedValue as Float
                    invalidate()
                }
                start()
            }
        }
        invalidate()
    }

    private fun box(x0: Float, x1: Float, y0: Float, y1: Float, z0: Float, z1: Float, leg: Boolean): List<Face> =
        listOf(
            Face(listOf(p(x0,y1,z0),p(x1,y1,z0),p(x1,y1,z1),p(x0,y1,z1)), p(0f,1f,0f), if(leg) WHITE else TOP, !leg),
            Face(listOf(p(x1,y0,z0),p(x1,y0,z1),p(x1,y1,z1),p(x1,y1,z0)), p(1f,0f,0f), if(leg) LIGHT else RIGHT),
            Face(listOf(p(x0,y0,z0),p(x0,y0,z1),p(x0,y1,z1),p(x0,y1,z0)), p(-1f,0f,0f), if(leg) MID else FRONT),
            Face(listOf(p(x0,y0,z1),p(x1,y0,z1),p(x1,y1,z1),p(x0,y1,z1)), p(0f,0f,1f), if(leg) LIGHT else SIDE),
            Face(listOf(p(x0,y0,z0),p(x1,y0,z0),p(x1,y1,z0),p(x0,y1,z0)), p(0f,0f,-1f), if(leg) MID else BACK)
        )

    private fun p(x: Float,y: Float,z: Float) = Point3(x,y,z)

    private fun project(v: Point3, sn: Float, cs: Float): Point2 {
        val x = v.x * cs + v.z * sn
        val z = -v.x * sn + v.z * cs
        return Point2(64f + x * 32f, 65f + (-v.y * tilt + z * PITCH) * 32f, z)
    }

    private fun renderFaces(canvas: Canvas, faces: List<Face>, sn: Float, cs: Float) {
        val visible = ArrayList<Projected>(faces.size)
        for (face in faces) {
            val rotatedZ = -face.normal.x * sn + face.normal.z * cs
            if (face.normal.y * tilt + rotatedZ * PITCH <= .001f) continue
            val corners = face.points.map { project(it, sn, cs) }
            visible.add(Projected(face,corners,corners.map { it.depth }.average().toFloat()))
        }
        visible.sortBy { it.depth }
        for (f in visible) {
            shape.reset()
            shape.moveTo(f.corners[0].x,f.corners[0].y)
            for (point in f.corners.drop(1)) shape.lineTo(point.x,point.y)
            shape.close()
            paint.style = Paint.Style.FILL
            paint.color = f.face.color
            canvas.drawPath(shape,paint)
            if (f.face.tabletop) {
                paint.style = Paint.Style.STROKE
                paint.strokeWidth = .65f
                paint.color = Color.rgb(255,255,255)
                canvas.drawPath(shape,paint)
            }
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val scale = min(width,height) / 128f
        if (scale <= 0f) return
        canvas.save()
        canvas.translate((width - 128f*scale)/2f,(height - 128f*scale)/2f)
        canvas.scale(scale,scale)
        val sn = sin(rotation)
        val cs = cos(rotation)
        renderFaces(canvas,legFaces,sn,cs)
        renderFaces(canvas,topFaces,sn,cs)
        // Waveform is physically projected onto the tabletop, rather than
        // rotating a flat logo or overlay independently from the desk.
        shape.reset()
        wave.forEachIndexed { i,(x,z) ->
            val p = project(p(x,.472f,z),sn,cs)
            if (i==0) shape.moveTo(p.x,p.y) else shape.lineTo(p.x,p.y)
        }
        paint.style = Paint.Style.STROKE
        paint.color = Color.rgb(8,8,8)
        paint.strokeWidth = 3.4f
        canvas.drawPath(shape,paint)
        canvas.restore()
    }

    override fun onAttachedToWindow() { super.onAttachedToWindow(); updateAnimation() }
    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        updateAnimation()
    }
    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView,visibility)
        if (isAttachedToWindow) updateAnimation()
    }
    override fun onDetachedFromWindow() {
        oscillator?.cancel()
        oscillator=null
        super.onDetachedFromWindow()
    }

    private companion object {
        const val PITCH = .54f
        val WHITE = Color.rgb(245,245,245)
        val LIGHT = Color.rgb(222,222,222)
        val MID = Color.rgb(173,173,173)
        val TOP = Color.rgb(247,247,247)
        val RIGHT = Color.rgb(153,153,153)
        val FRONT = Color.rgb(189,189,189)
        val SIDE = Color.rgb(198,198,198)
        val BACK = Color.rgb(136,136,136)
    }
}
