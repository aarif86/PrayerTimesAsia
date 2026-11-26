package com.prayertimesasia.app.alarms

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.provider.OpenableColumns
import androidx.core.content.FileProvider
import com.prayertimesasia.core.AudioClip
import java.io.File
import java.io.OutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * "Your own azan": the person picks an audio file on their phone, and it becomes the
 * sound of their prayer time alerts. The file is shaped by [AudioClip] (quiet start
 * removed, at most 29 s, 0.5 s fade, loudness evened out) and saved as a WAV on this
 * phone only. We never upload it, and it is not in the app for anyone else.
 *
 * Android fixes a notification channel's sound when the channel is made, so every
 * new file gets a new channel and the old one is deleted.
 *
 * Where the file lives: Android 10 and later, the phone's Notifications folder
 * ("Notifications/Prayer Times Asia"), which the system can always play from.
 * Android 8 and 9, the app's own storage, shared with the system's sound player.
 */
object OwnAzan {
    private const val PREFS = "own_azan"
    private const val CHANNEL_PREFIX = "prayer-azan-own-"
    /** Decode only this much of a long file: enough for a quiet start plus the clip. */
    private const val DECODE_SECONDS = 45.0

    sealed class Result {
        data class Saved(val seconds: Double, val wasCut: Boolean) : Result()
        /** The file had no sound we could read, or less than a second of it. */
        data object NoSound : Result()
        /** The phone could not open or decode the file. */
        data object Unreadable : Result()
    }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun isSet(context: Context): Boolean = channel(context) != null

    /** The notification channel that plays the person's own azan, or null when none is set. */
    fun channel(context: Context): String? = prefs(context).getString("channel", null)

    fun uri(context: Context): Uri? = prefs(context).getString("uri", null)?.let(Uri::parse)

    /** The name of the file they picked, for the Settings page. */
    fun sourceName(context: Context): String? = prefs(context).getString("name", null)

    fun seconds(context: Context): Double = prefs(context).getFloat("seconds", 0f).toDouble()

    /** Reads, shapes and saves the picked file, then points prayer time alerts at it. Call off the main thread. */
    fun import(context: Context, source: Uri): Result {
        val decoded = runCatching { decode(context, source) }.getOrNull() ?: return Result.Unreadable
        val clip = AudioClip.shape(decoded.first, decoded.second) ?: return Result.NoSound
        val n = prefs(context).getInt("n", 0) + 1
        val saved = runCatching { save(context, clip, n) }.getOrNull() ?: return Result.Unreadable

        remove(context, keepCounter = true)
        val id = "$CHANNEL_PREFIX$n"
        if (Build.VERSION.SDK_INT >= 26) {
            val nm = context.getSystemService(NotificationManager::class.java)
            nm?.createNotificationChannel(NotificationChannel(id, "Prayer times with your own azan", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "The azan file you chose, at the time each prayer begins. It stays on this phone."
                setSound(saved, Azan.attributes)
            })
        }
        prefs(context).edit()
            .putInt("n", n)
            .putString("channel", id)
            .putString("uri", saved.toString())
            .putString("name", displayName(context, source))
            .putFloat("seconds", clip.seconds.toFloat())
            .apply()
        return Result.Saved(clip.seconds, clip.wasCut)
    }

    /** Back to the app's own azan (or the phone's sound when the app has none). */
    fun remove(context: Context, keepCounter: Boolean = false) {
        val p = prefs(context)
        p.getString("channel", null)?.let { id ->
            if (Build.VERSION.SDK_INT >= 26) context.getSystemService(NotificationManager::class.java)?.deleteNotificationChannel(id)
        }
        p.getString("uri", null)?.let { old ->
            val uri = Uri.parse(old)
            runCatching {
                if (uri.authority == MediaStore.AUTHORITY) context.contentResolver.delete(uri, null, null)
                else File(File(context.filesDir, "own-azan"), uri.lastPathSegment ?: "").delete()
            }
        }
        val n = p.getInt("n", 0)
        p.edit().clear().apply { if (keepCounter) putInt("n", n) }.apply()
    }

    // MARK: Decoding

