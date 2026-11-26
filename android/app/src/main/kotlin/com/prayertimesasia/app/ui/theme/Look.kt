package com.prayertimesasia.app.ui.theme

import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.prayertimesasia.core.TodayStyle

/**
 * The five looks, as on the web app (web/src/ui/screens.css, the `.v12`, `.v12s` and
 * per look blocks). One set of colours per look and per light or dark, read by every
 * screen, so Prayer, Qibla, Falak, Masjid and Settings all match the web exactly.
 *
 * Names follow the web's CSS variables: tx = --s-tx (words), tx2, tx3, card = --s-card,
 * stroke = --s-strk, sep = --s-sep (hairlines), accent = --s-ac (shapes),
 * accentText = --s-actx (words in the accent), button = --s-btn, onButton = --s-ong,
 * tint = --s-tint, radius = --s-r, sky1/sky2/ground/stick = Falak sky card colours.
 */
data class LookColors(
    val tx: Color,
    val tx2: Color,
    val tx3: Color,
    val card: Color,
    val stroke: Color,
    val sep: Color,
    val accent: Color,
    val accentText: Color,
    val button: Color,
    val onButton: Color,
    val tint: Color,
    val radius: Dp,
    val sky1: Color,
    val sky2: Color,
    val ground: Color,
    val stick: Color,
)

data class Look(val style: TodayStyle, val dark: Boolean, val c: LookColors) {
    val centre get() = style == TodayStyle.CENTRE
    val sunPath get() = style == TodayStyle.SUN_PATH
    val bands get() = style == TodayStyle.BANDS
    val simple get() = style == TodayStyle.SIMPLE
    val gold get() = style == TodayStyle.GOLD

    /** The app wide accent (the web's --accent): the peach, or gold in Calm Gold. */
    val appAccent: Color
        get() = when {
            gold -> if (dark) Color(0xFFD4B25A) else Color(0xFF8A6A14)
            else -> if (dark) Color(247, 189, 143) else Color(178, 84, 31)
        }

    /** Words on the app wide accent (--on-accent). */
    val onAppAccent: Color
        get() = when {
            gold -> if (dark) Color(0xFF0F1B3D) else Color.White
            else -> if (dark) Color.Black.copy(alpha = 0.82f) else Color.White
        }

    /** The web's --fg2 outside a look page (tab bar words and icons). */
    val fg2: Color get() = if (dark) Color(235, 235, 245).copy(alpha = 0.82f) else Color(40, 40, 46).copy(alpha = 0.78f)

    /**
     * The flat page behind every tab in Colour Bands and Calm Gold (the web's
     * .bands-backdrop and .gold-backdrop). Null means the Living Sky.
     */
    val backdrop: Brush?
        get() = when {
            bands -> Brush.verticalGradient(listOf(if (dark) Color(0xFF232326) else Color(0xFFF2F0EB), if (dark) Color(0xFF232326) else Color(0xFFF2F0EB)))
            gold -> Brush.verticalGradient(if (dark) listOf(Color(0xFF0B0F2A), Color(0xFF151A45)) else listOf(Color(0xFFFBFAF7), Color(0xFFF1EEE8)))
            else -> null
        }

