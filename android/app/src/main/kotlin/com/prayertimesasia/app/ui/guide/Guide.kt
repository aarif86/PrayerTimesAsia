package com.prayertimesasia.app.ui.guide

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Contrast
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Flight
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Settings
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.R
import com.prayertimesasia.app.ui.theme.AppIcons
import com.prayertimesasia.app.ui.theme.Rounded
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.core.GuideWords
import com.prayertimesasia.core.RamadanContent
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale

private val Navy = Color(0xFF151A45)
private val Gold = Color(0xFFF7BD8F)
private val Sun = Color(0xFFE2B65A)
private val Ring = Color(0xFF262B5E)
private val Cream = Color(0xFFF2EEE9)

/**
 * The quick guide: nine swipe cards a new user sees once, right after choosing
 * their place. Skip at any time; Settings > Help opens it again. Same cards and
 * words as the web and iPhone (data/guide-words.json).
 */
@Composable
fun GuideDialog(state: AppState, onClose: () -> Unit) {
    val finish = {
        state.update { it.copy(guideSeen = true) }
        onClose()
    }
    Dialog(onDismissRequest = finish, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        GuideContent(state, finish)
    }
}

@Composable
private fun GuideContent(state: AppState, finish: () -> Unit) {
    var lang by remember { mutableStateOf(GuideWords.startLanguage(state.resolver.naming, Locale.getDefault().language)) }
    val cards = GuideWords.cards
    val pager = rememberPagerState { cards.size }
    val scope = rememberCoroutineScope()
    val page = pager.currentPage
    val last = page == cards.size - 1
    fun t(key: String, args: Map<String, String> = emptyMap()) = GuideWords.word(lang, key, args)

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

            HorizontalPager(pager, Modifier.weight(1f).fillMaxWidth()) { n ->
                GuideCard(cards[n], lang, first = n == 0, on = n == page)
            }

            Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp), horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp),
                    modifier = Modifier.semantics { contentDescription = t("of", mapOf("n" to "${page + 1}", "t" to "${cards.size}")) }) {
                    cards.indices.forEach { n ->
                        val w by animateDpAsState(if (n == page) 22.dp else 7.dp, label = "dot")
                        Box(Modifier.size(w, 7.dp).clip(CircleShape).background(if (n == page) Gold else Color.White.copy(alpha = 0.3f)))
                    }
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(t("back"), fontFamily = Rounded, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = Color.White.copy(alpha = 0.75f),
                        modifier = Modifier.alpha(if (page == 0) 0f else 1f).clip(CircleShape)
                            .clickable(enabled = page > 0) { scope.launch { pager.animateScrollToPage(page - 1) } }.padding(12.dp))
                    Spacer(Modifier.weight(1f))
                    Box(Modifier.widthIn(min = 112.dp).clip(CircleShape).background(Color.White)
                        .clickable { if (last) finish() else scope.launch { pager.animateScrollToPage(page + 1) } }
                        .padding(horizontal = 26.dp, vertical = 14.dp), contentAlignment = Alignment.Center) {
                        Text(if (last) t("start") else t("next"), fontFamily = Rounded, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Navy)
                    }
                }
            }
        }
    }
}

@Composable
private fun GuideCard(id: String, lang: RamadanContent.Lang, first: Boolean, on: Boolean) {
    val shown by animateFloatAsState(if (on) 1f else 0.4f, tween(500), label = "card")
    Column(
        Modifier.fillMaxSize().padding(horizontal = 32.dp).padding(top = 24.dp).graphicsLayer {
            alpha = shown
            translationY = (1f - shown) * 20f
        },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (id == "buttons") ButtonsScene(lang, on) else Scene(id, on)
        if (first) {
            Text(GuideWords.word(lang, "hello"), fontFamily = Rounded, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Gold,
                textAlign = TextAlign.Center, modifier = Modifier.padding(top = 18.dp))
        }
        Text(GuideWords.word(lang, "${id}_title"), style = display(30.sp, FontWeight.ExtraBold), color = Color.White, textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = if (first) 6.dp else 16.dp, bottom = 10.dp))
        Text(GuideWords.word(lang, "${id}_body"), fontSize = 17.sp, lineHeight = 25.sp, color = Color(0xFFEEF0FA).copy(alpha = 0.88f),
            textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 380.dp))
        Text(GuideWords.word(lang, "find"), fontFamily = Rounded, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Gold,
            modifier = Modifier.padding(top = 22.dp))
        MiniTabs(when (id) { "qibla" -> 1; "falak" -> 2; "masjid" -> 3; "yours" -> 4; else -> 0 }, on)
        if (id == "yours") {
            Text(GuideWords.word(lang, "again"), fontSize = 14.sp, color = Color(0xFFEEF0FA).copy(alpha = 0.65f), textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 14.dp))
        }
    }
}

