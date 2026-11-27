package com.prayertimesasia.app.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

/**
 * The web app's line icons (Lucide, ISC licence), so Android draws the same shapes.
 * Paths copied from web/node_modules/lucide-preact. Tint them with Icon(tint = ...).
 */
object Lucide {
    private fun c(cx: Float, cy: Float, r: Float) = AppIcons.circlePath(cx, cy, r)
    private val cache = HashMap<String, ImageVector>()
    private fun icon(name: String, width: Float, vararg d: String): ImageVector =
        cache.getOrPut("$name-$width") { AppIcons.line(name, *d, width = width) }

    fun sun(w: Float = 1.75f) = icon("sun", w, c(12f, 12f, 4f), "M12 2v2", "M12 20v2", "m4.93 4.93 1.41 1.41", "m17.66 17.66 1.41 1.41",
        "M2 12h2", "M20 12h2", "m6.34 17.66-1.41 1.41", "m19.07 4.93-1.41 1.41")
    fun moon(w: Float = 1.75f) = icon("moon", w,
        "M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401")
    fun calendar(w: Float = 2f) = icon("calendar", w, "M8 2v3", "M16 2v3", "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M3 9h18")
    fun chevronLeft(w: Float = 2f) = icon("chevron-left", w, "m15 18-6-6 6-6")
    fun chevronRight(w: Float = 2f) = icon("chevron-right", w, "m9 18 6-6-6-6")
    fun chevronDown(w: Float = 2f) = icon("chevron-down", w, "m6 9 6 6 6-6")
    fun chevronUp(w: Float = 2f) = icon("chevron-up", w, "m18 15-6-6-6 6")
    fun alarmClock(w: Float = 2f) = icon("alarm-clock", w, c(12f, 13f, 8f), "M12 9v4l2 2", "M5 3 2 6", "m22 6-3-3", "M6.38 18.7 4 21", "M17.64 18.67 20 21")
    fun ellipsis(w: Float = 2.4f) = icon("ellipsis", w, c(12f, 12f, 1f), c(19f, 12f, 1f), c(5f, 12f, 1f))
    fun bellRing(w: Float = 2f) = icon("bell-ring", w, "M10.268 21a2 2 0 0 0 3.464 0", "M22 8c0-2.3-.8-4.3-2-6",
        "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",
        "M4 2C2.8 3.7 2 5.7 2 8")
    fun bellOff(w: Float = 2f) = icon("bell-off", w, "M10.268 21a2 2 0 0 0 3.464 0",
        "M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742", "m2 2 20 20",
        "M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05")
    fun navigation(w: Float = 2f) = icon("navigation", w, "M3 11 22 2 13 21 11 13 3 11z")
    /** The GPS arrow, filled (the place chip). */
    val navigationFilled: ImageVector by lazy {
        ImageVector.Builder("navigation-filled", 24.dp, 24.dp, 24f, 24f).addPath(
            addPathNodes("M3 11 22 2 13 21 11 13 3 11z"), fill = SolidColor(Color.Black), stroke = SolidColor(Color.Black),
            strokeLineWidth = 2f, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round,
        ).build()
    }
    fun mapPin(w: Float = 2f) = icon("map-pin", w,
        "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0", c(12f, 10f, 3f))
    fun check(w: Float = 2f) = icon("check", w, "M20 6 9 17l-5-5")
    fun undo2(w: Float = 2f) = icon("undo-2", w, "M9 14 4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11")
    fun circleCheck(w: Float = 2f) = icon("circle-check", w, c(12f, 12f, 10f), "m16 9-5.5 5.5L8 12")
    fun palette(w: Float = 2f) = icon("palette", w,
        "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",
        c(13.5f, 6.5f, .5f), c(17.5f, 10.5f, .5f), c(6.5f, 12.5f, .5f), c(8.5f, 7.5f, .5f))
    fun x(w: Float = 2f) = icon("x", w, "M18 6 6 18", "m6 6 12 12")
    fun heart(w: Float = 2f) = icon("heart", w,
        "M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5")
    fun sparkles(w: Float = 2f) = icon("sparkles", w,
        "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",
        "M20 2v4", "M22 4h-4", c(4f, 20f, 2f))
    fun utensils(w: Float = 2f) = icon("utensils", w, "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2", "M7 2v20", "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7")
    fun cloudMoon(w: Float = 2f) = icon("cloud-moon", w, "M13 16a3 3 0 0 1 0 6H7a5 5 0 1 1 4.9-6z",
        "M18.376 14.512a6 6 0 0 0 3.461-4.127c.148-.625-.659-.97-1.248-.714a4 4 0 0 1-5.259-5.26c.255-.589-.09-1.395-.716-1.248a6 6 0 0 0-4.594 5.36")
}
