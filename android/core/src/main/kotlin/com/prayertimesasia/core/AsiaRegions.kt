package com.prayertimesasia.core

/**
 * Where a country's times come from: the authority's timetable the app
 * downloads, the authority's own method calculated on the phone, or a standard
 * method where no authority's times can be used.
 */
enum class TimesSource { TABLE, AUTHORITY, STANDARD }

/**
 * What the app does by default in each country: whose times it follows, which
 * method, which Asr school, and how prayer names are spelled.
 *
 * This table is the heart of "travel mode": land in a new country and these
 * defaults switch automatically (unless the user pinned their own). The rows
 * live in data/countries.json (one copy for all three apps); edit that and run
 * tools/gen_countries.py, which writes Countries.kt.
 *
 * The owner's rule: the local official or state religious authority first; a
 * standard method only where no authority's times can be used, and the app says so.
 */
data class CountryProfile(
    /** ISO 3166-1 alpha-2. */
    val code: String,
    val name: String,
    val methodId: String,
    val asr: AsrSchool,
    val naming: NamingStyle,
    val source: TimesSource = TimesSource.STANDARD,
    /** Who sets the times, e.g. "Diyanet, Türkiye's Presidency of Religious Affairs". */
    val authority: String? = null,
    /** What the person should know here, e.g. which masjids differ. */
    val note: String? = null,
    /** The country's rule for short summer nights, used when the method has none of its own. */
    val highLatitude: HighLatitudeRule? = null,
) {
    /** The country's method, with the country's own rule for short summer nights. */
    val method: CalculationMethod
        get() = (CalculationMethod.withId(methodId) ?: CalculationMethod.MWL).withHighLatitude(highLatitude)

    /** A method picked in Settings, used here: keeps its own high-latitude rule, else takes the country's. */
    fun here(m: CalculationMethod): CalculationMethod =
        if (m.highLatitude == HighLatitudeRule.FALLBACK) m.withHighLatitude(highLatitude) else m

    val flag: String
        get() = code.uppercase().map { String(Character.toChars(127397 + it.code)) }.joinToString("")

    /** Where the times come from, in plain words. Same wording as the web and iPhone apps. */
    fun sourceSummary(method: CalculationMethod, pinned: Boolean, short: Boolean = false): String {
        if (short) {
            if (pinned) return "You chose ${method.name} in Settings."
            return when (source) {
                TimesSource.TABLE -> "Official timetable from ${authority ?: name}."
                TimesSource.AUTHORITY -> "Follows ${authority ?: name}."
                TimesSource.STANDARD -> "No official timetable here, so the app uses ${method.name}. Your local masjid may differ by a few minutes."
            }
        }
        if (pinned) {
            val auto = if (source == TimesSource.STANDARD) "the method most used here" else authority ?: "the local authority"
            return "You chose ${method.name} in Settings. Automatic would follow $auto."
        }
        return when (source) {
            TimesSource.TABLE ->
                "Official timetable from ${authority ?: name}. When it can't be downloaded, the app works it out with the same method."
            TimesSource.AUTHORITY ->
                "Follows ${authority ?: name}, worked out on your phone with their method so it works offline." + (note?.let { " $it" } ?: "")
            TimesSource.STANDARD ->
                (note ?: "No official timetable the app can use here yet, so it uses ${method.name}, a standard method.") +
                    " Your local masjid may differ by a few minutes. You can choose another method in Settings, or send us your masjid's timetable."
        }
    }
}

object AsiaRegions {
    val profiles: List<CountryProfile> = Countries.profiles

    private val byCode: Map<String, CountryProfile> = profiles.associateBy { it.code }

    fun profile(countryCode: String?): CountryProfile? = countryCode?.uppercase()?.let { byCode[it] }

    /** Somewhere not in the table: still works, with the international method. */
    val fallback = CountryProfile("", "Worldwide", "mwl", AsrSchool.STANDARD, NamingStyle.INTERNATIONAL,
        highLatitude = HighLatitudeRule.ANGLE)

    /**
     * Offline country guess from the phone's time zone, for when the phone has
     * GPS but no data to reverse-geocode (fresh off the plane, no roaming).
     */
    fun countryCode(timeZoneId: String): String? = Countries.timeZoneCountries[timeZoneId]

    /** A representative zone for a country (first match, sorted), for search results without a zone. */
    fun timeZoneId(country: String?): String? {
        val code = country?.uppercase() ?: return null
        return Countries.timeZoneCountries.filterValues { it == code }.keys.sorted().firstOrNull()
    }
}
