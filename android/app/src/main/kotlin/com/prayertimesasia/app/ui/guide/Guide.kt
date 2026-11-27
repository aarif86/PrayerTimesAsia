package com.prayertimesasia.app.ui.guide

import android.annotation.SuppressLint
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.RadioButtonChecked
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.TouchApp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.ui.theme.AppIcons
import com.prayertimesasia.app.ui.theme.Rounded
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.core.GuideStep
import com.prayertimesasia.core.GuideWords
import com.prayertimesasia.core.RamadanContent
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val Navy = Color(0xFF151A45)
private val Gold = Color(0xFFF7BD8F)
private val Ring = Color(0xFF262B5E)

/** The icon on each feature's tab along the bottom. */
private fun featureIcon(id: String): ImageVector = when (id) {
    "prayer" -> AppIcons.prayer
    "buttons" -> Icons.Filled.RadioButtonChecked
    "looks" -> Icons.Filled.Palette
    "alerts" -> Icons.Filled.NotificationsActive
    "qibla" -> AppIcons.qibla
    "masjid" -> AppIcons.masjid
    "travel" -> AppIcons.journey
    "falak" -> AppIcons.falak
    "print" -> Icons.Filled.Print
    else -> Icons.Filled.Settings
}

/**
 * The quick guide: swipe cards a new user sees once, right after choosing their
 * place. Each card is a small phone playing the real app, with a finger that taps
 * the exact button. Skip at any time; Settings > Help opens it again. Same cards,
 * steps and words as the web and iPhone (data/guide-words.json).
 */
@Composable
fun GuideDialog(state: AppState, onClose: () -> Unit) {
    val finish = {
        state.update { it.copy(guideShown = true) }
        onClose()
    }
    Dialog(onDismissRequest = finish, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        GuideContent(state, finish)
    }
}

@Composable
private fun GuideContent(state: AppState, finish: () -> Unit) {
    var lang by remember { mutableStateOf(state.resolver.appLang) }
    val cards = GuideWords.cards
    val pager = rememberPagerState { cards.size }
    val scope = rememberCoroutineScope()
    val page = pager.currentPage
    val last = page == cards.size - 1
    fun t(key: String, args: Map<String, String> = emptyMap()) = GuideWords.word(lang, key, args)
    val go: (Int) -> Unit = { n -> scope.launch { pager.animateScrollToPage(n.coerceIn(0, cards.size - 1)) } }

    Box(
        Modifier.fillMaxSize().background(
            Brush.radialGradient(listOf(Color(0xFF3A3480), Navy, Color(0xFF0B0F2A)), center = Offset(540f, 0f), radius = 2200f),
        ).semantics { contentDescription = t("label") },
    ) {
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(vertical = 12.dp)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp).heightIn(min = 44.dp), verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.clip(CircleShape).background(Color.White.copy(alpha = 0.1f)).padding(3.dp)) {
                    listOf(RamadanContent.Lang.EN to "EN", RamadanContent.Lang.MS to "BM", RamadanContent.Lang.ID to "ID").forEach { (l, label) ->
                        val on = l == lang
                        Text(label, fontFamily = Rounded, fontWeight = FontWeight.Bold, fontSize = 13.sp,
                            color = if (on) Navy else Color.White.copy(alpha = 0.7f),
                            modifier = Modifier.clip(CircleShape).background(if (on) Color.White.copy(alpha = 0.92f) else Color.Transparent)
                                .clickable { lang = l }.padding(horizontal = 11.dp, vertical = 6.dp))
                    }
                }
                Spacer(Modifier.weight(1f))
                if (!last) {
                    Text(t("skip"), fontFamily = Rounded, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = Color.White.copy(alpha = 0.8f),
                        modifier = Modifier.clip(CircleShape).clickable(onClick = finish).padding(horizontal = 12.dp, vertical = 8.dp))
                }
            }

            HorizontalPager(pager, Modifier.weight(1f).fillMaxWidth(), beyondViewportPageCount = 0) { n ->
                GuideCard(cards[n], lang, first = n == 0, on = n == page)
            }

            Features(cards, page, lang, go)
            Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(t("back"), fontFamily = Rounded, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = Color.White.copy(alpha = 0.75f),
                    modifier = Modifier.alpha(if (page == 0) 0f else 1f).clip(CircleShape)
                        .clickable(enabled = page > 0) { go(page - 1) }.padding(12.dp))
                Spacer(Modifier.weight(1f))
                Box(Modifier.widthIn(min = 112.dp).clip(CircleShape).background(Color.White)
                    .clickable { if (last) finish() else go(page + 1) }
                    .padding(horizontal = 26.dp, vertical = 14.dp), contentAlignment = Alignment.Center) {
                    Text(if (last) t("start") else t("next"), fontFamily = Rounded, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Navy)
                }
            }
        }
    }
}