    /** Mono samples from -1 to 1, and the sample rate. */
    private fun decode(context: Context, source: Uri): Pair<FloatArray, Int>? {
        val extractor = MediaExtractor()
        try {
            context.contentResolver.openFileDescriptor(source, "r")?.use { fd ->
                extractor.setDataSource(fd.fileDescriptor)
            } ?: return null
            val track = (0 until extractor.trackCount).firstOrNull {
                extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: return null
            extractor.selectTrack(track)
            val format = extractor.getTrackFormat(track)
            val codec = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)!!)
            codec.configure(format, null, null, 0)
            codec.start()

            var rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            var float = false
            val out = FloatList()
            val info = MediaCodec.BufferInfo()
            var inputDone = false
            var limit = (DECODE_SECONDS * rate * channels).toInt()
            try {
                while (out.size < limit) {
                    if (!inputDone) {
                        val i = codec.dequeueInputBuffer(10_000)
                        if (i >= 0) {
                            val buf = codec.getInputBuffer(i)!!
                            val size = extractor.readSampleData(buf, 0)
                            if (size < 0) {
                                codec.queueInputBuffer(i, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                                inputDone = true
                            } else {
                                codec.queueInputBuffer(i, 0, size, extractor.sampleTime, 0)
                                extractor.advance()
                            }
                        }
                    }
                    val o = codec.dequeueOutputBuffer(info, 10_000)
                    if (o == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                        val f = codec.outputFormat
                        rate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                        channels = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                        float = Build.VERSION.SDK_INT >= 24 && f.containsKey(MediaFormat.KEY_PCM_ENCODING) &&
                            f.getInteger(MediaFormat.KEY_PCM_ENCODING) == AudioFormat.ENCODING_PCM_FLOAT
                        limit = (DECODE_SECONDS * rate * channels).toInt()
                    } else if (o >= 0) {
                        val buf = codec.getOutputBuffer(o)!!.order(ByteOrder.nativeOrder())
                        buf.position(info.offset)
                        buf.limit(info.offset + info.size)
                        if (float) {
                            val fb = buf.asFloatBuffer()
                            while (fb.hasRemaining()) out.add(fb.get())
                        } else {
                            val sb = buf.asShortBuffer()
                            while (sb.hasRemaining()) out.add(sb.get() / 32768f)
                        }
                        codec.releaseOutputBuffer(o, false)
                        if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
                    }
                }
            } finally {
                runCatching { codec.stop() }
                codec.release()
            }
            return AudioClip.mono(out.toArray(), channels) to rate
        } finally {
            extractor.release()
        }
    }

    private class FloatList {
        private var a = FloatArray(1 shl 16)
        var size = 0; private set
        fun add(v: Float) {
            if (size == a.size) a = a.copyOf(a.size * 2)
            a[size++] = v
        }
        fun toArray(): FloatArray = a.copyOf(size)
    }

    // MARK: Saving

    private fun save(context: Context, clip: AudioClip.Clip, n: Int): Uri {
        val name = "Prayer Times Asia azan $n.wav"
        if (Build.VERSION.SDK_INT >= 29) {
            val values = ContentValues().apply {
                put(MediaStore.Audio.Media.DISPLAY_NAME, name)
                put(MediaStore.Audio.Media.MIME_TYPE, "audio/wav")
                put(MediaStore.Audio.Media.RELATIVE_PATH, "${Environment.DIRECTORY_NOTIFICATIONS}/Prayer Times Asia")
                put(MediaStore.Audio.Media.IS_NOTIFICATION, 1)
                put(MediaStore.Audio.Media.IS_PENDING, 1)
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values)!!
            try {
                resolver.openOutputStream(uri)!!.use { writeWav(it, clip) }
            } catch (e: Exception) {
                resolver.delete(uri, null, null)
                throw e
            }
            resolver.update(uri, ContentValues().apply { put(MediaStore.Audio.Media.IS_PENDING, 0) }, null, null)
            return uri
        }
        val dir = File(context.filesDir, "own-azan").apply { mkdirs() }
        val file = File(dir, "own-azan-$n.wav")
        file.outputStream().use { writeWav(it, clip) }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
        // Android 8 and 9 play notification sounds from the system UI, which needs to be let in.
        for (pkg in listOf("com.android.systemui", "android")) {
            context.grantUriPermission(pkg, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        return uri
    }

    /** 16-bit mono PCM WAV. */
    private fun writeWav(out: OutputStream, clip: AudioClip.Clip) {
        val data = clip.samples.size * 2
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN).apply {
            put("RIFF".toByteArray()); putInt(36 + data); put("WAVE".toByteArray())
            put("fmt ".toByteArray()); putInt(16); putShort(1); putShort(1)
            putInt(clip.sampleRate); putInt(clip.sampleRate * 2); putShort(2); putShort(16)
            put("data".toByteArray()); putInt(data)
        }
        out.write(header.array())
        val body = ByteBuffer.allocate(data).order(ByteOrder.LITTLE_ENDIAN)
        for (s in clip.samples) body.putShort((s.coerceIn(-1f, 1f) * 32767).toInt().toShort())
        out.write(body.array())
    }

    private fun displayName(context: Context, uri: Uri): String? = runCatching {
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }
    }.getOrNull()
}
