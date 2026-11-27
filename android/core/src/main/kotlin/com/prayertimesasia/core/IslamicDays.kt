package com.prayertimesasia.core

/**
 * The days of the Islamic year that people look up most, for the month calendar
 * (tap the date on the Prayer screen). Reference only. The app never tells anyone
 * what to do on these days; the user's local religious authority does.
 *
 * Same list as web/src/core/islamicDays.ts and ios Core/IslamicDays.swift.
 */
enum class IslamicDayKind {
    NEW_YEAR, TASUA, ASHURA, MAULID, REJAB_START, ISRA_MIKRAJ, NISFU_SYAABAN,
    SIGHTING_RAMADAN, SIGHTING_SYAWAL, ZULHIJJAH_TEN, TARWIYAH,
    RAMADAN_START, NUZUL_QURAN, LAST_TEN, AIDILFITRI,
    ARAFAH, AIDILADHA, TASYRIK, WHITE_DAY,
}

data class IslamicDay(val kind: IslamicDayKind, val major: Boolean)

object IslamicDays {
    /** Key days of a Hijri date, most important first. White days (13 to 15) are a quiet extra. */
    fun of(h: Hijri.HijriDate): List<IslamicDay> {
        val out = mutableListOf<IslamicDay>()
        fun add(k: IslamicDayKind, major: Boolean = true) { out += IslamicDay(k, major) }
        val m = h.month
        val d = h.day
        if (m == 1 && d == 1) add(IslamicDayKind.NEW_YEAR)
        if (m == 1 && d == 9) add(IslamicDayKind.TASUA)
        if (m == 1 && d == 10) add(IslamicDayKind.ASHURA)
        if (m == 3 && d == 12) add(IslamicDayKind.MAULID)
        if (m == 7 && d == 1) add(IslamicDayKind.REJAB_START)
        if (m == 7 && d == 27) add(IslamicDayKind.ISRA_MIKRAJ)
        if (m == 8 && d == 15) add(IslamicDayKind.NISFU_SYAABAN)
        if (m == 8 && d == 29) add(IslamicDayKind.SIGHTING_RAMADAN)
        if (m == 9 && d == 1) add(IslamicDayKind.RAMADAN_START)
        if (m == 9 && d == 17) add(IslamicDayKind.NUZUL_QURAN)
        if (m == 9 && d >= 21) add(IslamicDayKind.LAST_TEN, false)
        if (m == 9 && d == 29) add(IslamicDayKind.SIGHTING_SYAWAL)
        if (m == 10 && d == 1) add(IslamicDayKind.AIDILFITRI)
        if (m == 12 && d in 1..7) add(IslamicDayKind.ZULHIJJAH_TEN, false)
        if (m == 12 && d == 8) add(IslamicDayKind.TARWIYAH)
        if (m == 12 && d == 9) add(IslamicDayKind.ARAFAH)
        if (m == 12 && d == 10) add(IslamicDayKind.AIDILADHA)
        if (m == 12 && d in 11..13) add(IslamicDayKind.TASYRIK, false)
        // The white days, except in Zulhijjah where 13 is a day of Tasyrik.
        if (d in 13..15 && !(m == 12 && d == 13) && m != 9) add(IslamicDayKind.WHITE_DAY, false)
        return out
    }

    /** Days listed under the month: the big days, plus the first day of each longer stretch. */
    fun listed(h: Hijri.HijriDate, k: IslamicDay): Boolean =
        k.major || (k.kind == IslamicDayKind.LAST_TEN && h.day == 21) || (k.kind == IslamicDayKind.TASYRIK && h.day == 11) ||
            (k.kind == IslamicDayKind.ZULHIJJAH_TEN && h.day == 1)

    private fun lang(s: NamingStyle): Int = when (s) { NamingStyle.MALAY -> 1; NamingStyle.INDONESIAN -> 2; else -> 0 }
    private fun idx(l: RamadanContent.Lang): Int = when (l) { RamadanContent.Lang.MS -> 1; RamadanContent.Lang.ID -> 2; RamadanContent.Lang.EN -> 0 }

