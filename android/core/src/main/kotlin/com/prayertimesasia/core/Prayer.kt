package com.prayertimesasia.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * The six daily times shown in the app. [SUNRISE] (Syuruk) is not a prayer,
 * it marks the end of Subuh - shown, but never notified as a prayer.
 */
@Serializable
enum class Prayer(val raw: String) {
    @SerialName("fajr") FAJR("fajr"),
    @SerialName("sunrise") SUNRISE("sunrise"),
    @SerialName("dhuhr") DHUHR("dhuhr"),
    @SerialName("asr") ASR("asr"),
    @SerialName("maghrib") MAGHRIB("maghrib"),
    @SerialName("isha") ISHA("isha");

    val isObligatory: Boolean get() = this != SUNRISE

    fun name(style: NamingStyle, isFriday: Boolean = false): String {
        if (this == DHUHR && isFriday) return style.friday
        return style.names[this] ?: raw.replaceFirstChar { it.uppercase() }
    }

    companion object {
        val all: List<Prayer> = entries.toList()
        val obligatory: List<Prayer> = listOf(FAJR, DHUHR, ASR, MAGHRIB, ISHA)
        fun fromRaw(raw: String): Prayer? = entries.firstOrNull { it.raw == raw }
    }
}

/**
 * How prayer names are spelled. Muslims across Asia say the same prayers with
 * different words. The app uses *your* words (from your home, or your phone)
 * wherever you are, and shows the local word underneath when you travel - so a
 * Singaporean in Tokyo still reads "Subuh", and an Australian in Kuala Lumpur
 * reads "Fajr" with "Subuh" beneath it, as the masjid there writes it.
 */
@Serializable
enum class NamingStyle(val raw: String) {
    /** Raw value "arabic" is kept so saved preferences from iOS-era builds still decode. */
    @SerialName("arabic") INTERNATIONAL("arabic"),
    @SerialName("malay") MALAY("malay"),
    @SerialName("indonesian") INDONESIAN("indonesian"),
    @SerialName("southAsian") SOUTH_ASIAN("southAsian"),
    @SerialName("turkish") TURKISH("turkish");

    /** Short name, for "Subuh (Malay)" style captions. */
    val language: String
        get() = when (this) {
            INTERNATIONAL -> "International"
            MALAY -> "Malay"
            INDONESIAN -> "Indonesian"
            SOUTH_ASIAN -> "South Asian"
            TURKISH -> "Turkish"
        }

    val label: String
        get() = when (this) {
            INTERNATIONAL -> "International (Fajr, Dhuhr, Asr, Isha)"
            MALAY -> "Malay (Subuh, Zohor, Asar, Isyak)"
            INDONESIAN -> "Indonesian (Subuh, Dzuhur, Ashar, Isya)"
            SOUTH_ASIAN -> "South Asian (Fajr, Zuhr, Asr, Isha)"
            TURKISH -> "Turkish (Sabah, Öğle, İkindi, Yatsı)"
        }

    /**
     * Spellings follow each authority's own timetable: MUIS/JAKIM (Malay),
     * Kemenag (Indonesian), Diyanet (Turkish); International is the common
     * English transliteration.
     */
    val names: Map<Prayer, String>
        get() = when (this) {
            INTERNATIONAL -> mapOf(Prayer.FAJR to "Fajr", Prayer.SUNRISE to "Sunrise", Prayer.DHUHR to "Dhuhr",
                Prayer.ASR to "Asr", Prayer.MAGHRIB to "Maghrib", Prayer.ISHA to "Isha")
            MALAY -> mapOf(Prayer.FAJR to "Subuh", Prayer.SUNRISE to "Syuruk", Prayer.DHUHR to "Zohor",
                Prayer.ASR to "Asar", Prayer.MAGHRIB to "Maghrib", Prayer.ISHA to "Isyak")
            INDONESIAN -> mapOf(Prayer.FAJR to "Subuh", Prayer.SUNRISE to "Terbit", Prayer.DHUHR to "Dzuhur",
                Prayer.ASR to "Ashar", Prayer.MAGHRIB to "Maghrib", Prayer.ISHA to "Isya")
            SOUTH_ASIAN -> mapOf(Prayer.FAJR to "Fajr", Prayer.SUNRISE to "Sunrise", Prayer.DHUHR to "Zuhr",
                Prayer.ASR to "Asr", Prayer.MAGHRIB to "Maghrib", Prayer.ISHA to "Isha")
            TURKISH -> mapOf(Prayer.FAJR to "Sabah", Prayer.SUNRISE to "Güneş", Prayer.DHUHR to "Öğle",
                Prayer.ASR to "İkindi", Prayer.MAGHRIB to "Akşam", Prayer.ISHA to "Yatsı")
        }

    val friday: String
        get() = when (this) {
            MALAY -> "Jumaat"
            INDONESIAN -> "Jumat"
            TURKISH -> "Cuma"
            INTERNATIONAL, SOUTH_ASIAN -> "Jumu'ah"
        }

    val hijriMonths: List<String>
        get() = when (this) {
            MALAY, INDONESIAN -> listOf("Muharram", "Safar", "Rabiulawal", "Rabiulakhir", "Jamadilawal", "Jamadilakhir",
                "Rejab", "Syaaban", "Ramadan", "Syawal", "Zulkaedah", "Zulhijjah")
            INTERNATIONAL, SOUTH_ASIAN, TURKISH -> listOf("Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani",
                "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qa'dah", "Dhu al-Hijjah")
        }

    companion object {
        /**
         * Your names, when you haven't picked any: your home country's, else your
         * phone's language or region, else International.
         *
         * [language] is an ISO 639 code; Android still reports Indonesian as "in".
         */
        fun personal(homeCountry: String?, language: String?, region: String?): NamingStyle {
            AsiaRegions.profile(homeCountry)?.let { return it.naming }
            when (language?.lowercase()) {
                "ms" -> return MALAY
                "id", "in" -> return INDONESIAN
                "tr" -> return TURKISH
                "ur", "bn" -> return SOUTH_ASIAN
            }
            return AsiaRegions.profile(region)?.naming ?: INTERNATIONAL
        }

        fun personal(homeCountry: String?, locale: java.util.Locale): NamingStyle =
            personal(homeCountry, locale.language, locale.country.ifEmpty { null })
    }
}

@Serializable
enum class AsrSchool(val raw: String) {
    /** Shafi'i, Maliki, Hanbali - shadow length equals object length. */
    @SerialName("standard") STANDARD("standard"),
    /** Shadow twice the object length. */
    @SerialName("hanafi") HANAFI("hanafi");

    val shadowFactor: Double get() = if (this == HANAFI) 2.0 else 1.0
    val label: String get() = if (this == HANAFI) "Hanafi" else "Shafi'i (standard)"
}
