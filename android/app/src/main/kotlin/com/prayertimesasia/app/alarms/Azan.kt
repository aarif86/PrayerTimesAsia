package com.prayertimesasia.app.alarms

import android.content.Context
import android.media.AudioAttributes
import android.net.Uri

/**
 * The azan for prayer time alerts: res/raw/azan.ogg and azan_subuh.ogg, made
 * from one source recording by tools/make_azan.sh. Looked up by name, so the
 * app builds and runs before the recordings are added; until then the switch
 * stays hidden and alerts use the phone's sound. Android plays the whole file.
 */
object Azan {
    private const val FILE = "azan"
    private const val SUBUH_FILE = "azan_subuh"

    val attributes: AudioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()

    fun isAvailable(context: Context): Boolean = id(context, FILE) != 0

    fun uri(context: Context, subuh: Boolean): Uri? {
        val id = id(context, if (subuh) SUBUH_FILE else FILE).takeIf { it != 0 } ?: return null
        return Uri.parse("android.resource://${context.packageName}/$id")
    }

    @Suppress("DiscouragedApi")
    private fun id(context: Context, name: String): Int =
        context.resources.getIdentifier(name, "raw", context.packageName)
}
