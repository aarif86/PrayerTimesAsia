package com.prayertimesasia.app.ui.makers

import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.data.UsageCounter
import com.prayertimesasia.core.CommunityCard
import com.prayertimesasia.core.HadithId
import com.prayertimesasia.app.ui.components.HadithView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.CallMade
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.display

/**
 * The app is free and built fisabilillah in Singapore by Ustaz Aarif Raziff and Nasar Digital (Nasar Pte Ltd).
 * The cards are our own services and, from time to time, a hand picked halal
 * sponsor for the user's country ([CommunityCard], data/community-cards.json).
 * No outside ads, nothing tracked: each card just opens the website.
 */

/** The name of the card space. One place to change it (Makers.tsx and Makers.swift have the same). */
const val PICKS_NAME = "Barakah Picks"

/** A slim card that opens the card's website. */
@Composable
fun MakersCard(card: CommunityCard, placement: String, compact: Boolean = false, modifier: Modifier = Modifier, state: AppState? = null) {
    val uri = LocalUriHandler.current
    // Counted as seen once it is drawn on screen (once a day, see UsageCounter).
    LaunchedEffect(card.id, placement) { state?.countCard(UsageCounter.CardEvent.SEEN, card, placement) }
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Palette.material, shape)
            .border(1.dp, Palette.primary.copy(alpha = 0.08f), shape)
            .clickable {
                state?.countCard(UsageCounter.CardEvent.TAPPED, card, placement)
                runCatching { uri.openUri(card.url(placement)) }
            }
            .semantics { contentDescription = "$PICKS_NAME${if (card.isSponsor) ", sponsored" else ""}. ${card.title}, opens ${card.site}" }
            .padding(horizontal = 12.dp, vertical = if (compact) 6.dp else 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        val box = if (compact) 28.dp else 34.dp
        Box(
            Modifier.size(box).clip(RoundedCornerShape(10.dp)).background(Palette.accent.copy(alpha = 0.18f)),
            contentAlignment = Alignment.Center,
        ) {
            when (card.icon) {
                CommunityCard.Icon.KAABA -> KaabaGlyph(Modifier.size(if (compact) 15.dp else 18.dp))
                CommunityCard.Icon.GLOBE -> Icon(Icons.Filled.Language, null, Modifier.size(18.dp), tint = Palette.accent)
                CommunityCard.Icon.SHOP -> Icon(Icons.Filled.Storefront, null, Modifier.size(18.dp), tint = Palette.accent)
                CommunityCard.Icon.HEART -> Icon(Icons.Filled.FavoriteBorder, null, Modifier.size(18.dp), tint = Palette.accent)
            }
        }
        Column(Modifier.weight(1f)) {
            Text((if (card.isSponsor) "$PICKS_NAME · Sponsored" else PICKS_NAME).uppercase(),
                fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp, color = Palette.secondary)
            Text(card.title, style = Txt.subheadlineSemibold, color = Palette.primary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (!compact) {
                Text(card.subtitle, style = Txt.caption, color = Palette.secondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
        Text(card.site, style = Txt.captionSemibold, color = Palette.accentText)
        Icon(Icons.Filled.CallMade, null, Modifier.size(13.dp), tint = Palette.accent)
    }
}

/** "About" behind the (i) on the Masjid tab: who built the app, and their services. */
@Composable
fun MakersSheetContent(placement: String, state: AppState? = null) {
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Dims.gutter), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        state?.let { HadithView(it, HadithId.FIXED_TIMES, tag = "Al Quran") }
        Text("Built fisabilillah", style = display(26.sp, FontWeight.Bold), color = Palette.primary)
        Text("Prayer Times Asia is free, with no outside ads and nothing tracked. It is built and looked after by Ustaz Aarif Raziff and the team at Nasar Digital (Nasar Pte Ltd).",
            style = Txt.body, color = Palette.secondary)
        CommunityCard.ours(state?.offerCountry ?: "").forEach { MakersCard(it, placement, state = state) }
        Spacer(Modifier.width(1.dp))
    }
}

/** A simple cube with the gold band, drawn so it scales crisply. */
@Composable
fun KaabaGlyph(modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val w = size.width
        val r = CornerRadius(w * 0.12f, w * 0.12f)
        drawRoundRect(Color(0.08f, 0.08f, 0.1f), cornerRadius = r)
        drawRect(Color(0.95f, 0.78f, 0.4f), topLeft = Offset(0f, w / 2 - w * 0.18f - w * 0.06f), size = Size(w, w * 0.12f))
        drawRoundRect(Color.White.copy(alpha = 0.85f), cornerRadius = r, style = Stroke(1.5.dp.toPx()),
            topLeft = Offset(0.75.dp.toPx(), 0.75.dp.toPx()), size = Size(w - 1.5.dp.toPx(), size.height - 1.5.dp.toPx()))
    }
}
