package com.prayertimesasia.app.ui.qibla

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.R
import com.prayertimesasia.app.ui.components.BandColors
import com.prayertimesasia.app.ui.components.LookIcons
import com.prayertimesasia.app.ui.components.green
import com.prayertimesasia.app.ui.components.lookText
import com.prayertimesasia.app.ui.components.tr
import com.prayertimesasia.app.ui.theme.LocalLook
import com.prayertimesasia.app.ui.theme.LocalSkyScheme
import com.prayertimesasia.app.ui.theme.Look
import com.prayertimesasia.app.ui.theme.Rounded
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sign
import kotlin.math.sin

/*
 * The five qibla dials, drawn as on the web app (web/src/ui/Qibla.tsx) and the looks mockup.
 * Each is drawn in the web's SVG units (its viewBox) and scaled to fit, so the shapes,
 * line widths and letter sizes stay in the same proportions.
 */

/** What every dial needs: the unwrapped phone heading, the Ka'bah's place from the top, and whether it is lined up. */
data class DialInput(val heading: Float, val rel: Float, val aligned: Boolean)

/** Turns smoothly to the new angle (the web's 0.35 s turn), or at once when motion is reduced. */
@Composable
private fun smooth(target: Float, label: String): Float {
    val reduce = LocalSkyScheme.current.reduceMotion
    val v by animateFloatAsState(target, if (reduce) tween(0) else tween(350), label = label)
    return if (reduce) target else v
}

/** Dial width: the mockup's size on a phone, smaller on narrow screens. */
@Composable
private fun dialSize(max: Int, margin: Int): Dp {
    val w = min(LocalConfiguration.current.screenWidthDp, 480)
    return maxOf(220, minOf(max, w - margin)).dp
}

private fun pol(c: Float, r: Float, deg: Float): Offset {
    val a = deg * PI.toFloat() / 180f
    return Offset(c + sin(a) * r, c - cos(a) * r)
}

/** The Ka'bah: a dark cube with the gold band, upright. */
private fun DrawScope.kaaba(at: Offset, s: Float) {
    drawRoundRect(Color(0xFF111111), Offset(at.x - s / 2, at.y - s / 2), Size(s, s), CornerRadius(s * 0.14f))
    drawRect(Color(0xFFE2B65A), Offset(at.x - s / 2, at.y - s * 0.22f), Size(s, s * 0.12f))
}

/** A letter that turns with the dial but stays upright. */
private fun DrawScope.letter(tm: TextMeasurer, t: String, at: Offset, size: Float, color: Color, weight: FontWeight = FontWeight.Bold) {
    val style = TextStyle(fontFamily = Rounded, fontSize = size.toSp(), fontWeight = weight, color = color)
    val m = tm.measure(t, style)
    drawText(m, topLeft = Offset(at.x - m.size.width / 2f, at.y - m.size.height / 2f))
}

/** Ticks round the edge, longer at N, E, S and W. */
private fun DrawScope.ticks(c: Float, n: Int, len: Float, r: Float, color: Color, width: Float) {
    for (k in 0 until n) {
        val l = if (k % (n / 4) == 0) len * 1.7f else len
        drawLine(color, pol(c, r, k * 360f / n), pol(c, r - l, k * 360f / n), width)
    }
}

/** Draws in the web's viewBox units: [v] units fill the whole canvas. */
private fun DrawScope.inUnits(v: Float, block: DrawScope.() -> Unit) {
    val k = size.width / v
    withTransform({ scale(k, k, Offset.Zero) }) { block() }
}

/** The box round every round dial: the top marker, and the green "Aligned" circle. */
@Composable
private fun DialBox(size: Dp, aligned: Boolean, content: @Composable () -> Unit) {
    val look = LocalLook.current
    val label = if (aligned) tr(R.string.qibla_facingQibla) else tr(R.string.qibla_compass)
    Box(Modifier.size(size).semantics { contentDescription = label }, contentAlignment = Alignment.Center) {
        if (aligned) Canvas(Modifier.fillMaxSize()) {
            // The web's soft green glow round the dial.
            drawCircle(Brush.radialGradient(0.8f to look.green.copy(alpha = 0.28f), 1f to Color.Transparent, center = center, radius = this.size.minDimension / 2 + 14.dp.toPx()),
                this.size.minDimension / 2 + 14.dp.toPx())
        }
        content()
        // The little bar at the top: the way the phone points.
        Box(Modifier.align(Alignment.TopCenter).offset(y = (-12).dp).size(4.dp, 16.dp).clip(RoundedCornerShape(2.dp))
            .background(if (aligned) look.green else look.c.tx))
        if (aligned) {
            val glass = if (look.dark) Color(30, 32, 60).copy(alpha = 0.78f) else Color.White.copy(alpha = 0.8f)
            Column(
                Modifier.size(size * 0.34f).border(4.dp, look.green.copy(alpha = 0.55f), CircleShape).clip(CircleShape).background(glass),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
            ) {
                Icon(LookIcons.get("check", 3.2f), null, Modifier.size(size * 0.1f), tint = look.green)
                Text(tr(R.string.qibla_aligned), style = lookText(15.sp, FontWeight.SemiBold), color = look.c.tx)
            }
        }
    }
}

