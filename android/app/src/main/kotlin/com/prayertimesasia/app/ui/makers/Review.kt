package com.prayertimesasia.app.ui.makers

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.StarOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.google.android.play.core.review.ReviewManagerFactory
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.BuildConfig
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.today.AppSheet
import com.prayertimesasia.core.Reviews
import kotlinx.coroutines.delay
import java.time.Instant

private fun Context.open(url: String) {
    runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

private fun Context.copy(text: String) {
    (getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager)?.setPrimaryClip(ClipData.newPlainText("Review", text))
}

private tailrec fun Context.activity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.activity()
    else -> null
}

/** "Rate and review": write once, each button copies the words, paste in each place. */
@Composable
fun ReviewContent(state: AppState, openNote: () -> Unit) {
    val context = LocalContext.current
    var words by remember { mutableStateOf(state.prefs.reviewDraft) }
    var copiedFor by remember { mutableStateOf<String?>(null) }
    // Demo `--ez reviewstores true` (screenshots): show the Google Play button before the app is live.
    val links = Reviews.links(Reviews.ON_GOOGLE_PLAY || state.demoShowsStores)
    fun save() { if (state.prefs.reviewDraft != words) state.update { it.copy(reviewDraft = words) } }

    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Dims.gutter), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Rate and review", style = Txt.headline, color = Palette.primary)
        Text("A few honest words help other Muslims find the app, and help Ustaz Aarif and the team keep going. Jazakallahu khairan.",
            style = Txt.subheadline, color = Palette.primary)
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Palette.primary.copy(alpha = 0.06f)).padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Step(1, "Write once", "in the box below, in your own words.")
            Step(2, "Tap a place", "to review. We copy your words for you.")
            Step(3, "Tap and hold", "in their review box, then Paste. Come back and do the same for the next one.")
        }
        OutlinedTextField(words, { words = it; copiedFor = null }, Modifier.fillMaxWidth(), minLines = 4, maxLines = 8,
            placeholder = { Text("What has the app helped you with?") })
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Palette.primary.copy(alpha = 0.06f))) {
            links.forEach { link ->
                Row(
                    Modifier.fillMaxWidth().clickable {
                        val text = words.trim()
                        if (text.isNotEmpty()) { context.copy(text); copiedFor = link.id }
                        save()
                        state.update { it.copy(reviewTappedAt = System.currentTimeMillis()) }
                        state.usageAction("tapReview")
                        context.open(link.url)
                    }.padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(if (link.id == "google") Icons.Outlined.Place else Icons.Outlined.StarOutline, null, Modifier.size(22.dp), tint = Palette.sunArc)
                    Column(Modifier.weight(1f)) {
                        Text(link.title, style = Txt.body, color = Palette.primary)
                        Text(if (copiedFor == link.id) "Copied. Tap and hold in the review box, then Paste." else link.subtitle,
                            style = Txt.footnote, color = Palette.secondary)
                    }
                    Icon(Icons.Filled.ChevronRight, null, Modifier.size(20.dp), tint = Palette.secondary)
                }
            }
        }
        Row(
            Modifier.fillMaxWidth().clip(CircleShape).background(Palette.primary.copy(alpha = 0.08f)).clickable { save(); openNote() }
                .padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Outlined.Email, null, Modifier.size(18.dp), tint = Palette.primary)
            Spacer(Modifier.size(8.dp))
            Text("Something not right? Send a private note", style = Txt.subheadlineSemibold, color = Palette.primary)
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun Step(n: Int, bold: String, rest: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("$n.", style = Txt.subheadline.copy(fontWeight = FontWeight.ExtraBold), color = Palette.sunArc)
        Text(buildAnnotatedString {
            withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(bold) }
            append(" ")
            append(rest)
        }, style = Txt.subheadline, color = Palette.primary)
    }
}

