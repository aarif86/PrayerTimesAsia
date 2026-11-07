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
    @SerialName("turkish") TURKISH("turkish"),
    // The names in each language's own words and script. A native speaker
    // should check each one before launch.
    @SerialName("arabicScript") ARABIC_SCRIPT("arabicScript"),
    @SerialName("urdu") URDU("urdu"),
    @SerialName("bengali") BENGALI("bengali"),
    @SerialName("french") FRENCH("french");

    /** Written right to left. English sentences use International names instead. */
    val isRightToLeft: Boolean get() = this == ARABIC_SCRIPT || this == URDU

    /** Short name, for "Subuh (Malay)" style captions. */
    val language: String
        get() = when (this) {
            INTERNATIONAL -> "International"
            MALAY -> "Malay"
            INDONESIAN -> "Indonesian"
            SOUTH_ASIAN -> "South Asian"
            TURKISH -> "Turkish"
            ARABIC_SCRIPT -> "Arabic"
            URDU -> "Urdu"
            BENGALI -> "Bangla"
            FRENCH -> "French"
        }

    val label: String
        get() = when (this) {
            INTERNATIONAL -> "International (Fajr, Dhuhr, Asr, Isha)"
            MALAY -> "Malay (Subuh, Zohor, Asar, Isyak)"
            INDONESIAN -> "Indonesian (Subuh, Dzuhur, Ashar, Isya)"
            SOUTH_ASIAN -> "South Asian (Fajr, Zuhr, Asr, Isha)"
            TURKISH -> "Turkish (Sabah, Öğle, İkindi, Yatsı)"
            ARABIC_SCRIPT -> "Arabic (الفجر، الظهر، العصر)"
            URDU -> "Urdu (فجر، ظہر، عصر)"
            BENGALI -> "Bangla (ফজর, যোহর, আসর)"
            FRENCH -> "French (Fajr, Dhohr, Asr, Icha)"
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
            ARABIC_SCRIPT -> mapOf(Prayer.FAJR to "الفجر", Prayer.SUNRISE to "الشروق", Prayer.DHUHR to "الظهر",
                Prayer.ASR to "العصر", Prayer.MAGHRIB to "المغرب", Prayer.ISHA to "العشاء")
            URDU -> mapOf(Prayer.FAJR to "فجر", Prayer.SUNRISE to "طلوع آفتاب", Prayer.DHUHR to "ظہر",
                Prayer.ASR to "عصر", Prayer.MAGHRIB to "مغرب", Prayer.ISHA to "عشاء")
            BENGALI -> mapOf(Prayer.FAJR to "ফজর", Prayer.SUNRISE to "সূর্যোদয়", Prayer.DHUHR to "যোহর",
                Prayer.ASR to "আসর", Prayer.MAGHRIB to "মাগরিব", Prayer.ISHA to "এশা")
            FRENCH -> mapOf(Prayer.FAJR to "Fajr", Prayer.SUNRISE to "Chourouq", Prayer.DHUHR to "Dhohr",
                Prayer.ASR to "Asr", Prayer.MAGHRIB to "Maghrib", Prayer.ISHA to "Icha")
        }

    val friday: String
        get() = when (this) {
            MALAY -> "Jumaat"
            INDONESIAN -> "Jumat"
            TURKISH -> "Cuma"
            INTERNATIONAL, SOUTH_ASIAN -> "Jumu'ah"
            ARABIC_SCRIPT -> "الجمعة"
            URDU -> "جمعہ"
            BENGALI -> "জুমা"
            FRENCH -> "Joumou'a"
        }

    val hijriMonths: List<String>
        get() = when (this) {
            MALAY, INDONESIAN -> listOf("Muharram", "Safar", "Rabiulawal", "Rabiulakhir", "Jamadilawal", "Jamadilakhir",
                "Rejab", "Syaaban", "Ramadan", "Syawal", "Zulkaedah", "Zulhijjah")
            INTERNATIONAL, SOUTH_ASIAN -> listOf("Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani",
                "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qa'dah", "Dhu al-Hijjah")
            TURKISH -> listOf("Muharrem", "Safer", "Rebiülevvel", "Rebiülahir", "Cemaziyelevvel", "Cemaziyelahir",
                "Recep", "Şaban", "Ramazan", "Şevval", "Zilkade", "Zilhicce")
            ARABIC_SCRIPT -> listOf("محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
                "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة")
            URDU -> listOf("محرم", "صفر", "ربیع الاول", "ربیع الثانی", "جمادی الاول", "جمادی الثانی",
                "رجب", "شعبان", "رمضان", "شوال", "ذوالقعدہ", "ذوالحجہ")
            BENGALI -> listOf("মহররম", "সফর", "রবিউল আউয়াল", "রবিউস সানি", "জমাদিউল আউয়াল", "জমাদিউস সানি",
                "রজব", "শাবান", "রমজান", "শাওয়াল", "জিলকদ", "জিলহজ")
            FRENCH -> listOf("Mouharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Joumada al-Oula", "Joumada al-Akhira",
                "Rajab", "Chaabane", "Ramadan", "Chawwal", "Dhou al-Qida", "Dhou al-Hijja")
        }

    companion object {
        /**
         * Your names, when you haven't picked any: your phone's language when we
         * have names in it, else your home country's, else your region's, else
         * International. Read from the phone only, never from your IP address.
         *
         * [language] is an ISO 639 code; Android still reports Indonesian as "in".
         */
        fun personal(homeCountry: String?, language: String?, region: String?): NamingStyle {
            forLanguage(language)?.let { return it }
            // A home with its own spelling wins over an English phone.
            AsiaRegions.profile(homeCountry)?.let { if (it.naming != INTERNATIONAL) return it.naming }
            return AsiaRegions.profile(region)?.naming ?: INTERNATIONAL
        }

        /** The names that go with a language code (ISO 639). */
        fun forLanguage(language: String?): NamingStyle? = when (language?.lowercase()) {
            "ms" -> MALAY
            "id", "in" -> INDONESIAN
            "tr" -> TURKISH
            "ar" -> ARABIC_SCRIPT
            "ur" -> URDU
            "bn" -> BENGALI
            "fr" -> FRENCH
            else -> null
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
