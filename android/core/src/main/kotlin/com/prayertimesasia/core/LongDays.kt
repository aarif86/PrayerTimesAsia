package com.prayertimesasia.core

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Long summer days far from the equator (students abroad, travellers).
 *
 * In summer at high latitudes the sky never gets as dark as the method's Fajr
 * or Isha angle, so the engine's high latitude rule sets those two times. This
 * only notices that it happens, to show a short closable note. It never changes
 * a time.
 *
 * Same rules as web/src/core/longDays.ts and ios Core/LongDays.swift.
 */
object LongDays {
    /**
     * True when, on this date, the sun at its lowest in the night stays above the
     * method's Fajr or Isha angle (twilight never ends), so a high latitude rule
     * sets Fajr and Isha.
     */
    fun twilightLastsAllNight(year: Int, month: Int, day: Int, latitude: Double, method: CalculationMethod): Boolean {
        if (abs(latitude) < 40) return false
        val declination = Astro.sun(Astro.julianDay(year, month, day) + 0.5).declination
        val lowest = abs(latitude + declination) - 90
        val angle = max(method.fajrAngle, method.ishaAngle ?: 0.0)
        return lowest > -angle
    }

    /** One note per place and summer. A southern summer (October to March) counts as the year it began in. */
    fun key(year: Int, month: Int, latitude: Double, longitude: Double, countryCode: String?): String {
        val summer = if (latitude >= 0) year else if (month <= 6) year - 1 else year
        val code = countryCode?.takeIf { it.isNotEmpty() } ?: "xx"
        return "$code:${jsRound(latitude)}:${jsRound(longitude)}:$summer"
    }

    /** Rounds halves up like JavaScript's Math.round, so all three apps make the same key. */
    private fun jsRound(x: Double): Int = kotlin.math.floor(x + 0.5).toInt()

    data class Words(val title: String, val body: (fajr: String, isha: String) -> String, val close: String)

    /** DRAFT wording, waiting for the owner's approval. */
    fun words(lang: RamadanContent.Lang): Words = when (lang) {
        RamadanContent.Lang.MS -> Words(
            "Siang yang panjang pada musim panas",
            { f, i -> "Pada musim panas, langit di sini tidak gelap sepenuhnya, jadi waktu $f sangat awal dan waktu $i sangat lewat. Aplikasi menggunakan kaedah khas untuk dua waktu ini, sebab itu ia mungkin kelihatan luar biasa. Sila ikut jadual masjid berhampiran dan pihak berkuasa agama tempatan anda." },
            "Tutup",
        )
        RamadanContent.Lang.ID -> Words(
            "Siang yang panjang di musim panas",
            { f, i -> "Di musim panas, langit di sini tidak pernah gelap sepenuhnya, sehingga waktu $f sangat awal dan waktu $i sangat larut. Aplikasi memakai aturan khusus untuk dua waktu ini, karena itu waktunya bisa terlihat tidak biasa. Ikuti jadwal masjid setempat dan otoritas keagamaan setempat Anda." },
            "Tutup",
        )
        RamadanContent.Lang.EN -> Words(
            "Long summer days here",
            { f, i -> "In summer the sky here never gets fully dark, so $f comes very early and $i very late. The app uses a twilight rule for these two times, which is why they may look unusual. Please follow the timetable of your local masjid and your local religious authority." },
            "Close",
        )
    }
}