    private val names: Map<IslamicDayKind, List<String>> = mapOf(
        IslamicDayKind.NEW_YEAR to listOf("Islamic New Year", "Awal Muharram", "Tahun Baru Islam"),
        IslamicDayKind.TASUA to listOf("Day of Tasu'a", "Hari Tasu'a", "Hari Tasu'a"),
        IslamicDayKind.ASHURA to listOf("Day of Ashura", "Hari Asyura", "Hari Asyura"),
        IslamicDayKind.REJAB_START to listOf("Rajab begins, a sacred month", "Awal Rejab, bulan haram", "Awal Rajab, bulan haram"),
        IslamicDayKind.SIGHTING_RAMADAN to listOf("Moon sighting for Ramadan", "Rukyah awal Ramadan", "Rukyatul hilal Ramadan"),
        IslamicDayKind.SIGHTING_SYAWAL to listOf("Moon sighting for Shawwal", "Rukyah awal Syawal", "Rukyatul hilal Syawal"),
        IslamicDayKind.ZULHIJJAH_TEN to listOf("First ten days of Dhul Hijjah", "Sepuluh hari awal Zulhijjah", "Sepuluh hari awal Zulhijjah"),
        IslamicDayKind.TARWIYAH to listOf("Day of Tarwiyah", "Hari Tarwiyah", "Hari Tarwiyah"),
        IslamicDayKind.MAULID to listOf("Prophet Muhammad's Birthday", "Maulidur Rasul", "Maulid Nabi"),
        IslamicDayKind.ISRA_MIKRAJ to listOf("Isra and Mi'raj", "Israk dan Mikraj", "Isra Mi'raj"),
        IslamicDayKind.NISFU_SYAABAN to listOf("Middle of Sha'ban", "Nisfu Syaaban", "Nisfu Sya'ban"),
        IslamicDayKind.RAMADAN_START to listOf("First day of Ramadan", "Awal Ramadan", "Awal Ramadan"),
        IslamicDayKind.NUZUL_QURAN to listOf("Nuzul al-Quran", "Nuzul al-Quran", "Nuzulul Quran"),
        IslamicDayKind.LAST_TEN to listOf("Last ten nights", "Sepuluh malam terakhir", "Sepuluh malam terakhir"),
        IslamicDayKind.AIDILFITRI to listOf("Eid al-Fitr", "Hari Raya Aidilfitri", "Idulfitri"),
        IslamicDayKind.ARAFAH to listOf("Day of Arafah", "Hari Arafah", "Hari Arafah"),
        IslamicDayKind.AIDILADHA to listOf("Eid al-Adha", "Hari Raya Aidiladha", "Iduladha"),
        IslamicDayKind.TASYRIK to listOf("Days of Tashriq", "Hari Tasyrik", "Hari Tasyrik"),
        IslamicDayKind.WHITE_DAY to listOf("White days", "Hari putih", "Ayyamul bidh"),
    )

    /** Short names that fit inside a calendar day. */
    private val short: Map<IslamicDayKind, List<String>> = mapOf(
        IslamicDayKind.NEW_YEAR to listOf("New Year", "Maal Hijrah", "Tahun Baru"),
        IslamicDayKind.TASUA to listOf("Tasu'a", "Tasu'a", "Tasu'a"),
        IslamicDayKind.ASHURA to listOf("Ashura", "Asyura", "Asyura"),
        IslamicDayKind.REJAB_START to listOf("Rajab", "Awal Rejab", "Awal Rajab"),
        IslamicDayKind.SIGHTING_RAMADAN to listOf("Moon sighting", "Rukyah", "Rukyat"),
        IslamicDayKind.SIGHTING_SYAWAL to listOf("Moon sighting", "Rukyah", "Rukyat"),
        IslamicDayKind.TARWIYAH to listOf("Tarwiyah", "Tarwiyah", "Tarwiyah"),
        IslamicDayKind.MAULID to listOf("Mawlid", "Maulid", "Maulid"),
        IslamicDayKind.ISRA_MIKRAJ to listOf("Isra Mi'raj", "Israk Mikraj", "Isra Mi'raj"),
        IslamicDayKind.NISFU_SYAABAN to listOf("Nisfu Sha'ban", "Nisfu Syaaban", "Nisfu Sya'ban"),
        IslamicDayKind.RAMADAN_START to listOf("Ramadan", "Awal Ramadan", "Awal Ramadan"),
        IslamicDayKind.NUZUL_QURAN to listOf("Nuzul Quran", "Nuzul Quran", "Nuzulul Quran"),
        IslamicDayKind.AIDILFITRI to listOf("Eid al-Fitr", "Aidilfitri", "Idulfitri"),
        IslamicDayKind.ARAFAH to listOf("Arafah", "Arafah", "Arafah"),
        IslamicDayKind.AIDILADHA to listOf("Eid al-Adha", "Aidiladha", "Iduladha"),
    )

