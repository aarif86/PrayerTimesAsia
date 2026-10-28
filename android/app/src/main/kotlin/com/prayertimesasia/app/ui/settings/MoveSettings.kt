package com.prayertimesasia.app.ui.settings

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.ContentPaste
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.EncodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.core.MovedSettings
import java.util.concurrent.Executors

/** Settings › Move my settings: a QR code (and link) holding everything the user chose. Nothing is uploaded. */
@Composable
fun MoveOutContent(state: AppState) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val moved = remember { MovedSettings.from(state.prefs) }
    val (qrLink, keptDays) = remember(moved) { moved.qrLink() }
    val qr = remember(qrLink) { qrBitmap(qrLink) }
    val link = remember(moved) { moved.link() }
    var copied by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = Dims.gutter),
        verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Move my settings", style = Txt.headline, color = Palette.primary)
        Text("Your places, choices and tracker history, packed into one code. Nothing is uploaded: the settings are inside the code itself.",
            style = Txt.subheadline, color = Palette.primary)
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Image(qr.asImageBitmap(), "QR code with your settings", filterQuality = FilterQuality.None,
                modifier = Modifier.widthIn(max = 260.dp).fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(12.dp)).background(Color.White))
        }
        Text("On the other phone, open Prayer Times Asia › Settings › Bring in settings and scan this code. No app there? Point its camera at the code: it opens the web app with your settings.",
            style = Txt.footnote, color = Palette.secondary)
        if (keptDays != null) {
            Text("The QR code carries your last $keptDays days of tracker history. To bring all of it, share the link instead.",
                style = Txt.footnote, color = Palette.secondary)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Pill(Icons.Filled.Share, "Share link") {
                val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, link)
                    .putExtra(Intent.EXTRA_SUBJECT, "My Prayer Times Asia settings")
                runCatching { context.startActivity(Intent.createChooser(send, "Share link").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            }
            Pill(if (copied) Icons.Filled.Check else Icons.Filled.ContentCopy, if (copied) "Copied" else "Copy link") {
                clipboard.setText(AnnotatedString(link))
                copied = true
            }
        }
        Text("The code includes your saved places, so only send it to yourself.", style = Txt.footnote, color = Palette.secondary)
        Box(Modifier.height(24.dp))
    }
}

/** Settings › Bring in settings: scan the other phone's QR code, or paste its link. */
@Composable
fun MoveInContent(state: AppState, close: () -> Unit) {
    val clipboard = LocalClipboardManager.current
    var text by remember { mutableStateOf("") }
    var scanning by remember { mutableStateOf(false) }
    var done by remember { mutableStateOf(false) }
    val moved = remember(text) { if (text.isBlank()) null else MovedSettings.fromCode(text) }
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = Dims.gutter),
        verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Bring in settings", style = Txt.headline, color = Palette.primary)
        if (done) {
            Text("Your settings are here.", style = Txt.subheadlineSemibold, color = Palette.primary)
            Text("Prayer alerts need permission on each phone: turn them on in Settings › Alerts.", style = Txt.footnote, color = Palette.secondary)
            Pill(null, "Done", close)
        } else {
            Text("On your other phone or browser, open Settings › Move my settings. It shows a QR code and a link.",
                style = Txt.subheadline, color = Palette.primary)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Pill(Icons.Filled.QrCodeScanner, "Scan the QR code") { scanning = true }
                Pill(Icons.Filled.ContentPaste, "Paste") { clipboard.getText()?.text?.let { text = it } }
            }
            OutlinedTextField(text, { text = it }, Modifier.fillMaxWidth(), placeholder = { Text("Or type or paste the link") },
                textStyle = Txt.footnote.copy(fontFamily = FontFamily.Monospace), maxLines = 4)
            if (text.isNotBlank()) {
                if (moved == null) {
                    Text("That doesn't look like a settings code. Copy the whole link and try again.", style = Txt.footnote, color = Color(0xFFE5484D))
                } else {
                    Text("This will bring in:", style = Txt.subheadlineSemibold, color = Palette.primary)
                    moved.summary.forEach { Text("•  $it", style = Txt.subheadline, color = Palette.primary) }
                    Text("Your settings here are replaced. Tracker history is added to what's already here.", style = Txt.footnote, color = Palette.secondary)
                    Pill(null, "Bring in settings") {
                        state.update { moved.appliedTo(it) }
                        if (state.prefs.useGPS) state.useGPS()
                        done = true
                    }
                }
            }
        }
        Box(Modifier.height(24.dp))
    }
    if (scanning) {
        Dialog(onDismissRequest = { scanning = false }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
            QrScannerScreen(state, onFound = { text = it; scanning = false }, onClose = { scanning = false })
        }
    }
}

