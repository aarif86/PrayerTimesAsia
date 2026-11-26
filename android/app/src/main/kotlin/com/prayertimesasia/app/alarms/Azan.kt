package com.prayertimesasia.app.alarms

import android.content.Context
import android.media.AudioAttributes
import android.net.Uri

/**
 * The azan for prayer time alerts. Each voice has up to three files in
 * res/raw, made by tools/make_azan.sh (see docs/azan-clip-spec.md):
 *   azan_VOICE_short.ogg  the opening takbir only (the default length)
 *   azan_VOICE.ogg        the full azan
 *   azan_VOICE_fajr.ogg   a Fajr azan, played at Fajr when Full is chosen
 * Looked up by name, so a voice only shows once its files are added; a slot
 * waiting for permission (docs/AUDIO_LICENSES.csv) stays hidden until then.
 * With no voices at all the switch stays hidden and alerts use the phone's sound.
 */
object Azan {
    /** Every voice slot, in the order shown. The last four wait for permission. */
    val VOICES = listOf("asim", "makkah", "khalaf", "sudais", "aqsa", "egypt", "madinah")

    enum class Kind(val suffix: String) { SHORT("_short"), FULL(""), FAJR("_fajr") }

    val attributes: AudioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()

    /** The voices whose recordings are in the app. */
    fun voices(context: Context): List<String> = VOICES.filter { has(context, it, Kind.SHORT) || has(context, it, Kind.FULL) }

    /** The chosen voice, or the first one there if it is missing. */
    fun voiceOrDefault(context: Context, voice: String?): String? = voices(context).let { all -> all.firstOrNull { it == voice } ?: all.firstOrNull() }

    /** True when the app has its own recording, or the person picked their own (see [OwnAzan]). */
    fun isAvailable(context: Context): Boolean = voices(context).isNotEmpty() || OwnAzan.isSet(context)

    fun has(context: Context, voice: String, kind: Kind): Boolean = id(context, voice, kind) != 0

    /**
     * Which file plays: Fajr plays the voice's Fajr azan when Full is chosen,
     * otherwise the short call. A missing length falls back to the other one.
     */
    fun kindFor(context: Context, voice: String, full: Boolean, fajr: Boolean): Kind = when {
        fajr -> if (full && has(context, voice, Kind.FAJR)) Kind.FAJR else short(context, voice)
        full -> if (has(context, voice, Kind.FULL)) Kind.FULL else Kind.SHORT
        else -> short(context, voice)
    }

    private fun short(context: Context, voice: String) = if (has(context, voice, Kind.SHORT)) Kind.SHORT else Kind.FULL

    fun uri(context: Context, voice: String, kind: Kind): Uri? {
        val id = id(context, voice, kind).takeIf { it != 0 } ?: return null
        return Uri.parse("android.resource://${context.packageName}/$id")
    }

    /** The notification channel for one sound; Android fixes a channel's sound when it is made. */
    fun channelId(voice: String, kind: Kind): String = "prayer-azan-$voice${kind.suffix.replace('_', '-')}"

    @Suppress("DiscouragedApi")
    private fun id(context: Context, voice: String, kind: Kind): Int =
        context.resources.getIdentifier("azan_$voice${kind.suffix}", "raw", context.packageName)
}
