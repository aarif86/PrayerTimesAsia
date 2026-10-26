package com.prayertimesasia.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.display

object Dims {
    val corner = 22.dp
    val gutter = 20.dp
}

/** Frosted card on top of the sky. */
@Composable
fun GlassCard(modifier: Modifier = Modifier, padding: Dp = 16.dp, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(Dims.corner)
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Palette.material, shape)
            .border(1.dp, Palette.primary.copy(alpha = 0.12f), shape)
            .padding(padding),
        content = content,
    )
}

/** A small capsule label, optionally with an icon. */
@Composable
fun Chip(text: String, icon: ImageVector? = null, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null) {
    Row(
        modifier
            .clip(CircleShape)
            .background(Palette.primary.copy(alpha = 0.14f), CircleShape)
            .border(1.dp, Palette.primary.copy(alpha = 0.18f), CircleShape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (icon != null) Icon(icon, null, Modifier.size(15.dp), tint = Palette.primary)
        Text(text, style = Txt.footnoteSemibold, color = Palette.primary, maxLines = 1)
    }
}

/** A round icon button on a faint disc (the Prayer screen's style and appearance buttons). */
@Composable
fun CircleIconButton(
    icon: ImageVector,
    description: String,
    modifier: Modifier = Modifier,
    background: Color = Palette.primary.copy(alpha = 0.1f),
    tint: Color = Palette.primary,
    size: Dp = 34.dp,
    onClick: () -> Unit,
) {
    Box(
        modifier
            .size(size)
            .clip(CircleShape)
            .background(background, CircleShape)
            .clickable(onClickLabel = description, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, description, Modifier.size(size * 0.5f), tint = tint)
    }
}

/** A time with its AM/PM set smaller on the same baseline. Never wraps. */
@Composable
fun TimeText(
    parts: Pair<String, String?>,
    size: TextUnit = 28.sp,
    weight: FontWeight = FontWeight.SemiBold,
    color: Color = Palette.primary,
    modifier: Modifier = Modifier,
) {
    Row(modifier, verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(parts.first, style = display(size, weight), color = color, maxLines = 1, softWrap = false,
            modifier = Modifier.alignByBaseline())
        parts.second?.let {
            Text(it, style = display(size * 0.5f, FontWeight.Bold), color = color.copy(alpha = color.alpha * 0.7f),
                maxLines = 1, softWrap = false, modifier = Modifier.alignByBaseline())
        }
    }
}

/** Text that shrinks a little rather than wrapping or cutting off. */
@Composable
fun FitText(
    text: String,
    style: TextStyle,
    color: Color = Palette.primary,
    modifier: Modifier = Modifier,
    maxLines: Int = 1,
) {
    Text(text, style = style, color = color, maxLines = maxLines, overflow = TextOverflow.Ellipsis, modifier = modifier)
}

/** Capsule button with a faint fill ("SHOW MORE"). */
@Composable
fun CapsuleButton(
    text: String,
    modifier: Modifier = Modifier,
    trailing: ImageVector? = null,
    style: TextStyle = Txt.footnoteSemibold.copy(fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp),
    padding: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 9.dp),
    background: Color = Palette.primary.copy(alpha = 0.1f),
    contentColor: Color = Palette.primary,
    onClick: () -> Unit,
) {
    Row(
        modifier
            .clip(CircleShape)
            .background(background, CircleShape)
            .clickable(onClick = onClick)
            .padding(padding),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(text, style = style, color = contentColor)
        if (trailing != null) Icon(trailing, null, Modifier.size(16.dp), tint = contentColor)
    }
}

/** Outlined capsule (the place chip). */
fun Modifier.outlinedCapsule(color: Color, fill: Color = Color.Transparent): Modifier =
    this.clip(CircleShape).background(fill, CircleShape).border(BorderStroke(1.dp, color), CircleShape)

/** A click without the ripple, for big tappable rows on the sky. */
@Composable
fun Modifier.quietClick(onClick: () -> Unit): Modifier {
    val source = remember { MutableInteractionSource() }
    return this.clickable(interactionSource = source, indication = null, onClick = onClick)
}
