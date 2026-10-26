package com.prayertimesasia.core

/**
 * What the app does by default in each Asian country: which authority's
 * method, which Asr school, and how prayer names are spelled.
 *
 * This table is the heart of "travel mode": land in a new country and these
 * defaults switch automatically (unless the user pinned their own).
 */
data class CountryProfile(
    /** ISO 3166-1 alpha-2. */
    val code: String,
    val name: String,
    val methodId: String,
    val asr: AsrSchool,
    val naming: NamingStyle,
) {
    val method: CalculationMethod get() = CalculationMethod.withId(methodId) ?: CalculationMethod.MWL

    val flag: String
        get() = code.uppercase().map { String(Character.toChars(127397 + it.code)) }.joinToString("")
}

object AsiaRegions {
    private fun p(code: String, name: String, method: String, asr: AsrSchool = AsrSchool.STANDARD,
                  naming: NamingStyle = NamingStyle.INTERNATIONAL) = CountryProfile(code, name, method, asr, naming)

    private val H = AsrSchool.HANAFI
    private val S = AsrSchool.STANDARD

    val profiles: List<CountryProfile> = listOf(
        // Southeast Asia
        p("SG", "Singapore", "muis", S, NamingStyle.MALAY),
        p("MY", "Malaysia", "jakim", S, NamingStyle.MALAY),
        p("BN", "Brunei", "sea", S, NamingStyle.MALAY),
        p("ID", "Indonesia", "kemenag", S, NamingStyle.INDONESIAN),
        p("TH", "Thailand", "sea"),
        p("VN", "Vietnam", "sea"),
        p("KH", "Cambodia", "sea"),
        p("LA", "Laos", "sea"),
        p("MM", "Myanmar", "sea"),
        p("PH", "Philippines", "sea"),
        p("TL", "Timor-Leste", "sea"),
        // East Asia
        p("JP", "Japan", "mwl"),
        p("KR", "South Korea", "mwl"),
        p("KP", "North Korea", "mwl"),
        p("CN", "China", "mwl", H),
        p("TW", "Taiwan", "mwl"),
        p("HK", "Hong Kong", "mwl"),
        p("MO", "Macau", "mwl"),
        p("MN", "Mongolia", "mwl", H),
        // South Asia
        p("IN", "India", "karachi", H, NamingStyle.SOUTH_ASIAN),
        p("PK", "Pakistan", "karachi", H, NamingStyle.SOUTH_ASIAN),
        p("BD", "Bangladesh", "karachi", H, NamingStyle.SOUTH_ASIAN),
        p("AF", "Afghanistan", "karachi", H, NamingStyle.SOUTH_ASIAN),
        p("NP", "Nepal", "karachi", H, NamingStyle.SOUTH_ASIAN),
        p("BT", "Bhutan", "karachi", H, NamingStyle.SOUTH_ASIAN),
        p("LK", "Sri Lanka", "karachi", S, NamingStyle.SOUTH_ASIAN),
        p("MV", "Maldives", "karachi", S, NamingStyle.SOUTH_ASIAN),
        // Central Asia
        p("KZ", "Kazakhstan", "mwl", H),
        p("UZ", "Uzbekistan", "mwl", H),
        p("KG", "Kyrgyzstan", "mwl", H),
        p("TJ", "Tajikistan", "mwl", H),
        p("TM", "Turkmenistan", "mwl", H),
        // West Asia
        p("SA", "Saudi Arabia", "ummalqura"),
        p("AE", "United Arab Emirates", "dubai"),
        p("QA", "Qatar", "qatar"),
        p("KW", "Kuwait", "kuwait"),
        p("BH", "Bahrain", "ummalqura"),
        p("OM", "Oman", "mwl"),
        p("YE", "Yemen", "mwl"),
        p("JO", "Jordan", "mwl"),
        p("PS", "Palestine", "mwl"),
        p("IL", "Israel", "mwl"),
        p("LB", "Lebanon", "mwl"),
        p("SY", "Syria", "egyptian"),
        p("IQ", "Iraq", "mwl"),
        p("IR", "Iran", "tehran"),
        p("TR", "Türkiye", "diyanet", H, NamingStyle.TURKISH),
        p("AZ", "Azerbaijan", "mwl"),
        p("GE", "Georgia", "mwl"),
        p("AM", "Armenia", "mwl"),
        p("CY", "Cyprus", "diyanet", H, NamingStyle.TURKISH),
    )