/** One named tab per feature along the bottom, so people see what they are learning and can jump to any of it. */
@Composable
private fun Features(cards: List<String>, page: Int, lang: RamadanContent.Lang, go: (Int) -> Unit) {
    val scroll = rememberScrollState()
    val density = LocalDensity.current
    // Keep the lit tab in view, roughly centred.
    LaunchedEffect(page) {
        val approx = with(density) { 92.dp.toPx() }
        scroll.animateScrollTo((page * approx - approx).toInt().coerceIn(0, scroll.maxValue))
    }
    Row(
        Modifier.fillMaxWidth().horizontalScroll(scroll).padding(horizontal = 20.dp)
            .semantics { contentDescription = GuideWords.word(lang, "of", mapOf("n" to "${page + 1}", "t" to "${cards.size}")) },
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        cards.forEachIndexed { n, id ->
            val on = n == page
            Row(
                Modifier.clip(CircleShape).background(if (on) Gold else Color.White.copy(alpha = 0.07f))
                    .border(1.dp, if (on) Gold else Color.White.copy(alpha = 0.1f), CircleShape)
                    .clickable { go(n) }.padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                val tint = when { on -> Navy; n < page -> Color.White.copy(alpha = 0.85f); else -> Color.White.copy(alpha = 0.62f) }
                Icon(featureIcon(id), null, tint = tint, modifier = Modifier.size(16.dp))
                Text(GuideWords.word(lang, "${id}_tab"), fontFamily = Rounded, fontWeight = FontWeight.Bold, fontSize = 13.5.sp, color = tint)
            }
        }
    }
}

@Composable
private fun GuideCard(id: String, lang: RamadanContent.Lang, first: Boolean, on: Boolean) {
    val shown by animateFloatAsState(if (on) 1f else 0.4f, tween(500), label = "card")
    Column(
        Modifier.fillMaxSize().padding(horizontal = 28.dp).padding(top = 12.dp).graphicsLayer {
            alpha = shown
            translationY = (1f - shown) * 20f
        },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (first) {
            Text(GuideWords.word(lang, "hello"), fontFamily = Rounded, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Gold,
                textAlign = TextAlign.Center)
        }
        Text(GuideWords.word(lang, "${id}_title"), style = display(28.sp, FontWeight.ExtraBold), color = Color.White, textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = if (first) 4.dp else 8.dp, bottom = 12.dp))
        PhoneDemo(id, lang, on, Modifier.weight(1f))
    }
}

/**
 * A small phone playing the real app: a gold box lights the button, a finger
 * glides to it and taps, and the next screen shows what the tap does. It plays
 * by itself; tapping the phone or a step number moves on.
 */
