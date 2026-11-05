package com.prayertimesasia.core

/**
 * The rule for nights when the sun barely gets below the twilight angle.
 * FALLBACK (the original rule) only steps in when the angle is never reached:
 * one seventh of the night. ANGLE, SEVENTH and MIDDLE cap Fajr and Isha at that
 * share of the night every day. MOONSIGHTING is the Moonsighting Committee's
 * seasonal rule. Same as the web and iPhone engines.
 */
enum class HighLatitudeRule { FALLBACK, ANGLE, SEVENTH, MIDDLE, MOONSIGHTING }

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
    /** What to do on nights when twilight barely ends; see [HighLatitudeRule]. */
    val highLatitude: HighLatitudeRule = HighLatitudeRule.FALLBACK,
) {
    /** The same method with another high-latitude rule (a country's own, see Countries.kt). */
    fun withHighLatitude(rule: HighLatitudeRule?): CalculationMethod =
        if (rule == null || rule == highLatitude) this else copy(highLatitude = rule)

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
            "The Muslim World League. The most widely used international method.")

        val KARACHI = CalculationMethod(
            "karachi", "Karachi · University of Islamic Sciences", "Karachi", 18.0, 18.0, null, null, null, emptyMap(), false,
            "Standard across Pakistan, India, Bangladesh and Afghanistan.")

        val UMM_AL_QURA = CalculationMethod(
            "ummalqura", "Umm al-Qura · Makkah", "Umm al-Qura", 18.5, null, 90.0, 120.0, null, emptyMap(), false,
            "The official calendar of Saudi Arabia, followed by the Haramain in Makkah and Madinah. Isha is 90 minutes after Maghrib, 120 in Ramadan.")

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
            mapOf(Prayer.SUNRISE to -7.25, Prayer.DHUHR to 4.75, Prayer.ASR to 3.25, Prayer.MAGHRIB to 5.875,
                Prayer.ISHA to -1.125), false,
            "Diyanet's method (Fajr 18°, Isha 17°, Asr at one shadow length), with precautionary minutes fitted on its published Istanbul timetable. Used by Turkish masjids across Europe too.",
            HighLatitudeRule.ANGLE)

        val TEHRAN = CalculationMethod(
            "tehran", "Tehran · Jafari", "Jafari", 17.7, 14.0, null, null, 4.5, emptyMap(), false,
            "Institute of Geophysics, University of Tehran. Maghrib when the sun is 4.5° below the horizon.")

        val EGYPTIAN = CalculationMethod(
            "egyptian", "Egyptian General Authority", "Egypt", 19.5, 17.5, null, null, null, emptyMap(), false,
            "The Egyptian General Authority of Survey. Also common in Syria, Libya and Sudan.")

        val ISNA = CalculationMethod(
            "isna", "ISNA · North America", "ISNA", 15.0, 15.0, null, null, null, emptyMap(), false,
            "The Islamic Society of North America. Followed by many masjids in the United States and Canada.",
            HighLatitudeRule.ANGLE)

        val MOONSIGHTING = CalculationMethod(
            "moonsighting", "Moonsighting Committee", "Moonsighting", 18.0, 18.0, null, null, null,
            mapOf(Prayer.DHUHR to 5.0, Prayer.MAGHRIB to 3.0), false,
            "Made for northern countries. Fajr and Isha follow the seasons so summer nights stay workable. Common in the UK, Ireland and North America.",
            HighLatitudeRule.MOONSIGHTING)

        val UOIF = CalculationMethod(
            "uoif", "Musulmans de France · 12°", "France 12°", 12.0, 12.0, null, null, null, emptyMap(), false,
            "The 12° angle used by Musulmans de France (formerly UOIF). Fajr is later and Isha earlier than most methods.",
            HighLatitudeRule.ANGLE)

        val RUSSIA = CalculationMethod(
            "russia", "Muslims of Russia", "Russia", 16.0, 15.0, null, null, null, emptyMap(), false,
            "The Spiritual Administration of Muslims of Russia.", HighLatitudeRule.ANGLE)

        val ALGERIA = CalculationMethod(
            "algeria", "Algeria", "Algeria", 18.0, 17.0, null, null, null, mapOf(Prayer.MAGHRIB to 3.0), false,
            "The method of Algeria's Ministry of Religious Affairs and Endowments.")

        val TUNISIA = CalculationMethod(
            "tunisia", "Tunisia", "Tunisia", 18.0, 18.0, null, null, null,
            mapOf(Prayer.DHUHR to 7.0, Prayer.MAGHRIB to 2.0), false,
            "The method of Tunisia's Ministry of Religious Affairs.")

        val MOROCCO = CalculationMethod(
            "morocco", "Morocco", "Morocco", 19.0, 17.0, null, null, null,
            mapOf(Prayer.DHUHR to 5.0, Prayer.MAGHRIB to 2.0), false,
            "The method of Morocco's Ministry of Habous and Islamic Affairs.")

        val JORDAN = CalculationMethod(
            "jordan", "Jordan", "Jordan", 18.0, 18.0, null, null, null, emptyMap(), false,
            "The method of Jordan's Ministry of Awqaf and Islamic Affairs. Also used in Palestine.")

        val all: List<CalculationMethod> = listOf(
            MUIS, JAKIM, KEMENAG, SOUTHEAST_ASIA, MWL, KARACHI, UMM_AL_QURA, DUBAI, QATAR, KUWAIT, TURKEY, TEHRAN, EGYPTIAN,
            ISNA, MOONSIGHTING, UOIF, RUSSIA, ALGERIA, TUNISIA, MOROCCO, JORDAN,
        )

        fun withId(id: String?): CalculationMethod? = all.firstOrNull { it.id == id }
    }
}
