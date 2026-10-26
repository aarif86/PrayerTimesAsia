package com.prayertimesasia.app.ui.makers

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
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
 * The app is free and built fisabilillah by Nasar Pte Ltd. The only promotion
 * in it is for the makers' own services - no ad networks, nothing tracked: each
 * card just opens the website, which has the WhatsApp contact.
 */
enum class MakersOffer {
    BADAL, DIGITAL;

    val title: String get() = if (this == BADAL) "Badal Haji & Umrah" else "NasarDigital"
    val subtitle: String
        get() = if (this == BADAL) "Performed in Makkah for loved ones who have passed on or cannot go"
        else "Digital marketing from the team behind this app"
    val site: String get() = if (this == BADAL) "Badal.sg" else "nasardigital.com"

    /** The website, tagged with where in the app it was tapped so visits show in the site's own analytics. The app records nothing. */
    fun url(placement: String): String {
        val base = if (this == BADAL) "https://badal.sg" else "https://nasardigital.com"
        return "$base/?utm_source=prayertimesasia&utm_medium=app&utm_campaign=$placement"
    }

    companion object {
        /** Badal is offered to Singaporeans for now (Badal.my is coming); everyone else sees NasarDigital. */
        fun featured(country: String): MakersOffer = if (country == "SG") BADAL else DIGITAL
    }
}

/** A slim card that opens the offer's website. */
@Composable
fun MakersCard(offer: MakersOffer, placement: String, compact: Boolean = false, modifier: Modifier = Modifier) {
    val uri = LocalUriHandler.current
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Palette.material, shape)
            .border(1.dp, Palette.primary.copy(alpha = 0.08f), shape)
            .clickable { runCatching { uri.openUri(offer.url(placement)) } }
            .semantics { contentDescription = "${offer.title}, opens ${offer.site}" }
            .padding(horizontal = 12.dp, vertical = if (compact) 6.dp else 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        val box = if (compact) 28.dp else 34.dp
        Box(
            Modifier.size(box).clip(RoundedCornerShape(10.dp)).background(Palette.accent.copy(alpha = 0.18f)),
            contentAlignment = Alignment.Center,
        ) {
            when (offer) {
                MakersOffer.BADAL -> KaabaGlyph(Modifier.size(if (compact) 15.dp else 18.dp))
                MakersOffer.DIGITAL -> Icon(Icons.Filled.Language, null, Modifier.size(18.dp), tint = Palette.accent)
            }
        }
        Column(Modifier.weight(1f)) {
            Text(offer.title, style = Txt.subheadlineSemibold, color = Palette.primary, maxLines = 1)
            if (!compact) {
                Text(offer.subtitle, style = Txt.caption, color = Palette.secondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
        Text(offer.site, style = Txt.captionSemibold, color = Palette.accent)
        Icon(Icons.Filled.CallMade, null, Modifier.size(13.dp), tint = Palette.accent)
    }
}

/** "About" behind the (i) on the Masjid tab: who built the app, and their services. */
@Composable
fun MakersSheetContent(placement: String) {
    Column(Modifier.fillMaxWidth().padding(Dims.gutter), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Built fisabilillah", style = display(26.sp, FontWeight.Bold), color = Palette.primary)
        Text("Prayer Times Asia is free, with no ad networks and nothing tracked. It is built and looked after by the team at Nasar Pte Ltd.",
            style = Txt.body, color = Palette.secondary)
        MakersOffer.entries.forEach { MakersCard(it, placement) }
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