/** Centre Dial: the navy kawung bezel with the Ka'bah and a glowing arrow. */
@Composable
fun BezelCompass(d: DialInput) {
    val look = LocalLook.current
    val tm = rememberTextMeasurer()
    val h = smooth(d.heading, "h")
    val rel = smooth(d.rel, "rel")
    val size = dialSize(340, 40)
    val bez = if (look.dark) Color(0xFF262B5E) else Color(0xFF2D3573)
    val face = if (look.dark) Color(0xFF1B1F4A) else Color(0xFFE9F0F8)
    val glow = if (look.dark) Color(0xFFF7BD8F) else Color(0xFFFFD6A8)
    val arrow = if (d.aligned) look.green else if (look.dark) Color(0xFFF7BD8F) else Color(0xFFE8924A)
    DialBox(size, d.aligned) {
        Canvas(Modifier.fillMaxSize()) {
            inUnits(340f) {
                val c = 170f
                rotate(-h, Offset(c, c)) {
                    drawCircle(bez, c - 3, Offset(c, c))
                    // Kawung batik: rings of circles on a 22 unit grid.
                    val ring = Path().apply { addOval(androidx.compose.ui.geometry.Rect(Offset(c, c), c - 3)) }
                    clipPath(ring) {
                        val kw = Color.White.copy(alpha = 0.17f)
                        var y = 0f
                        while (y <= 340f) {
                            var x = 0f
                            while (x <= 340f) {
                                drawCircle(kw, 8f, Offset(x + 11, y), style = Stroke(1f))
                                drawCircle(kw, 8f, Offset(x, y + 11), style = Stroke(1f))
                                x += 22f
                            }
                            y += 22f
                        }
                    }
                    drawCircle(Color.White, c - 3, Offset(c, c), style = Stroke(5f))
                    ticks(c, 36, 7f, c - 4, Color.White.copy(alpha = 0.7f), 2f)
                    drawCircle(face, c - 62, Offset(c, c))
                    drawCircle(Color.White.copy(alpha = 0.35f), c - 62, Offset(c, c),
                        style = Stroke(1f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4f, 4f))))
                }
                listOf("N", "E", "S", "W").forEachIndexed { i, t ->
                    letter(tm, t, pol(c, c - 40, i * 90f - h), 20f, if (i == 0) Color(0xFFFF8F7A) else Color.White)
                }
                drawCircle(Brush.radialGradient(listOf(glow.copy(alpha = 0.6f), glow.copy(alpha = 0f)), Offset(c, c), c * 0.34f), c * 0.34f, Offset(c, c))
                val k = pol(c, c - 46, rel)
                drawLine(arrow, pol(c, -4f, rel), k, 5f, StrokeCap.Round)
                kaaba(k, 36f)
                drawCircle(arrow, 9f, Offset(c, c))
            }
        }
    }
}

/** Colour Bands: a flat compass cut from the six band colours. */
@Composable
fun BandsCompass(d: DialInput) {
    val look = LocalLook.current
    val tm = rememberTextMeasurer()
    val h = smooth(d.heading, "h")
    val rel = smooth(d.rel, "rel")
    val size = dialSize(330, 50)
    DialBox(size, d.aligned) {
        Canvas(Modifier.fillMaxSize()) {
            inUnits(330f) {
                val c = 165f
                val r = c - 4
                val w = 34f
                rotate(-h, Offset(c, c)) {
                    BandColors.forEachIndexed { k, col ->
                        drawArc(col, k * 60f - 90f, 60f, false, Offset(c - (r - w / 2), c - (r - w / 2)), Size(2 * (r - w / 2), 2 * (r - w / 2)), style = Stroke(w))
                    }
                    drawCircle(look.c.card, r - w, Offset(c, c))
                }
                listOf("N", "E", "S", "W").forEachIndexed { i, t ->
                    letter(tm, t, pol(c, r - w - 26, i * 90f - h), 22f, if (i == 0) Color(0xFFD3705C) else look.c.tx, FontWeight.ExtraBold)
                }
                val k = pol(c, r - w / 2, rel)
                drawLine(look.c.accent, Offset(c, c), k, 6f)
                kaaba(k, 34f)
                drawCircle(look.c.accent, 9f, Offset(c, c))
            }
        }
    }
}

/** Big and Simple: one big arrow that points at the Ka'bah. */
@Composable
fun SimpleCompass(d: DialInput) {
    val look = LocalLook.current
    val tm = rememberTextMeasurer()
    val h = smooth(d.heading, "h")
    val rel = smooth(d.rel, "rel")
    val size = dialSize(300, 80)
    val north = if (look.dark) Color(0xFFFF8F7A) else Color(0xFFE0634F)
    DialBox(size, d.aligned) {
        Canvas(Modifier.fillMaxSize()) {
            inUnits(300f) {
                val c = 150f
                drawCircle(look.c.card, 140f, Offset(c, c))
                drawCircle(look.c.tx3.copy(alpha = look.c.tx3.alpha * 0.5f), 140f, Offset(c, c), style = Stroke(3f))
                letter(tm, "N", pol(c, 112f, -h), 26f, north)
                rotate(rel, Offset(c, c)) {
                    val p = Path().apply {
                        moveTo(150f, 52f); lineTo(198f, 128f); lineTo(168f, 128f); lineTo(168f, 236f)
                        lineTo(132f, 236f); lineTo(132f, 128f); lineTo(102f, 128f); close()
                    }
                    drawPath(p, look.c.accent)
                }
                kaaba(pol(c, 124f, rel), 50f)
                drawCircle(Color.White, 12f, Offset(c, c))
                drawCircle(look.c.accent, 12f, Offset(c, c), style = Stroke(5f))
            }
        }
    }
}

