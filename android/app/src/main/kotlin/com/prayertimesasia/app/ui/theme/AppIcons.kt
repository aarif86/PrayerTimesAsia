package com.prayertimesasia.app.ui.theme

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Luggage
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

/** The iOS app's own line icons (design/icons in the iOS repo): prayer mat, compass, telescope, masjid, and Google's luggage icon for Journey. */
object AppIcons {
    private fun rect(x: Float, y: Float, w: Float, h: Float, r: Float): String =
        "M${x + r},$y H${x + w - r} A$r,$r 0 0 1 ${x + w},${y + r} V${y + h - r} A$r,$r 0 0 1 ${x + w - r},${y + h} " +
            "H${x + r} A$r,$r 0 0 1 $x,${y + h - r} V${y + r} A$r,$r 0 0 1 ${x + r},$y Z"

    private fun circle(cx: Float, cy: Float, r: Float): String =
        "M${cx - r},$cy A$r,$r 0 1 0 ${cx + r},$cy A$r,$r 0 1 0 ${cx - r},$cy Z"

    private class B(name: String) {
        val b = ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f)
        fun stroke(d: String, width: Float = 1.6f) = apply {
            b.addPath(addPathNodes(d), stroke = SolidColor(Color.Black), strokeLineWidth = width,
                strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round)
        }
        fun fill(d: String) = apply { b.addPath(addPathNodes(d), fill = SolidColor(Color.Black)) }
        fun group(rotate: Float, px: Float, py: Float, body: B.() -> Unit) = apply {
            b.addGroup(rotate = rotate, pivotX = px, pivotY = py)
            body()
            b.clearGroup()
        }
        fun build() = b.build()
    }

    val prayer: ImageVector by lazy {
        B("prayer")
            .stroke(rect(5f, 2f, 14f, 17.5f, 1.8f))
            .stroke("M8.6 15.5V10.2a3.4 3.4 0 0 1 6.8 0V15.5")
            .stroke("M8.6 15.5h6.8")
            .stroke("M7.5 19.5v2.6M10 19.5v2.6M12.5 19.5v2.6M15 19.5v2.6M17 19.5v2.6", 1.3f)
            .build()
    }

    val qibla: ImageVector by lazy {
        B("qibla")
            .stroke(circle(12f, 12f, 9.3f))
            .stroke("M12 5.8l2.3 6.2-2.3 6.2-2.3-6.2z")
            .fill("M12 5.8l2.3 6.2h-4.6z")
            .build()
    }

    val falak: ImageVector by lazy {
        B("falak")
            .group(-28f, 12f, 9f) {
                stroke(rect(5.2f, 7f, 11.5f, 4.2f, 1f))
                stroke(rect(16.7f, 6f, 2.8f, 6.2f, 0.9f))
                stroke(rect(2.6f, 7.9f, 2.6f, 2.4f, 0.6f))
            }
            .stroke("M11.6 12.4L7.2 21.6M11.6 12.4l4.4 9.2M11.6 12.4v9.2")
            .stroke("M4 2.2v3M2.5 3.7h3", 1.3f)
            .build()
    }

    val masjid: ImageVector by lazy {
        B("masjid")
            .stroke("M6.2 13.2C6.2 9.6 9 7.8 12 5.8c3 2 5.8 3.8 5.8 7.4")
            .stroke("M12 5.8V3.4")
            .stroke("M4.8 13.2h14.4v7.3H4.8z")
            .stroke("M10.4 20.5v-2.9a1.6 1.6 0 0 1 3.2 0v2.9")
            .stroke("M2.8 20.5h18.4")
            .fill(circle(12f, 2.6f, 0.5f))
            .build()
    }

    /**
     * A line icon from SVG path data, drawn like the web app's icons: round ends, [width] stroke.
     * [fill] adds the web's soft fill (currentColor at 18%) used for the current tab.
     * Use [circle] for SVG circles. The tab icons below are Lucide's (ISC licence), as on the web.
     */
    fun line(name: String, vararg d: String, width: Float = 1.75f, fill: Boolean = false): ImageVector {
        val b = ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f)
        d.forEach {
            b.addPath(addPathNodes(it), fill = if (fill) SolidColor(Color.Black.copy(alpha = 0.18f)) else null,
                stroke = SolidColor(Color.Black), strokeLineWidth = width,
                strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round)
        }
        return b.build()
    }

    fun circlePath(cx: Float, cy: Float, r: Float): String = circle(cx, cy, r)

    private val tabPaths: Map<String, Array<String>> = mapOf(
        "prayer" to arrayOf(circle(12f, 12f, 10f), "M12 6v6l4 2"),
        "qibla" to arrayOf(circle(12f, 12f, 10f), "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"),
        "falak" to arrayOf(circle(12f, 12f, 4f), "M12 2v2", "M12 20v2", "m4.93 4.93 1.41 1.41", "m17.66 17.66 1.41 1.41",
            "M2 12h2", "M20 12h2", "m6.34 17.66-1.41 1.41", "m19.07 4.93-1.41 1.41"),
        "masjid" to arrayOf("M6.2 13.2C6.2 9.6 9 7.8 12 5.8c3 2 5.8 3.8 5.8 7.4", "M12 5.8V3.4", "M4.8 13.2h14.4v7.3H4.8z",
            "M10.4 20.5v-2.9a1.6 1.6 0 0 1 3.2 0v2.9", "M2.8 20.5h18.4"),
        "settings" to arrayOf("M10 5H3", "M12 19H3", "M14 3v4", "M16 17v4", "M21 12h-9", "M21 19h-5", "M21 5h-7", "M8 10v4", "M8 12H3"),
    )
    private val tabCache = HashMap<String, ImageVector>()

    /** The web app's tab bar icons: clock, compass, sun, masjid, sliders. */
    fun tab(key: String, selected: Boolean): ImageVector = tabCache.getOrPut("$key-$selected") {
        val v = line("tab-$key", *tabPaths.getValue(key), width = if (key == "masjid") 1.6f else 1.75f, fill = selected)
        if (key != "masjid") v else ImageVector.Builder("tab-masjid-dot", 24.dp, 24.dp, 24f, 24f).apply {
            tabPaths.getValue(key).forEach {
                addPath(addPathNodes(it), fill = if (selected) SolidColor(Color.Black.copy(alpha = 0.18f)) else null,
                    stroke = SolidColor(Color.Black), strokeLineWidth = 1.6f, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round)
            }
            addPath(addPathNodes(circle(12f, 2.6f, 0.5f)), fill = SolidColor(Color.Black))
        }.build()
    }

    /** Google's own Material "luggage" icon, so it reads as travel and never as Airplane Mode. */
    val journey: ImageVector get() = Icons.Filled.Luggage
}