/** "A note to the makers": a private note that opens the person's own email app. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NoteContent(state: AppState) {
    val context = LocalContext.current
    var kind by remember { mutableStateOf(Reviews.NoteKind.KIND) }
    var text by remember { mutableStateOf("") }
    var addDetails by remember { mutableStateOf(true) }
    var mayShare by remember { mutableStateOf(false) }
    var copied by remember { mutableStateOf(false) }
    val details = if (!addDetails) null else buildString {
        append("Version ${BuildConfig.VERSION_NAME}, Android")
        state.resolver.activePlace?.let { p -> append(", ${p.name}"); p.countryCode?.let { append(" ($it)") } }
    }
    val mail = Reviews.noteEmail(kind, text, details, mayShare)

    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Dims.gutter), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("A note to the makers", style = Txt.headline, color = Palette.primary)
        Text("Ustaz Aarif and the Nasar Digital team read every note. Good or bad, it helps us make the app better for everyone.",
            style = Txt.subheadline, color = Palette.primary)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Reviews.NoteKind.entries.forEach { k ->
                val on = k == kind
                Text(k.label, style = Txt.subheadlineSemibold, color = if (on) Color.Black.copy(alpha = 0.85f) else Palette.primary,
                    modifier = Modifier.clip(CircleShape).background(if (on) Palette.sunArc else Palette.primary.copy(alpha = 0.06f))
                        .border(1.dp, if (on) Palette.sunArc else Palette.primary.copy(alpha = 0.15f), CircleShape)
                        .clickable { kind = k }.padding(horizontal = 14.dp, vertical = 8.dp))
            }
        }
        OutlinedTextField(text, { text = it; copied = false }, Modifier.fillMaxWidth(), minLines = 5, maxLines = 10,
            placeholder = { Text(kind.hint) })
        SwitchLine("Add my city and app version", "Helps us check your times. Never your exact location.", addDetails) { addDetails = it }
        if (kind == Reviews.NoteKind.KIND) SwitchLine("You may share my words", "On our website, without your name.", mayShare) { mayShare = it }
        Box(Modifier.fillMaxWidth().clip(CircleShape).background(Palette.sunArc).clickable {
            state.usageAction("tapNote")
            val uri = Reviews.noteUrl(Reviews.about(kind), mail.second)
            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uri)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        }.padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
            Text("Send your note", style = Txt.bodySemibold, color = Color.Black.copy(alpha = 0.85f))
        }
        Box(Modifier.fillMaxWidth().clip(CircleShape).background(Palette.primary.copy(alpha = 0.08f)).clickable {
            context.copy("To ${Reviews.FEEDBACK_EMAIL}\n${mail.first}\n\n${mail.second}"); copied = true
        }.padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
            Text(if (copied) "Copied" else "No email app? Copy the note", style = Txt.subheadlineSemibold, color = Palette.primary)
        }
        Text("It goes to ${Reviews.FEEDBACK_EMAIL}. We reply within a few days, insyaAllah.", style = Txt.footnote, color = Palette.secondary)
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun SwitchLine(label: String, sub: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().clickable { onChange(!checked) }, verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(label, style = Txt.body, color = Palette.primary)
            Text(sub, style = Txt.footnote, color = Palette.secondary)
        }
        Switch(checked, onChange)
    }
}

/**
 * Once ever, after ten separate days of use and never close to a prayer: one quiet line
 * asking for a review. Closing it or using it ends it. Opens its own sheets.
 */
@Composable
fun ReviewLine(state: AppState, now: Instant, current: Instant?, next: Instant?) {
    var sheet by remember { mutableStateOf<String?>(null) }
    val p = state.prefs
    if (!p.noteCardDone && p.reviewTappedAt == 0L && Reviews.isCalm(p.openDayCount, 10, now, current, next)) {
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Palette.primary.copy(alpha = 0.08f))
                .border(1.dp, Palette.primary.copy(alpha = 0.1f), RoundedCornerShape(24.dp))
                .padding(start = 14.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(Icons.Outlined.StarOutline, null, Modifier.size(20.dp), tint = Palette.sunArc)
            Text("Enjoying the app? A short review helps other Muslims find it.", style = Txt.subheadlineSemibold,
                color = Palette.primary, maxLines = 3, modifier = Modifier.weight(1f))
            Text("Review", style = Txt.subheadline.copy(fontWeight = FontWeight.Bold), color = Color.Black.copy(alpha = 0.8f),
                modifier = Modifier.clip(CircleShape).background(Palette.sunArc).clickable {
                    state.update { it.copy(noteCardDone = true) }; sheet = "review"
                }.padding(horizontal = 14.dp, vertical = 8.dp))
            Box(Modifier.size(24.dp).clip(CircleShape).clickable(onClickLabel = "Not now") {
                state.update { it.copy(noteCardDone = true) }
            }, contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.Close, "Not now", Modifier.size(14.dp), tint = Palette.primary.copy(alpha = 0.6f))
            }
        }
    }
    when (sheet) {
        "review" -> AppSheet({ sheet = null }) { ReviewContent(state) { sheet = "note" } }
        "note" -> AppSheet({ sheet = null }) { NoteContent(state) }
    }
}

/** Google Play's own star box, at a calm moment, rarely (see Reviews.mayAskForStars). Play decides if it shows. */
@Composable
fun StarBoxAsker(state: AppState, current: Instant?, next: Instant?) {
    val context = LocalContext.current
    LaunchedEffect(Unit) {
        delay(6_000)
        if (!state.sideEffects) return@LaunchedEffect
        val now = Instant.now()
        if (!Reviews.mayAskForStars(state.prefs, now, current, next)) return@LaunchedEffect
        val activity = context.activity() ?: return@LaunchedEffect
        state.update { it.copy(starBoxAskedAt = now.toEpochMilli()) }
        val manager = ReviewManagerFactory.create(activity)
        manager.requestReviewFlow().addOnCompleteListener { task ->
            if (task.isSuccessful) manager.launchReviewFlow(activity, task.result)
        }
    }
}