/** Calm Gold: a thin gold ring, fine ticks and a gold Ka'bah mark. */
@Composable
fun GoldCompass(d: DialInput) {
    val look = LocalLook.current
    val tm = rememberTextMeasurer()
    val h = smooth(d.heading, "h")
    val rel = smooth(d.rel, "rel")
    val size = dialSize(330, 50)
    DialBox(size, d.aligned) {
        Canvas(Modifier.fillMaxSize()) {
            inUnits(330f) {
                val c = 165f
                drawCircle(look.c.accent.copy(alpha = 0.07f), c * 0.94f, Offset(c, c))
                drawCircle(look.c.accent, c * 0.8f, Offset(c, c), style = Stroke(3f))
                rotate(-h, Offset(c, c)) { ticks(c, 72, 4f, c - 4, look.c.tx3, 2f) }
                letter(tm, "N", pol(c, c * 0.8f - 26, -h), 22f, look.c.tx2)
                drawLine(look.c.accent, pol(c, -30f, rel), pol(c, 60f, rel), 4f, StrokeCap.Round)
                val m = pol(c, c - 30, rel)
                drawRoundRect(look.c.accent, Offset(m.x - 16, m.y - 16), Size(32f, 32f), CornerRadius(8f))
                drawLine(Color(0xFF151100), Offset(m.x - 8, m.y), Offset(m.x + 8, m.y), 3f, StrokeCap.Round)
            }
        }
    }
}

/** Sun Path: the sun moves along the day's curve; turn until it reaches the Ka'bah. */
@Composable
fun SunCurve(rel: Float, aligned: Boolean, hasHeading: Boolean, modifier: Modifier = Modifier) {
    val look = LocalLook.current
    val tm = rememberTextMeasurer()
    val label = if (aligned) tr(R.string.qibla_facingQibla) else tr(R.string.qibla_compass)
    val sunWord = if (hasHeading) tr(R.string.qibla_youFaceHere) else tr(R.string.qibla_northHere)
    fun y(x: Float) = 164f - 40f * cos(PI.toFloat() * (x - 208f) / 196f)
    val kx = 195f
    // Steep near the Ka'bah, and still moving all the way out to half a turn, so the sun never looks stuck.
    val off = min(180f, abs(rel)) / 180f
    val sx = smooth(kx - sign(rel) * 181f * (1 - (1 - off).pow(2)), "sun")
    BoxWithConstraints(modifier.fillMaxWidth().aspectRatio(390f / 150f).semantics { contentDescription = label }) {
        Canvas(Modifier.fillMaxSize()) {
            inUnits(390f) {
                withTransform({ translate(0f, -70f) }) {
                    drawLine(look.c.tx3.copy(alpha = look.c.tx3.alpha * 0.5f), Offset(0f, 164f), Offset(390f, 164f), 1f)
                    val curve = Path().apply {
                        var x = -10f
                        moveTo(x, y(x))
                        while (x < 400f) { x += 5f; lineTo(x, y(x)) }
                    }
                    drawPath(curve, look.c.tx3.copy(alpha = look.c.tx3.alpha * 0.7f), style = Stroke(2.5f, cap = StrokeCap.Round))
                    if (!aligned) {
                        val a = min(sx, kx)
                        val b = maxOf(sx, kx)
                        val seg = Path().apply {
                            var x = a
                            moveTo(x, y(x))
                            while (x + 4 <= b) { x += 4f; lineTo(x, y(x)) }
                            lineTo(b, y(b))
                        }
                        drawPath(seg, look.c.accent, style = Stroke(3.5f, cap = StrokeCap.Round))
                    }
                    drawCircle(look.c.tx, 7f, Offset(kx, y(kx)), style = Stroke(2.5f))
                    kaaba(Offset(kx, y(kx) - 30), 34f)
                    val s = Offset(sx, y(sx))
                    drawCircle(Brush.radialGradient(listOf(Color(0xFFFFD98A).copy(alpha = 0.8f), Color(0xFFFFD98A).copy(alpha = 0f)), s, 30f), 30f, s)
                    drawCircle(Color.White, 9f, s)
                    val m = tm.measure(sunWord, TextStyle(fontFamily = Rounded, fontSize = 12f.toSp(), fontWeight = FontWeight.SemiBold, color = look.c.tx2))
                    drawText(m, topLeft = Offset(s.x - m.size.width / 2f, s.y + 34 - m.size.height * 0.8f))
                }
            }
        }
    }
}
