package com.prayertimesasia.app.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Language
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.ui.theme.AppIcons
import com.prayertimesasia.app.ui.theme.LivingSkyBackground
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.SkyColors
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.display

@Composable
fun OnboardingScreen(state: AppState, chooseCity: () -> Unit) {
    Box(Modifier.fillMaxSize()) {
        LivingSkyBackground(SkyColors.dawn)
        Column(
            Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(horizontal = 28.dp).padding(bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(28.dp),
        ) {
            Spacer(Modifier.weight(1f))
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Prayer Times\nAsia", style = display(52.sp, FontWeight.Bold).copy(lineHeight = 54.sp), color = Palette.primary)
                Text("Wherever you land in Asia, know when to pray and which way to face.", style = Txt.title3.copy(fontWeight = FontWeight.Medium),
                    color = Palette.primary.copy(alpha = 0.9f))
            }
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Feature(Icons.Filled.Language, "Every country's own method",
                    "MUIS in Singapore, JAKIM in Malaysia, Kemenag in Indonesia - and sensible defaults everywhere else.")
                Feature(AppIcons.journey, "Built for travel",
                    "Switches when you land, works offline, and tells you when you can shorten and combine prayers.")
                Feature(AppIcons.qibla, "Qibla in one glance", "A calm compass that lights up when you're facing the Kaaba.")
            }
            Spacer(Modifier.weight(1f))
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Use my location", style = Txt.headline, color = Color(0.12f, 0.2f, 0.4f),
                    modifier = Modifier.fillMaxWidth().clip(CircleShape).background(Color.White).clickable {
                        state.useGPS()
                        state.update { it.copy(hasOnboarded = true) }
                    }.padding(vertical = 16.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                Text("Choose a city instead", style = Txt.subheadlineSemibold, color = Palette.primary,
                    modifier = Modifier.clip(CircleShape).clickable(onClick = chooseCity).padding(8.dp))
                Text("No third-party ads. No account. Your location stays on your phone.", style = Txt.caption,
                    color = Palette.primary.copy(alpha = 0.75f))
            }
        }
    }
}

@Composable
private fun Feature(icon: ImageVector, title: String, detail: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Icon(icon, null, Modifier.size(26.dp), tint = Palette.primary)
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, style = Txt.headline, color = Palette.primary)
            Text(detail, style = Txt.subheadline, color = Palette.primary.copy(alpha = 0.85f))
        }
    }
}
