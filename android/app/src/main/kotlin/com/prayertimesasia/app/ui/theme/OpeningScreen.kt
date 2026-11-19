package com.prayertimesasia.app.ui.theme

import androidx.annotation.DrawableRes
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.R
import com.prayertimesasia.core.OpeningClock
import com.prayertimesasia.core.OpeningMove
import com.prayertimesasia.core.OpeningPose

/**
 * Shown over the app for a moment as it opens: the icon's dial on Night Navy, moving for
 * about a second in one of eleven ways ([OpeningMove], all of them once in a shuffled order
 * before any repeats), then it fades. The clock hands always sweep round to the real time. With animations off in the
 * phone's settings the dial stays still. Settings > Opening screen turns it off, but it
 * always shows the first time (MainActivity decides).
 */
@Composable
fun OpeningScreen(move: OpeningMove, reduceMotion: Boolean, onDone: () -> Unit) {
    val clock = remember {
        val c = java.util.Calendar.getInstance()
        OpeningClock.at(c.get(java.util.Calendar.HOUR_OF_DAY), c.get(java.util.Calendar.MINUTE), c.get(java.util.Calendar.SECOND))
    }
    var ms by remember { mutableDoubleStateOf(if (reduceMotion) 10_000.0 else 0.0) }
    val fade = remember { Animatable(1f) }
    LaunchedEffect(Unit) {
        if (reduceMotion) {
            kotlinx.coroutines.delay(900)
        } else {
            val start = withFrameMillis { it }
            while (ms < OpeningPose.LENGTH_MS) {
                withFrameMillis { ms = (it - start).toDouble() }
            }
            fade.animateTo(0f, tween(350))
        }
        onDone()
    }
    val p = OpeningPose.at(move, ms, clock)
    BoxWithConstraints(Modifier.fillMaxSize().graphicsLayer { alpha = fade.value }.background(Brand.nightNavy).clearAndSetSemantics { },
        contentAlignment = Alignment.Center) {
        val height = maxHeight
        Canvas(Modifier.fillMaxSize()) { drawKawung(tile = 36.dp, alpha = 0.05f) }
        Canvas(Modifier.fillMaxSize().graphicsLayer { alpha = p.glowOpacity.toFloat(); translationY = (p.glowY * height.toPx()).toFloat() }) {
            drawRect(Brush.radialGradient(listOf(Color(0x59F7BD8F), Color.Transparent), Offset(center.x, size.height * 1.05f), size.width * 1.1f))
        }
        Box(Modifier.size(180.dp).graphicsLayer {
            scaleX = (p.dialScale * p.dialFlip).toFloat(); scaleY = p.dialScale.toFloat(); rotationZ = p.dialRot.toFloat()
            alpha = p.dialOpacity.toFloat(); translationY = (p.dialY * 180.dp.toPx()).toFloat()
        }) {
            Box(Modifier.fillMaxSize().graphicsLayer {
                rotationZ = p.ringRot.toFloat(); scaleX = p.ringScale.toFloat(); scaleY = p.ringScale.toFloat(); alpha = p.ringOpacity.toFloat()
            }) {
                Layer(R.drawable.opening_ring)
                Layer(R.drawable.opening_batik, rotation = p.batikRot, alpha = p.batikOpacity)
                Layer(R.drawable.opening_stitch_outer, rotation = p.stitchOuterRot, alpha = p.stitchOpacity)
                Layer(R.drawable.opening_stitch_inner, rotation = p.stitchInnerRot, alpha = p.stitchOpacity)
                Layer(R.drawable.opening_marks, alpha = p.marksOpacity)
            }
            Layer(R.drawable.opening_face, scale = p.centreScale, alpha = p.centreOpacity * p.faceOpacity)
            Layer(R.drawable.opening_kaabah, scale = p.kaabahScale, alpha = p.kaabahOpacity)
            Box(Modifier.fillMaxSize().graphicsLayer {
                scaleX = p.centreScale.toFloat(); scaleY = p.centreScale.toFloat(); alpha = (p.centreOpacity * p.handsOpacity).toFloat()
            }) {
                Layer(R.drawable.opening_hour, rotation = p.hourRot)
                Layer(R.drawable.opening_minute, rotation = p.minuteRot)
                Layer(R.drawable.opening_hub)
            }
        }
        Text("Prayer Times Asia", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.offset(y = 132.dp + 8.dp * (1 - p.nameIn.toFloat())).graphicsLayer { alpha = p.nameIn.toFloat() })
        Text("Built fisabilillah in Singapore", color = Brand.moonText.copy(alpha = 0.78f), fontSize = 14.sp,
            modifier = Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 40.dp)
                .graphicsLayer { alpha = p.lineIn.toFloat(); translationY = (8 * (1 - p.lineIn)).toFloat() * density })
    }
}

@Composable
private fun Layer(@DrawableRes id: Int, rotation: Double = 0.0, scale: Double = 1.0, alpha: Double = 1.0) {
    Image(painterResource(id), null, Modifier.fillMaxSize().graphicsLayer {
        rotationZ = rotation.toFloat(); scaleX = scale.toFloat(); scaleY = scale.toFloat(); this.alpha = alpha.toFloat()
    })
}