    companion object {
        fun of(style: TodayStyle, dark: Boolean): Look {
            val s = style.look
            return Look(s, dark, colors(s, dark))
        }

        private fun colors(style: TodayStyle, dark: Boolean): LookColors {
            // Centre Dial and Sun Path (and the base for Big and Simple)
            val base = if (!dark) LookColors(
                tx = Color(0xFF151A45), tx2 = Color(0xFF4A5080), tx3 = Color(0xFF6E7499),
                card = Color.White.copy(alpha = 0.62f), stroke = Color.White.copy(alpha = 0.75f), sep = Color(0xFF151A45).copy(alpha = 0.09f),
                accent = Color(0xFFC9622A), accentText = Color(0xFFB2541F), button = Color(0xFFB2541F), onButton = Color.White,
                tint = Color(0xFFB2541F).copy(alpha = 0.12f), radius = 20.dp,
                sky1 = Color(0xFF8EB9E8), sky2 = Color(0xFFEAF1F8), ground = Color(0xFFE5CE98), stick = Color(0xFF3A3A3A),
            ) else LookColors(
                tx = Color(0xFFEEF0FA), tx2 = Color(0xFFB9C0E2), tx3 = Color(0xFF8E97C4),
                card = Color.White.copy(alpha = 0.09f), stroke = Color.White.copy(alpha = 0.14f), sep = Color.White.copy(alpha = 0.1f),
                accent = Color(0xFFF7BD8F), accentText = Color(0xFFF7BD8F), button = Color(0xFFF7BD8F), onButton = Color(0xFF2A1500),
                tint = Color(0xFFF7BD8F).copy(alpha = 0.16f), radius = 20.dp,
                sky1 = Color(0xFF241F66), sky2 = Color(0xFF4D4B9C), ground = Color(0xFF2D2C66), stick = Color(0xFFEEF0FA),
            )
            return when (style) {
                TodayStyle.SIMPLE -> if (!dark) base.copy(tx = Color(0xFF0E1236), tx2 = Color(0xFF2E345E), tx3 = Color(0xFF4B5078), card = Color.White.copy(alpha = 0.8f))
                else base.copy(tx = Color.White, tx2 = Color(0xFFDDE0F2), tx3 = Color(0xFFBEC4E2), card = Color.White.copy(alpha = 0.12f))
                TodayStyle.BANDS -> if (dark) LookColors(
                    tx = Color(0xFFF4F2EE), tx2 = Color(0xFFC7C7CC), tx3 = Color(0xFF98989E),
                    card = Color(0xFF2C2C30), stroke = Color.White.copy(alpha = 0.08f), sep = Color.White.copy(alpha = 0.1f),
                    accent = Color(0xFFF2A65A), accentText = Color(0xFFF2A65A), button = Color(0xFFF2A65A), onButton = Color(0xFF1A1000),
                    tint = Color(0xFFF2A65A).copy(alpha = 0.16f), radius = 0.dp,
                    sky1 = Color(0xFF3A6F63), sky2 = Color(0xFF3A6F63), ground = Color(0xFFAB8D3A), stick = Color.White,
                ) else LookColors(
                    tx = Color(0xFF1D1D20), tx2 = Color(0xFF55555C), tx3 = Color(0xFF80808A),
                    card = Color.White, stroke = Color.Black.copy(alpha = 0.08f), sep = Color.Black.copy(alpha = 0.09f),
                    accent = Color(0xFFC4691C), accentText = Color(0xFFA9560F), button = Color(0xFFA9560F), onButton = Color.White,
                    tint = Color(0xFFC4691C).copy(alpha = 0.12f), radius = 0.dp,
                    sky1 = Color(0xFF3A6F63), sky2 = Color(0xFF3A6F63), ground = Color(0xFFAB8D3A), stick = Color.White,
                )
                TodayStyle.GOLD -> if (dark) LookColors(
                    tx = Color(0xFFEEF0FA), tx2 = Color(0xFFA9B2D6), tx3 = Color(0xFF7E88B3),
                    card = Color.White.copy(alpha = 0.07f), stroke = Color.White.copy(alpha = 0.09f), sep = Color.White.copy(alpha = 0.08f),
                    accent = Color(0xFFE2B65A), accentText = Color(0xFFE2B65A), button = Color(0xFFE2B65A), onButton = Color(0xFF151100),
                    tint = Color(0xFFE2B65A).copy(alpha = 0.14f), radius = 20.dp,
                    sky1 = Color(0xFF0B0F2A), sky2 = Color(0xFF1C2258), ground = Color(0xFF151A45), stick = Color(0xFFEEF0FA),
                ) else LookColors(
                    tx = Color(0xFF151A45), tx2 = Color(0xFF5B6188), tx3 = Color(0xFF62688C), // tx3 deeper than the web (#8B90AE) so small words pass 4.5 to 1
                    card = Color.White, stroke = Color(0xFF151A45).copy(alpha = 0.07f), sep = Color(0xFF151A45).copy(alpha = 0.08f),
                    accent = Color(0xFFE2B65A), accentText = Color(0xFF8A6410), button = Color(0xFFE2B65A), onButton = Color(0xFF151100),
                    tint = Color(0xFFE2B65A).copy(alpha = 0.2f), radius = 20.dp,
                    sky1 = Color(0xFFF6F2E8), sky2 = Color(0xFFFBFAF7), ground = Color(0xFFEADFC0), stick = Color(0xFF151A45),
                )
                else -> base
            }
        }
    }
}

/** The look in use. Set once at the root (SkyTheme), from the chosen Prayer screen style and dark or light. */
val LocalLook = staticCompositionLocalOf { Look.of(TodayStyle.CENTRE, dark = true) }
