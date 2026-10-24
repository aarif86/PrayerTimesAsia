package com.prayertimesasia.app.ui.theme

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.R

/**
 * Nunito (SIL Open Font License) stands in for SF Pro Rounded, the iOS app's
 * display face: soft, round and clear at a glance.
 */
val Rounded = FontFamily(
    Font(R.font.nunito_regular, FontWeight.Normal),
    Font(R.font.nunito_medium, FontWeight.Medium),
    Font(R.font.nunito_semibold, FontWeight.SemiBold),
    Font(R.font.nunito_bold, FontWeight.Bold),
    Font(R.font.nunito_extrabold, FontWeight.ExtraBold),
    Font(R.font.nunito_extrabold, FontWeight.Black),
)

/** Big rounded figures: times, countdowns, titles. Tabular digits so times line up. */
fun display(size: TextUnit, weight: FontWeight = FontWeight.SemiBold) =
    TextStyle(fontFamily = Rounded, fontSize = size, fontWeight = weight, fontFeatureSettings = "tnum")

/** Body text, the iOS text styles in sp. */
object Txt {
    private fun s(size: Int, weight: FontWeight = FontWeight.Normal) =
        TextStyle(fontFamily = Rounded, fontSize = size.sp, fontWeight = weight, lineHeight = (size * 1.25).sp)

    val largeTitle = s(34, FontWeight.Bold)
    val title2 = s(22, FontWeight.Bold)
    val title3 = s(20, FontWeight.SemiBold)
    val headline = s(17, FontWeight.Bold)
    val body = s(17)
    val bodySemibold = s(17, FontWeight.SemiBold)
    val subheadline = s(15)
    val subheadlineSemibold = s(15, FontWeight.SemiBold)
    val footnote = s(13)
    val footnoteSemibold = s(13, FontWeight.SemiBold)
    val caption = s(12)
    val captionSemibold = s(12, FontWeight.SemiBold)
    val caption2 = s(11)
    val caption2Heavy = s(11, FontWeight.ExtraBold)
}