    private val byCode: Map<String, CountryProfile> = profiles.associateBy { it.code }

    fun profile(countryCode: String?): CountryProfile? = countryCode?.uppercase()?.let { byCode[it] }

    /** Used outside Asia: still works, with the international default. */
    val fallback = CountryProfile("", "Outside Asia", "mwl", AsrSchool.STANDARD, NamingStyle.INTERNATIONAL)

    /**
     * Offline country guess from the phone's time zone, for when the phone has
     * GPS but no data to reverse-geocode (fresh off the plane, no roaming).
     */
    fun countryCode(timeZoneId: String): String? = timeZoneCountries[timeZoneId]

    /** A representative zone for a country (first match, sorted), for search results without a zone. */
    fun timeZoneId(country: String?): String? {
        val code = country?.uppercase() ?: return null
        return timeZoneCountries.filterValues { it == code }.keys.sorted().firstOrNull()
    }

    private val timeZoneCountries: Map<String, String> = mapOf(
        "Asia/Singapore" to "SG", "Asia/Kuala_Lumpur" to "MY", "Asia/Kuching" to "MY", "Asia/Brunei" to "BN",
        "Asia/Jakarta" to "ID", "Asia/Pontianak" to "ID", "Asia/Makassar" to "ID", "Asia/Jayapura" to "ID",
        "Asia/Bangkok" to "TH", "Asia/Ho_Chi_Minh" to "VN", "Asia/Saigon" to "VN", "Asia/Phnom_Penh" to "KH",
        "Asia/Vientiane" to "LA", "Asia/Yangon" to "MM", "Asia/Rangoon" to "MM", "Asia/Manila" to "PH", "Asia/Dili" to "TL",
        "Asia/Tokyo" to "JP", "Asia/Seoul" to "KR", "Asia/Pyongyang" to "KP", "Asia/Shanghai" to "CN", "Asia/Urumqi" to "CN",
        "Asia/Taipei" to "TW", "Asia/Hong_Kong" to "HK", "Asia/Macau" to "MO", "Asia/Ulaanbaatar" to "MN",
        "Asia/Kolkata" to "IN", "Asia/Calcutta" to "IN", "Asia/Karachi" to "PK", "Asia/Dhaka" to "BD", "Asia/Kabul" to "AF",
        "Asia/Kathmandu" to "NP", "Asia/Thimphu" to "BT", "Asia/Colombo" to "LK", "Indian/Maldives" to "MV",
        "Asia/Almaty" to "KZ", "Asia/Tashkent" to "UZ", "Asia/Samarkand" to "UZ", "Asia/Bishkek" to "KG",
        "Asia/Dushanbe" to "TJ", "Asia/Ashgabat" to "TM",
        "Asia/Riyadh" to "SA", "Asia/Dubai" to "AE", "Asia/Qatar" to "QA", "Asia/Kuwait" to "KW", "Asia/Bahrain" to "BH",
        "Asia/Muscat" to "OM", "Asia/Aden" to "YE", "Asia/Amman" to "JO", "Asia/Gaza" to "PS", "Asia/Hebron" to "PS",
        "Asia/Jerusalem" to "IL", "Asia/Beirut" to "LB", "Asia/Damascus" to "SY", "Asia/Baghdad" to "IQ",
        "Asia/Tehran" to "IR", "Europe/Istanbul" to "TR", "Asia/Baku" to "AZ", "Asia/Tbilisi" to "GE",
        "Asia/Yerevan" to "AM", "Asia/Nicosia" to "CY",
    )
}