@SuppressLint("DiscouragedApi")
@Composable
private fun PhoneDemo(id: String, lang: RamadanContent.Lang, on: Boolean, modifier: Modifier) {
    val steps = remember(id) { GuideWords.steps(id) }
    var k by remember { mutableIntStateOf(0) }
    var press by remember { mutableStateOf(false) }
    val s = steps[k]
    val context = LocalContext.current
    val pictures = remember(id) {
        steps.map { context.resources.getIdentifier("guide_step_${it.shot.lowercase()}", "drawable", context.packageName) }
    }

    LaunchedEffect(on) { if (!on) { k = 0; press = false } }
    LaunchedEffect(on, k) {
        if (!on) return@LaunchedEffect
        press = false
        if (s.tap) {
            delay(1250); press = true
            delay(1050)
        } else delay(2700)
        k = (k + 1) % steps.size
    }

    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        BoxWithConstraints(Modifier.weight(1f, fill = false).heightIn(max = 470.dp)) {
            val phoneH: Dp = minOf(maxHeight, maxWidth * (852f / 393f))
            val phoneW: Dp = phoneH * (393f / 852f)
            Box(
                Modifier.size(phoneW, phoneH).border(5.dp, Ring, RoundedCornerShape(26.dp)).padding(5.dp)
                    .clip(RoundedCornerShape(22.dp)).background(Color(0xFF0B0F2A))
                    .clickable(enabled = on) { k = (k + 1) % steps.size },
            ) {
                steps.forEachIndexed { n, st ->
                    val a by animateFloatAsState(if (n == k) 1f else 0f, tween(450), label = "shot")
                    if (a > 0f && pictures[n] != 0) {
                        Image(painterResource(pictures[n]), null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize().alpha(a))
                    }
                }
                Pointer(s, press, on, phoneW - 10.dp, phoneH - 10.dp)
            }
        }
        Text(GuideWords.word(lang, s.say), fontFamily = Rounded, fontWeight = FontWeight.Bold, fontSize = 18.sp, lineHeight = 24.sp,
            color = Color.White, textAlign = TextAlign.Center, minLines = 2,
            modifier = Modifier.padding(top = 16.dp).widthIn(max = 340.dp))
        Row(Modifier.padding(top = 8.dp, bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            steps.indices.forEach { n ->
                val lit = n == k
                Box(
                    Modifier.size(26.dp).clip(CircleShape).background(if (lit) Gold else Color.Transparent)
                        .border(1.5.dp, if (lit) Gold else if (n < k) Gold.copy(alpha = 0.7f) else Color.White.copy(alpha = 0.3f), CircleShape)
                        .clickable(enabled = on) { k = n }
                        .semantics { contentDescription = GuideWords.word(lang, "step", mapOf("n" to "${n + 1}", "t" to "${steps.size}")) },
                    contentAlignment = Alignment.Center,
                ) {
                    Text("${n + 1}", fontFamily = Rounded, fontWeight = FontWeight.ExtraBold, fontSize = 12.5.sp,
                        color = if (lit) Navy else if (n < k) Gold else Color.White.copy(alpha = 0.7f))
                }
            }
        }
    }
}

/** The gold box on the button, the tap ripple, and the finger resting just under it. */
@Composable
private fun Pointer(s: GuideStep, press: Boolean, on: Boolean, w: Dp, h: Dp) {
    val x = remember { Animatable(s.x) }
    val y = remember { Animatable(s.y) }
    val bw = remember { Animatable(s.w) }
    val bh = remember { Animatable(s.h) }
    LaunchedEffect(s) {
        val spec = tween<Float>(650, easing = FastOutSlowInEasing)
        launch { x.animateTo(s.x, spec) }; launch { y.animateTo(s.y, spec) }
        launch { bw.animateTo(s.w, spec) }; launch { bh.animateTo(s.h, spec) }
    }
    val glow by rememberInfiniteTransition(label = "glow").animateFloat(0.55f, 1f,
        infiniteRepeatable(tween(700, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "glow")
    val ripple = remember { Animatable(0f) }
    LaunchedEffect(press) { if (press) { ripple.snapTo(0f); ripple.animateTo(1f, tween(700)) } else ripple.snapTo(0f) }
    val squeeze by animateFloatAsState(if (press) 0.82f else 1f, tween(180), label = "press")

    // Spot
    Box(
        Modifier.offset(w * x.value - 4.dp, h * y.value - 4.dp).size(w * bw.value + 8.dp, h * bh.value + 8.dp)
            .border(2.5.dp, Gold.copy(alpha = if (on) glow else 1f), RoundedCornerShape(12.dp)),
        contentAlignment = Alignment.Center,
    ) {
        if (ripple.value in 0.01f..0.99f) {
            Box(Modifier.size(44.dp).scale(0.3f + ripple.value * 1.2f).alpha(1f - ripple.value).border(3.dp, Color.White, CircleShape))
        }
    }
    // The fingertip rests just under the box so the button stays in sight; on the tab bar it rests on the button.
    val low = y.value + bh.value > 0.9f
    val tipX = w * (x.value + bw.value / 2)
    val tipY = if (low) h * (y.value + bh.value / 2) else h * (y.value + bh.value) + 4.dp
    Icon(
        Icons.Filled.TouchApp, null, tint = Color.White,
        modifier = Modifier.offset(tipX - 15.dp, tipY - 3.dp).size(34.dp).scale(squeeze)
            .graphicsLayer { shadowElevation = 6f },
    )
}
