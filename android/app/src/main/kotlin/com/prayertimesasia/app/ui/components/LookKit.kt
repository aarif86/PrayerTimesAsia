package com.prayertimesasia.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.ui.theme.AppIcons
import com.prayertimesasia.app.ui.theme.LocalLook
import com.prayertimesasia.app.ui.theme.Look
import com.prayertimesasia.app.ui.theme.Rounded

/*
 * Small shared pieces for the Qibla and Falak screens in the five looks, read from
 * LocalLook (the web's `.v12s` tokens). Kept here, outside Look.kt, so the Prayer screen
 * work can change Look.kt freely.
 */

/** The web's --green: the colour for "you are facing the qibla". */
val Look.green: Color get() = if (dark) Color(48, 209, 88) else Color(36, 168, 70)

/** The six Colour Bands colours, as on the web Prayer, Qibla and Falak screens. */
val BandColors = listOf(Color(0xFF3A6F63), Color(0xFF8A9A52), Color(0xFFAB8D3A), Color(0xFFCD7D38), Color(0xFFD3705C), Color(0xFFC9565D))

/** The look's card shape (square in Colour Bands). */
val Look.cardShape: Shape get() = RoundedCornerShape(c.radius)

/** A card in the look: the look's fill, a thin stroke and its corner radius (the web's `.q-card`, `.sky-card`, `.group`). */
fun Modifier.lookCard(look: Look): Modifier {
    val shape = look.cardShape
    return this.clip(shape).background(look.c.card, shape).border(1.dp, look.c.stroke, shape)
}

/** The web's line icons (Lucide, ISC licence), drawn the same way. */
object LookIcons {
    private val paths: Map<String, Array<String>> = mapOf(
        "sun" to arrayOf("M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0", "M12 2v2", "M12 20v2", "m4.93 4.93 1.41 1.41", "m17.66 17.66 1.41 1.41", "M2 12h2", "M20 12h2", "m6.34 17.66-1.41 1.41", "m19.07 4.93-1.41 1.41"),
        "compass" to arrayOf("M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0", "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"),
        "map" to arrayOf("M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z", "M15 5.764v15", "M9 3.236v15"),
        "warn" to arrayOf("m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3", "M12 9v4", "M12 17h.01"),
        "check" to arrayOf("M20 6 9 17l-5-5"),
        "footprints" to arrayOf("M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z", "M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z", "M16 17h4", "M4 13h4"),
        "camera" to arrayOf("M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z", "M9 13a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"),
        "moonStar" to arrayOf("M18 5h4", "M20 3v4", "M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"),
        "scanEye" to arrayOf("M3 7V5a2 2 0 0 1 2-2h2", "M17 3h2a2 2 0 0 1 2 2v2", "M21 17v2a2 2 0 0 1-2 2h-2", "M7 21H5a2 2 0 0 1-2-2v-2", "M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0", "M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0"),
        "ruler" to arrayOf("M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z", "m14.5 12.5 2-2", "m11.5 9.5 2-2", "m8.5 6.5 2-2", "m17.5 15.5 2-2"),
        "eye" to arrayOf("M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0", "M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"),
        "calendar" to arrayOf("M8 2v3", "M16 2v3", "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2z", "M3 9h18", "M8 13h.01", "M12 13h.01", "M16 13h.01", "M8 17h.01", "M12 17h.01", "M16 17h.01"),
        "landmark" to arrayOf("M10 18v-7", "M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z", "M14 18v-7", "M18 18v-7", "M3 22h18", "M6 18v-7"),
        "chevron" to arrayOf("m9 18 6-6-6-6"),
    )
    private val cache = HashMap<String, ImageVector>()

    fun get(name: String, width: Float = 2f): ImageVector = cache.getOrPut("$name-$width") {
        AppIcons.line("look-$name", *paths.getValue(name), width = width)
    }
}

/** Text in the look's rounded face. */
fun lookText(size: TextUnit, weight: FontWeight = FontWeight.Normal, lineHeight: Float = 1.25f) =
    androidx.compose.ui.text.TextStyle(fontFamily = Rounded, fontSize = size, fontWeight = weight, lineHeight = size * lineHeight)

/** The big full width button in the look's button colour (the web's `.q-btn`). */
@Composable
fun LookButton(text: String, icon: ImageVector?, modifier: Modifier = Modifier, big: Boolean = false, onClickLabel: String? = null, onClick: () -> Unit) {
    val look = LocalLook.current
    val shape = RoundedCornerShape(look.c.radius + 8.dp)
    Row(
        modifier.fillMaxWidth().heightIn(min = if (big) 60.dp else 54.dp).clip(shape).background(look.c.button, shape)
            .clickable(onClickLabel = onClickLabel, role = Role.Button, onClick = onClick).padding(horizontal = 20.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) Icon(icon, null, Modifier.size(20.dp), tint = look.c.onButton)
        Text(text, style = lookText(if (big) 23.sp else 17.sp, FontWeight.Bold), color = look.c.onButton)
    }
}