@Composable
private fun Pill(icon: ImageVector?, label: String, onClick: () -> Unit) {
    Row(Modifier.clip(CircleShape).background(if (icon == null) Palette.accent else Palette.primary.copy(alpha = 0.1f))
        .clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        if (icon != null) Icon(icon, null, Modifier.size(18.dp), tint = Palette.primary)
        Text(label, style = Txt.subheadlineSemibold, color = if (icon == null) Color.Black.copy(alpha = 0.82f) else Palette.primary)
    }
}

private fun qrBitmap(text: String): Bitmap {
    val matrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0,
        mapOf(EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.L, EncodeHintType.MARGIN to 2))
    val w = matrix.width
    val h = matrix.height
    val pixels = IntArray(w * h) { i -> if (matrix.get(i % w, i / w)) android.graphics.Color.BLACK else android.graphics.Color.WHITE }
    return Bitmap.createBitmap(pixels, w, h, Bitmap.Config.ARGB_8888)
}

/** The back camera, looking for a QR code with a settings code in it. */
@Composable
private fun QrScannerScreen(state: AppState, onFound: (String) -> Unit, onClose: () -> Unit) {
    val context = LocalContext.current
    var granted by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    LaunchedEffect(Unit) { if (!granted) granted = state.permissions?.camera() ?: false }
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        if (granted) {
            QrCameraPreview(onFound)
        } else {
            Text("Bring in settings needs the camera to scan the QR code. Nothing is recorded. You can paste the link instead.",
                fontSize = 15.sp, color = Color.White, modifier = Modifier.align(Alignment.Center).padding(32.dp))
        }
        Box(Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(16.dp).size(40.dp).clip(RoundedCornerShape(20.dp))
            .background(Color.Black.copy(alpha = 0.45f)).clickable(onClick = onClose), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Close, "Close", Modifier.size(20.dp), tint = Color.White)
        }
    }
}

@Composable
private fun QrCameraPreview(onFound: (String) -> Unit) {
    val lifecycleOwner = LocalLifecycleOwner.current
    val context = LocalContext.current
    val view = remember { PreviewView(context) }
    DisposableEffect(lifecycleOwner) {
        val future = ProcessCameraProvider.getInstance(context)
        val executor = Executors.newSingleThreadExecutor()
        val reader = MultiFormatReader().apply {
            setHints(mapOf(DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE), DecodeHintType.TRY_HARDER to true))
        }
        var found = false
        var provider: ProcessCameraProvider? = null
        future.addListener({
            runCatching {
                val p = future.get()
                provider = p
                val preview = Preview.Builder().build().also { it.setSurfaceProvider(view.surfaceProvider) }
                val analysis = ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
                analysis.setAnalyzer(executor) { image ->
                    image.use {
                        if (found) return@use
                        // The Y (brightness) plane is all a QR reader needs.
                        val plane = it.planes[0]
                        val buffer = plane.buffer
                        val bytes = ByteArray(buffer.remaining()).also { b -> buffer.get(b) }
                        val source = PlanarYUVLuminanceSource(bytes, plane.rowStride, it.height, 0, 0, it.width, it.height, false)
                        val text = runCatching { reader.decodeWithState(BinaryBitmap(HybridBinarizer(source))).text }.getOrNull()
                        reader.reset()
                        if (text != null && text.contains(MovedSettings.PREFIX)) {
                            found = true
                            ContextCompat.getMainExecutor(context).execute { onFound(text) }
                        }
                    }
                }
                p.unbindAll()
                p.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
            }
        }, ContextCompat.getMainExecutor(context))
        onDispose {
            runCatching { provider?.unbindAll() }
            executor.shutdown()
        }
    }
    AndroidView({ view }, Modifier.fillMaxSize())
}