/** The five tabs with their names, one lit and pointed at, so people learn where each part lives. */
@Composable
private fun MiniTabs(lit: Int, on: Boolean) {
    val icons: List<Pair<ImageVector, String>> = listOf(AppIcons.prayer to "Prayer", AppIcons.qibla to "Qibla", AppIcons.falak to "Falak",
        AppIcons.masjid to "Masjid", Icons.Filled.Settings to "Settings")
    val bob by rememberInfiniteTransition(label = "pointer").animateFloat(0f, 4f,
        infiniteRepeatable(tween(600, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "bob")
    Row(Modifier.padding(top = 18.dp).clip(RoundedCornerShape(20.dp)).background(Color.White.copy(alpha = 0.08f)).padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        icons.forEachIndexed { n, (icon, name) ->
            val tint = if (n == lit) Navy else Color.White.copy(alpha = 0.45f)
            Box {
                Column(Modifier.size(56.dp, 46.dp).clip(RoundedCornerShape(14.dp)).background(if (n == lit) Gold else Color.Transparent),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Icon(icon, null, Modifier.size(20.dp), tint = tint)
                    Text(name, fontFamily = Rounded, fontWeight = FontWeight.SemiBold, fontSize = 10.sp, color = tint, maxLines = 1)
                }
                if (n == lit) {
                    Icon(Icons.Filled.ArrowDropDown, null, Modifier.align(Alignment.TopCenter).offset(y = (-22 + if (on) bob else 0f).dp).size(24.dp), tint = Gold)
                }
            }
        }
    }
}

/** The round buttons from the top of the Prayer screen, each with what it does. */
@Composable
private fun ButtonsScene(lang: RamadanContent.Lang, on: Boolean) {
    val rows: List<Pair<ImageVector, String>> = listOf(
        Icons.Filled.Palette to "btn_look", Icons.Filled.Contrast to "btn_light", Icons.Filled.Alarm to "btn_alarm",
        Icons.Filled.LocalFireDepartment to "btn_streak", AppIcons.journey to "btn_travel",
    )
    Column(Modifier.clip(RoundedCornerShape(24.dp)).background(Color.White.copy(alpha = 0.07f)).padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        rows.forEachIndexed { n, (icon, key) ->
            val shown by animateFloatAsState(if (on) 1f else 0f, tween(450, delayMillis = 100 + n * 80), label = "row")
            Row(Modifier.graphicsLayer { alpha = shown; translationX = (1f - shown) * -24f }, verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(38.dp).clip(CircleShape).background(Color(0xFFE9ECF6)), contentAlignment = Alignment.Center) {
                    Icon(icon, null, Modifier.size(18.dp), tint = Navy)
                }
                Text(GuideWords.word(lang, key), fontFamily = Rounded, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Color(0xFFEEF0FA))
            }
        }
    }
}

/** The picture at the top of each card: the navy compass ring with a gentle movement. */
@Composable
private fun Scene(id: String, on: Boolean) {
    if (id == "looks") { LooksScene(on); return }
    val loop = rememberInfiniteTransition(label = "scene")
    val spin by loop.animateFloat(0f, 360f, infiniteRepeatable(tween(9000, easing = LinearEasing)), label = "spin")
    val swing by loop.animateFloat(-1f, 1f, infiniteRepeatable(tween(2500, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "swing")
    var arrived by remember { mutableStateOf(false) }
    LaunchedEffect(on) { arrived = on }
    val settle by animateFloatAsState(if (arrived) 0f else -70f, spring(dampingRatio = 0.4f, stiffness = 40f), label = "settle")

    Box(Modifier.size(176.dp), contentAlignment = Alignment.Center) {
        Box(Modifier.size(176.dp).clip(CircleShape).background(Brush.radialGradient(listOf(Ring, Color(0xFF1C2050))))
            .border(7.dp, Cream.copy(alpha = 0.16f), CircleShape))
        Canvas(Modifier.size(150.dp)) {
            drawCircle(Cream.copy(alpha = 0.22f), style = Stroke(1.5.dp.toPx(), pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(10f, 10f))))
        }
        when (id) {
            "prayer" -> {
                Box(Modifier.size(176.dp).rotate(if (on) spin else 0f)) {
                    Box(Modifier.align(Alignment.TopCenter).padding(top = 6.dp).size(16.dp).clip(CircleShape).background(Sun))
                }
                Icon(AppIcons.prayer, null, Modifier.size(78.dp), tint = Color.White)
            }
            "alerts" -> {
                Icon(Icons.Filled.NotificationsActive, null, Modifier.size(68.dp).rotate(if (on) swing * 10f else 0f), tint = Color.White)
                Badge(Icons.Filled.Alarm)
            }
            "qibla" -> {
                Box(Modifier.size(132.dp).alpha(if (on && arrived) 0.6f + 0.4f * swing else 0.2f).border(3.dp, Sun, CircleShape))
                Icon(AppIcons.qibla, null, Modifier.size(92.dp).rotate(settle), tint = Color.White)
            }
            "masjid" -> {
                Icon(AppIcons.masjid, null, Modifier.size(84.dp), tint = Color.White)
                AnimatedVisibility(arrived, enter = fadeIn(tween(500, 300)), exit = fadeOut(), modifier = Modifier.offset(x = 40.dp, y = (-54).dp)) {
                    Icon(Icons.Filled.Place, null, Modifier.size(30.dp), tint = Color(0xFFE0634F))
                }
            }
            "travel" -> {
                Icon(Icons.Filled.Flight, null, Modifier.size(28.dp).offset(x = (60 * swing).dp, y = (-52).dp).rotate(90f), tint = Gold)
                Icon(AppIcons.journey, null, Modifier.size(70.dp).offset(y = (22 + 4 * swing).dp), tint = Color.White)
            }
            "falak" -> FalakScene(if (on) swing else -1f)
            else -> {
                Icon(Icons.Filled.Settings, null, Modifier.size(80.dp).rotate(if (on) spin else 0f), tint = Color.White)
                Badge(Icons.Filled.CalendarMonth)
            }
        }
    }
}

@Composable
private fun Badge(icon: ImageVector) {
    Box(Modifier.offset(x = 55.dp, y = 53.dp).size(50.dp).clip(CircleShape).background(Gold), contentAlignment = Alignment.Center) {
        Icon(icon, null, Modifier.size(24.dp), tint = Navy)
    }
}

/** The sun crosses the sky (t from -1 morning to 1 afternoon) and the stick's shadow swings round under it. */
@Composable
private fun FalakScene(t: Float) {
    Canvas(Modifier.size(120.dp)) {
        val u = size.width / 120f
        val foot = Offset(60 * u, 92 * u)
        drawLine(Color.White.copy(alpha = 0.4f), Offset(12 * u, 92 * u), Offset(108 * u, 92 * u), 2 * u, StrokeCap.Round)
        drawLine(Gold.copy(alpha = 0.6f), foot, Offset(foot.x - 44 * u * t, foot.y), 5 * u, StrokeCap.Round)
        drawLine(Color.White, foot, Offset(60 * u, 62 * u), 4 * u, StrokeCap.Round)
        val a = Math.toRadians((62.0 * t))
        val sun = Offset(foot.x + (70 * u * Math.sin(a)).toFloat(), foot.y - (70 * u * Math.cos(a)).toFloat())
        drawCircle(Sun, 8 * u, sun)
    }
}

/** Real screenshots of the six Prayer screen looks, one after another. */
@Composable
private fun LooksScene(on: Boolean) {
    val looks = remember {
        listOf(R.drawable.guide_look_centre, R.drawable.guide_look_list, R.drawable.guide_look_dial,
            R.drawable.guide_look_sunpath, R.drawable.guide_look_bands, R.drawable.guide_look_simple)
    }
    var index by remember { mutableIntStateOf(0) }
    LaunchedEffect(on) {
        while (on) {
            delay(1600)
            index = (index + 1) % looks.size
        }
    }
    Box(Modifier.size(176.dp, 250.dp), contentAlignment = Alignment.Center) {
        Crossfade(index, animationSpec = tween(600), label = "look",
            modifier = Modifier.size(112.dp, 236.dp).clip(RoundedCornerShape(20.dp)).border(4.dp, Ring, RoundedCornerShape(20.dp))) { n ->
            Image(painterResource(looks[n]), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        }
        Box(Modifier.align(Alignment.BottomEnd).size(50.dp).clip(CircleShape).background(Gold), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Palette, null, Modifier.size(24.dp), tint = Navy)
        }
    }
}
