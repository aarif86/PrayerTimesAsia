package com.prayertimesasia.core

/**
 * What kind of time this is, in plain words, so nobody has to know what a grade means.
 *   PUBLISHED   copied from the timetable an authority publishes
 *   FORMULA     worked out on the phone with an authority's own published method
 *   MASJID      from a masjid's own timetable
 *   CALCULATED  worked out with a widely used international method
 *
 * Same rules as web/src/core/timeKind.ts and iPhone Core/TimeKind.swift.
 */
enum class TimeKind {
    PUBLISHED, FORMULA, MASJID, CALCULATED;

    companion object {
        /** Methods that belong to no single authority. Everything else is some authority's own method. */
        private val international = setOf("sea", "mwl", "karachi", "isna", "moonsighting")

        fun of(grade: SourceGrade, hasOfficialTimetable: Boolean, method: CalculationMethod): TimeKind = when {
            grade == SourceGrade.MASJID -> MASJID
            grade == SourceGrade.OFFICIAL -> if (hasOfficialTimetable) PUBLISHED else FORMULA
            grade == SourceGrade.CALCULATED && method.id !in international -> FORMULA
            else -> CALCULATED
        }

        /** The country whose authority owns this method (null for international methods). */
        fun methodCountry(method: CalculationMethod): CountryProfile? {
            if (method.id in international) return null
            return AsiaRegions.profiles.firstOrNull { it.methodId == method.id && it.source != TimesSource.STANDARD }
        }

        /**
         * The person pinned a method in Settings and is now in another country, so the
         * times follow a country they are not in. Returns that country, else null.
         */
        fun awayFromMethodCountry(pinned: Boolean, method: CalculationMethod, placeCountry: String?): CountryProfile? {
            if (!pinned || placeCountry.isNullOrEmpty()) return null
            val home = methodCountry(method) ?: return null
            return if (home.code != placeCountry.uppercase()) home else null
        }
    }
}