    fun name(k: IslamicDayKind, s: NamingStyle): String = names.getValue(k)[lang(s)]
    fun shortName(k: IslamicDayKind, s: NamingStyle): String = (short[k] ?: names.getValue(k))[lang(s)]
    /** The same in the app language (not the prayer names setting). */
    fun name(k: IslamicDayKind, l: RamadanContent.Lang): String = names.getValue(k)[idx(l)]
    fun shortName(k: IslamicDayKind, l: RamadanContent.Lang): String = (short[k] ?: names.getValue(k))[idx(l)]

    /** Hijri month names short enough for a calendar day (English and Malay/Indonesian; others use the full name). */
    fun monthShort(month: Int, s: NamingStyle): String {
        val i = (month - 1).coerceIn(0, 11)
        return when (s) {
            NamingStyle.INDONESIAN -> s.hijriMonths[i]
            NamingStyle.MALAY -> listOf("Muharram", "Safar", "Rabiul Awal", "Rabiul Akhir", "Jamadil Awal", "Jamadil Akhir",
                "Rejab", "Syaaban", "Ramadan", "Syawal", "Zulkaedah", "Zulhijjah")[i]
            NamingStyle.INTERNATIONAL, NamingStyle.SOUTH_ASIAN -> listOf("Muharram", "Safar", "Rabi I", "Rabi II", "Jumada I", "Jumada II",
                "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhul Qa'dah", "Dhul Hijjah")[i]
            else -> s.hijriMonths[i]
        }
    }

    /** Words for the calendar, in the user's language. No colons or dashes. */
    class Words(
        val today: String, val and: String, val none: String, val print: String, val adjust: String, val adjustNone: String,
        val earlier: String, val later: String, val dayOff: String, val prayerTimes: String,
        val months: List<String>, val week: List<String>,
        val note: (String?) -> String, val notePublished: (String) -> String,
    )

    fun words(s: NamingStyle): Words = wordsAt(lang(s))
    fun words(l: RamadanContent.Lang): Words = wordsAt(idx(l))

    private fun wordsAt(i: Int): Words = when (i) {
        1 -> Words("Hari ini", "dan", "Tiada hari kebesaran bulan ini.", "Cetak kalendar setahun",
            "Anjak tarikh Hijrah", "Tidak dianjak", "Sehari lebih awal", "Sehari lebih lewat", "hari", "Waktu solat",
            listOf("Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"),
            listOf("Ahd", "Isn", "Sel", "Rab", "Kha", "Jum", "Sab"),
            { a -> if (a != null) "Ramadan dan Aidilfitri mengikut $a sebaik sahaja diumumkan. Tarikh lain dikira lebih awal dan mungkin berbeza sehari di tempat anda. Ikutlah pihak berkuasa agama tempatan anda."
                else "Tarikh dikira lebih awal dan mungkin berbeza sehari di tempat anda. Ikutlah pihak berkuasa agama tempatan anda." },
            { a -> "Tarikh ini mengikut takwim Islam $a. Ramadan dan Hari Raya mengikut pengumumannya. Ikutlah pihak berkuasa agama tempatan anda." })
        2 -> Words("Hari ini", "dan", "Tidak ada hari besar bulan ini.", "Cetak kalender setahun",
            "Geser tanggal Hijriah", "Tidak digeser", "Sehari lebih awal", "Sehari lebih lambat", "hari", "Jadwal salat",
            listOf("Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"),
            listOf("Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"),
            { a -> if (a != null) "Awal Ramadan dan Idulfitri mengikuti $a setelah diumumkan. Tanggal lain dihitung lebih dulu dan bisa berbeda sehari di daerah Anda. Ikuti otoritas keagamaan setempat."
                else "Tanggal dihitung lebih dulu dan bisa berbeda sehari di daerah Anda. Ikuti otoritas keagamaan setempat." },
            { a -> "Tanggal ini mengikuti kalender Islam $a. Awal Ramadan dan Lebaran mengikuti pengumumannya. Ikuti otoritas keagamaan setempat." })
        else -> Words("Today", "and", "No special days this month.", "Print the whole year",
            "Move the Hijri date", "Not moved", "One day earlier", "One day later", "day", "Prayer times",
            listOf("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"),
            listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"),
            { a -> if (a != null) "Ramadan and Eid al-Fitr follow $a once announced. Other days are worked out ahead and can be a day apart from your area. Follow your local religious authority."
                else "Dates are worked out ahead and can be a day apart from your area. Follow your local religious authority." },
            { a -> "These dates follow the $a Islamic calendar. Ramadan and Eid follow its announcement. Follow your local religious authority." })
    }
}
