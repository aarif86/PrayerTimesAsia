package com.prayertimesasia.app.ui.theme

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.R
import kotlin.math.ceil
import kotlin.math.hypot

/**
 * The app icon's look, carried inside the app: the navy compass ring, the faint
 * fine-line kawung batik and the cream hand-stitching (brand guide, November 2026).
 * Kawung only ever sits on solid navy, never behind body text on the sky.
 */
object Brand {
    val nightNavy = Color(0xFF151A45)
    val compassRing = Color(0xFF262B5E)
    val stitchCream = Color(0xFFF2EEE9)
    val stitchThread = Color(0xFFF2E6CF)
    val moonText = Color(0xFFEEF0FA)
    /** The N on the navy ring: the icon's coral, a touch lighter so it reads at text size (5.5:1). */
    val northOnRing = Color(0xFFF28B78)
    /** Width of the navy compass ring on the Qibla dial. N E S W and the Ka'bah sit on it. */
    val bezel = 58.dp
}

/** Fine-line kawung batik over the whole draw area: four ellipse petals and a dot on a 45° grid. */
fun DrawScope.drawKawung(tile: Dp = 18.dp, color: Color = Color.White, alpha: Float) {
    val t = tile.toPx()
    val s = t / 40f
    val stroke = Stroke(1.8f * s)
    val n = ceil(hypot(size.width, size.height) / t / 2).toInt() + 1
    rotate(45f, center) {
        for (gx in -n..n) for (gy in -n..n) {
            val ox = center.x + gx * t
            val oy = center.y + gy * t
            for ((cx, cy, rx, ry) in PETALS) {
                drawOval(color, Offset(ox + (cx - rx) * s, oy + (cy - ry) * s), Size(2 * rx * s, 2 * ry * s), alpha = alpha, style = stroke)
            }
            drawCircle(color, 1.8f * s, Offset(ox + 20f * s, oy + 20f * s), alpha = alpha)
        }
    }
}

private val PETALS = listOf(
    listOf(20f, 10f, 5.6f, 9.2f), listOf(20f, 30f, 5.6f, 9.2f), listOf(10f, 20f, 9.2f, 5.6f), listOf(30f, 20f, 9.2f, 5.6f),
)

private fun DrawScope.stitch() =
    Stroke(1.4.dp.toPx(), cap = StrokeCap.Round, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.2.dp.toPx())))

/** The icon's compass ring for the Qibla dial: cream edge, navy band, kawung at 20%, stitches on both edges. */
fun DrawScope.drawCompassBezel() {
    val outer = size.minDimension / 2 - 3.dp.toPx()
    val inner = size.minDimension / 2 - Brand.bezel.toPx()
    val band = Path().apply {
        fillType = PathFillType.EvenOdd
        addOval(Rect(center, outer))
        addOval(Rect(center, inner))
    }
    drawCircle(Brand.stitchCream, outer + 1.5.dp.toPx(), style = Stroke(3.dp.toPx()))
    drawPath(band, Brand.compassRing)
    clipPath(band) { drawKawung(alpha = 0.2f) }
    drawCircle(Brand.stitchThread, outer - 5.dp.toPx(), alpha = 0.5f, style = stitch())
    drawCircle(Brand.stitchThread, inner + 5.dp.toPx(), alpha = 0.5f, style = stitch())
}

/** The card at the top of Settings: the app icon on navy with kawung and stitching. Opens Sources & credits. */
@Composable
fun AppCard(version: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(22.dp)
    Box(
        modifier.fillMaxWidth().shadow(10.dp, shape).clip(shape).background(Brand.compassRing).clickable(onClick = onClick)
            .semantics(mergeDescendants = true) { contentDescription = "Prayer Times Asia, version $version. Sources and credits" },
    ) {
        Canvas(Modifier.matchParentSize()) {
            drawKawung(alpha = 0.16f)
            val inset = 6.dp.toPx()
            drawRoundRect(Brand.stitchThread, Offset(inset, inset), Size(size.width - 2 * inset, size.height - 2 * inset),
                CornerRadius(17.dp.toPx()), alpha = 0.45f, style = stitch())
        }
        Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Image(painterResource(R.drawable.app_icon_card), null,
                Modifier.size(64.dp).shadow(7.dp, RoundedCornerShape(15.dp)).clip(RoundedCornerShape(15.dp)))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("Prayer Times Asia", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                Text("Built fisabilillah in Singapore", color = Brand.moonText.copy(alpha = 0.88f), fontSize = 14.sp)
                Text("Version $version", color = Brand.moonText.copy(alpha = 0.75f), fontSize = 13.sp)
            }
            Icon(Icons.Filled.ChevronRight, null, tint = Brand.moonText.copy(alpha = 0.75f))
        }
    }
}
