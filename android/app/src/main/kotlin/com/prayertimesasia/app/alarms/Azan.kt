package com.prayertimesasia.app.alarms

import android.content.Context
import android.media.AudioAttributes
import android.net.Uri

/**
 * The azan for prayer time alerts, in two lengths made from one recording by
 * tools/make_azan.sh (see docs/azan-clip-spec.md):
 *   res/raw/azan_short.ogg  the opening takbir only, about 12 seconds (the default)
 *   res/raw/azan.ogg        the full azan
 * Looked up by name, so the app builds and runs without them; until they are
 * added the switch stays hidden and alerts use the phone's sound.
 *
 * Fajr always uses the short call: the full recording is the ordinary azan,
 * without the Fajr line. A res/raw/azan_subuh.ogg, if one is ever added, is used
 * for Fajr instead.
 */
object Azan {
    private const val FULL = "azan"
    private const val SHORT = "azan_short"
    private const val SUBUH = "azan_subuh"

    val attributes: AudioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()

    /** True when the app has its own recording, or the person picked their own (see [OwnAzan]). */
    fun isAvailable(context: Context): Boolean =
        id(context, SHORT) != 0 || id(context, FULL) != 0 || OwnAzan.isSet(context)

    /** True when the app has both lengths, so the Short or Full choice is worth showing. */
    fun hasBothLengths(context: Context): Boolean = id(context, SHORT) != 0 && id(context, FULL) != 0

    /** The short call, falling back to the full file if only that one is there. */
    fun shortUri(context: Context): Uri? = uri(context, SHORT) ?: uri(context, FULL)

    /** The full azan, falling back to the short call if only that one is there. */
    fun fullUri(context: Context): Uri? = uri(context, FULL) ?: uri(context, SHORT)

    /** A separate Fajr recording, when the app has one. */
    fun subuhUri(context: Context): Uri? = uri(context, SUBUH)

    private fun uri(context: Context, name: String): Uri? {
        val id = id(context, name).takeIf { it != 0 } ?: return null
        return Uri.parse("android.resource://${context.packageName}/$id")
    }

    @Suppress("DiscouragedApi")
    private fun id(context: Context, name: String): Int =
        context.resources.getIdentifier(name, "raw", context.packageName)
}
