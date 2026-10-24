package com.prayertimesasia.core

/**
 * The parameters one authority uses to turn the sun's position into prayer times.
 *
 * Every time the engine produces is `ceil(astronomical time + offset)` to the
 * minute. The offsets are each authority's precautionary minutes (ihtiyat). For
 * MUIS and JAKIM they were fitted against the full 2026 official timetables:
 * for MUIS the offline calculation is never earlier than the official time
 * (prayers up to 2 minutes later, sunrise up to 1 earlier); for JAKIM, whose
 * zones each use their own reference point, it is within about 2 minutes and errs late.
 * When online, the official table replaces the calculation with the exact times.
 */
data class CalculationMethod(
    val id: String,
    /** Long name, e.g. "MUIS · Singapore". */
    val name: String,
    /** Short label for chips, e.g. "MUIS". */
    val shortName: String,
    val fajrAngle: Double,
    /** Sun depression for Isha. Null when Isha is a fixed interval after Maghrib. */
    val ishaAngle: Double?,
    /** Minutes after Maghrib, used instead of [ishaAngle] (Umm al-Qura, Qatar). */
    val ishaInterval: Double?,
    /** Ramadan override for [ishaInterval] (Umm al-Qura uses 120). */
    val ramadanIshaInterval: Double?,
    /** Sun depression for Maghrib. Null means at sunset (Jafari uses 4.5°). */
    val maghribAngle: Double?,
    /** Precautionary minutes added before rounding up. */
    val offsets: Map<Prayer, Double>,
    /** True when the angles and offsets reproduce an authority's own published timetable. */
    val matchesOfficialTable: Boolean,
    val note: String,
) {
    val parameterSummary: String
        get() {
            val isha = ishaAngle?.let { "Isha ${format(it)}°" } ?: "Isha +${(ishaInterval ?: 0.0).toInt()} min"
            return "Fajr ${format(fajrAngle)}° · $isha"
        }

    companion object {
        private fun format(v: Double): String =
            if (Math.rint(v) == v) v.toInt().toString() else String.format(java.util.Locale.US, "%.1f", v)

        val MUIS = CalculationMethod(
            "muis", "MUIS · Singapore", "MUIS", 20.0, 18.0, null, null, null,
            mapOf(Prayer.FAJR to 0.625, Prayer.SUNRISE to -0.375, Prayer.DHUHR to 1.5, Prayer.ASR to 0.5,
                Prayer.MAGHRIB to 0.875, Prayer.ISHA to 0.5),
            true,
            "Majlis Ugama Islam Singapura. Online, the app shows MUIS's official timetable; offline it calculates, never earlier than the official time.")

        val JAKIM = CalculationMethod(
            "jakim", "JAKIM · Malaysia", "JAKIM", 18.0, 18.0, null, null, null,
            mapOf(Prayer.FAJR to 2.375, Prayer.SUNRISE to -1.375, Prayer.DHUHR to 3.0, Prayer.ASR to 2.25,
                Prayer.MAGHRIB to 2.25, Prayer.ISHA to 2.375),
            true,
            "Malaysia's 18° Subuh criterion (since 2019). Online, the app shows JAKIM's official e-Solat timetable for your zone; offline it calculates to within about 2 minutes.")

        val KEMENAG = CalculationMethod(
            "kemenag", "Kemenag · Indonesia", "Kemenag", 20.0, 18.0, null, null, null,
            mapOf(Prayer.FAJR to 2.25, Prayer.SUNRISE to -4.5, Prayer.DHUHR to 3.25, Prayer.ASR to 2.5,
                Prayer.MAGHRIB to 3.25, Prayer.ISHA to 2.5),
            true,
            "Kementerian Agama. Online, the app shows Kemenag's official timetable for your city or regency; offline it calculates with offsets fitted on the full 2026 Jakarta, Surabaya and Makassar tables.")

        val SOUTHEAST_ASIA = CalculationMethod(
            "sea", "Southeast Asia standard", "SEA 20°/18°", 20.0, 18.0, null, null, null,
            mapOf(Prayer.DHUHR to 1.0), false,
            "The 20°/18° convention used across the Malay world. A sensible default where no national timetable exists.")

        val MWL = CalculationMethod(
            "mwl", "Muslim World League", "MWL", 18.0, 17.0, null, null, null, emptyMap(), false,
            "The most widely used international convention; common in East Asia.")

        val KARACHI = CalculationMethod(
            "karachi", "Karachi · University of Islamic Sciences", "Karachi", 18.0, 18.0, null, null, null, emptyMap(), false,
            "Standard across Pakistan, India, Bangladesh and Afghanistan.")

        val UMM_AL_QURA = CalculationMethod(
            "ummalqura", "Umm al-Qura · Makkah", "Umm al-Qura", 18.5, null, 90.0, 120.0, null, emptyMap(), false,
            "Saudi Arabia. Isha is 90 minutes after Maghrib, 120 in Ramadan.")

        val DUBAI = CalculationMethod(
            "dubai", "Dubai · UAE", "UAE", 18.2, 18.2, null, null, null,
            mapOf(Prayer.SUNRISE to -3.0, Prayer.DHUHR to 3.0, Prayer.ASR to 3.0, Prayer.MAGHRIB to 3.0), false,
            "United Arab Emirates convention.")

        val QATAR = CalculationMethod(
            "qatar", "Qatar", "Qatar", 18.0, null, 90.0, null, null, emptyMap(), false,
            "Isha 90 minutes after Maghrib.")

        val KUWAIT = CalculationMethod(
            "kuwait", "Kuwait", "Kuwait", 18.0, 17.5, null, null, null, emptyMap(), false, "Kuwait convention.")

        val TURKEY = CalculationMethod(
            "diyanet", "Diyanet · Türkiye", "Diyanet", 18.0, 17.0, null, null, null,
            mapOf(Prayer.SUNRISE to -7.0, Prayer.DHUHR to 5.0, Prayer.ASR to 4.0, Prayer.MAGHRIB to 7.0), false,
            "An approximation of the Diyanet method; most accurate within Türkiye.")

        val TEHRAN = CalculationMethod(
            "tehran", "Tehran · Jafari", "Jafari", 17.7, 14.0, null, null, 4.5, emptyMap(), false,
            "Institute of Geophysics, University of Tehran. Maghrib when the sun is 4.5° below the horizon.")

        val EGYPTIAN = CalculationMethod(
            "egyptian", "Egyptian General Authority", "Egypt", 19.5, 17.5, null, null, null, emptyMap(), false,
            "Common in the Levant.")

        val all: List<CalculationMethod> = listOf(
            MUIS, JAKIM, KEMENAG, SOUTHEAST_ASIA, MWL, KARACHI, UMM_AL_QURA, DUBAI, QATAR, KUWAIT, TURKEY, TEHRAN, EGYPTIAN,
        )

        fun withId(id: String?): CalculationMethod? = all.firstOrNull { it.id == id }
    }
}
