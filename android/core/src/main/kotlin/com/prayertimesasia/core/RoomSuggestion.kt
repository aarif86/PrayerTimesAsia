package com.prayertimesasia.core

import java.util.Locale

/**
 * "Suggest a prayer room": a musollah or prayer room missing from the Masjid tab.
 * No sign in and no server: it becomes an email to salam@prayertimes.asia that the
 * person sends from their own email app. Same lines as the web and iPhone apps.
 */
object RoomSuggestion {
    enum class Has(val label: String) {
        WOMEN("Women's space"),
        SHARED("One space for men and women"),
        AIRCON("Air conditioned"),
        MATS("Prayer mats"),
        GARMENTS("Telekung and sarong"),
        ABLUTION("Place for wudhu"),
        SLIPPERS("Slippers"),
    }

    private fun at(c: Coordinates) = String.format(Locale.US, "%.5f, %.5f", c.latitude, c.longitude)

    /** Subject and body of the email. [pin] is where the person stood; [near] the area the tab showed. */
    fun email(
        name: String, level: String, address: String, directions: String, remarks: String,
        has: Set<Has>, pin: Coordinates?, near: Coordinates?, details: String,
    ): Pair<String, String> {
        val lines = buildList {
            add("Place: ${name.trim()}")
            if (level.isNotBlank()) add("Level: ${level.trim()}")
            if (address.isNotBlank()) add("Address: ${address.trim()}")
            if (directions.isNotBlank()) add("How to find it: ${directions.trim()}")
            if (has.isNotEmpty()) add("Has: " + Has.entries.filter { it in has }.joinToString(", ") { it.label })
            if (remarks.isNotBlank()) add("Remarks: ${remarks.trim()}")
            if (pin != null) {
                val la = String.format(Locale.US, "%.5f", pin.latitude)
                val lo = String.format(Locale.US, "%.5f", pin.longitude)
                add("Pin (I was there): ${at(pin)} https://www.openstreetmap.org/?mlat=$la&mlon=$lo#map=19/$la/$lo")
            } else if (near != null) add("Near: ${at(near)}")
            add("")
            add(details)
        }
        val subject = "Suggest a prayer room: ${name.trim().ifEmpty { "no name" }} | Prayer Times Asia"
        return subject to lines.joinToString("\n").trim() + "\n"
    }

    /** The place name plus an address or a pin. */
    fun ready(name: String, address: String, pin: Coordinates?) = name.isNotBlank() && (address.isNotBlank() || pin != null)
}
