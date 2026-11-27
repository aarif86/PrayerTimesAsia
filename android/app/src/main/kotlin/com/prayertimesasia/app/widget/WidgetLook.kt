package com.prayertimesasia.app.widget

import androidx.compose.ui.graphics.Color
import com.prayertimesasia.app.ui.theme.SkyColors
import com.prayertimesasia.core.TodayStyle

/**
 * The five looks' colours for the widgets and their preview, taken from the Prayer screen's
 * looks (as on the iPhone, Shared/WidgetLook.swift). Light and Dark come from the app's
 * Appearance (the phone's, on Automatic).
 */
internal class WPal(
    val fg: Color,
    val fg2: Color,
    /** The card behind the prayer list. */
    val card: Color,
    /** The highlighted row (the next prayer). */
    val cur: Color,
    /** Words and shapes in the look's accent (the countdown, the gold dot). */
    val acc: Color,
    /** Colour Bands' date bar, Calm Gold's ring. */
    val bar: Color,
    /** Big and Simple's prayer name. */
    val hero: Color,
)

private fun hex(rgb: Int, alpha: Float = 1f) = Color(0xFF000000.toInt() or rgb).copy(alpha = alpha)

internal fun widgetPal(style: TodayStyle, dark: Boolean): WPal = when (style) {
    TodayStyle.BANDS -> WPal(
        fg = if (dark) hex(0xF4F2EE) else hex(0x1D1D20), fg2 = if (dark) hex(0xC7C7CC) else hex(0x55555C),
        card = Color.Transparent, cur = Color.Transparent, acc = if (dark) hex(0xF2A65A) else hex(0xA9560F),
        bar = if (dark) hex(0x3D3D3D) else hex(0xE4E1DA), hero = if (dark) hex(0xF4F2EE) else hex(0x1D1D20),
    )
    TodayStyle.GOLD -> WPal(
        fg = if (dark) hex(0xEEF0FA) else hex(0x151A45), fg2 = if (dark) hex(0xA9B2D6) else hex(0x5B6188),
        card = if (dark) Color.White.copy(alpha = 0.07f) else Color.White,
        cur = if (dark) hex(0xE2B65A, 0.16f) else hex(0x8A6A14, 0.14f),
        acc = if (dark) hex(0xD4B25A) else hex(0x8A6A14), bar = if (dark) hex(0xD4B25A) else hex(0x8A6A14),
        hero = if (dark) hex(0xEEF0FA) else hex(0x151A45),
    )
    TodayStyle.SIMPLE -> WPal(
        fg = if (dark) Color.White else hex(0x0E1236), fg2 = if (dark) hex(0xDDE0F2) else hex(0x2E345E),
        card = if (dark) Color.White.copy(alpha = 0.12f) else Color.White.copy(alpha = 0.8f),
        cur = if (dark) Color.White.copy(alpha = 0.2f) else hex(0x151A45, 0.12f),
        acc = if (dark) hex(0xF7BD8F) else hex(0xB2541F), bar = Color.Transparent,
        hero = if (dark) hex(0xB2A8FF) else hex(0x4B3CBF),
    )
    else -> WPal(
        fg = if (dark) hex(0xEEF0FA) else hex(0x151A45), fg2 = if (dark) hex(0xB9C0E2) else hex(0x4A5080),
        card = if (dark) Color.White.copy(alpha = 0.1f) else Color.White.copy(alpha = 0.62f),
        cur = if (dark) Color.White.copy(alpha = 0.2f) else hex(0x151A45, 0.12f),
        acc = if (dark) hex(0xF7BD8F) else hex(0xB2541F), bar = Color.Transparent,
        hero = if (dark) hex(0xEEF0FA) else hex(0x151A45),
    )
}

/** What sits behind a widget, top then bottom: the Living Sky (washed bright in Light), Colour Bands' flat page, or Calm Gold's navy / warm white. */
internal fun backdropColors(m: WidgetModel): Pair<Color, Color> = when (m.style) {
    TodayStyle.BANDS -> (if (m.dark) hex(0x232326) else hex(0xF2F0EB)).let { it to it }
    TodayStyle.GOLD -> if (m.dark) hex(0x0B0F2A) to hex(0x151A45) else hex(0xFBFAF7) to hex(0xF1EEE8)
    else -> {
        val base = SkyColors.at(m.now, m.day)
        val sky = if (m.dark) base.readable else base.daylight
        sky.top.color to sky.bottom.color
    }
}
