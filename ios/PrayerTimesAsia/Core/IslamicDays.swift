import Foundation

/// The days of the Islamic year that people look up most, for the month
/// calendar (tap the date on the Prayer screen). Reference only. The app never
/// tells anyone what to do on these days; the user's local religious authority does.
///
/// Same list as web/src/core/islamicDays.ts and android core IslamicDays.kt.
enum IslamicDayKind: String, CaseIterable, Sendable {
    case newYear, tasua, ashura, maulid, rejabStart, israMikraj, nisfuSyaaban
    case sightingRamadan, sightingSyawal, zulhijjahTen, tarwiyah
    case ramadanStart, nuzulQuran, lastTen, aidilfitri
    case arafah, aidiladha, tasyrik, whiteDay
}

struct IslamicDay: Hashable, Sendable {
    var kind: IslamicDayKind
    var major: Bool
}

enum IslamicDays {
    /// Key days of a Hijri date, most important first. White days (13 to 15) are a quiet extra.
    static func of(_ h: Hijri.HijriDate) -> [IslamicDay] {
        var out: [IslamicDay] = []
        func add(_ k: IslamicDayKind, _ major: Bool = true) { out.append(IslamicDay(kind: k, major: major)) }
        let m = h.month, d = h.day
        if m == 1 && d == 1 { add(.newYear) }
        if m == 1 && d == 9 { add(.tasua) }
        if m == 1 && d == 10 { add(.ashura) }
        if m == 3 && d == 12 { add(.maulid) }
        if m == 7 && d == 1 { add(.rejabStart) }
        if m == 7 && d == 27 { add(.israMikraj) }
        if m == 8 && d == 15 { add(.nisfuSyaaban) }
        if m == 8 && d == 29 { add(.sightingRamadan) }
        if m == 9 && d == 1 { add(.ramadanStart) }
        if m == 9 && d == 17 { add(.nuzulQuran) }
        if m == 9 && d >= 21 { add(.lastTen, false) }
        if m == 9 && d == 29 { add(.sightingSyawal) }
        if m == 10 && d == 1 { add(.aidilfitri) }
        if m == 12 && (1...7).contains(d) { add(.zulhijjahTen, false) }
        if m == 12 && d == 8 { add(.tarwiyah) }
        if m == 12 && d == 9 { add(.arafah) }
        if m == 12 && d == 10 { add(.aidiladha) }
        if m == 12 && (11...13).contains(d) { add(.tasyrik, false) }
        // The white days, except in Zulhijjah where 13 is a day of Tasyrik.
        if (13...15).contains(d) && !(m == 12 && d == 13) && m != 9 { add(.whiteDay, false) }
        return out
    }

    /// Days listed under the month: the big days, plus the first day of each longer stretch.
    static func listed(_ h: Hijri.HijriDate, _ k: IslamicDay) -> Bool {
        k.major || (k.kind == .lastTen && h.day == 21) || (k.kind == .tasyrik && h.day == 11) || (k.kind == .zulhijjahTen && h.day == 1)
    }

    enum Lang { case en, ms, id }
    static func lang(_ s: NamingStyle) -> Lang { s == .malay ? .ms : s == .indonesian ? .id : .en }

    private static let names: [IslamicDayKind: (String, String, String)] = [
        .newYear: ("Islamic New Year", "Awal Muharram", "Tahun Baru Islam"),
        .tasua: ("Day of Tasu'a", "Hari Tasu'a", "Hari Tasu'a"),
        .ashura: ("Day of Ashura", "Hari Asyura", "Hari Asyura"),
        .rejabStart: ("Rajab begins, a sacred month", "Awal Rejab, bulan haram", "Awal Rajab, bulan haram"),
        .sightingRamadan: ("Moon sighting for Ramadan", "Rukyah awal Ramadan", "Rukyatul hilal Ramadan"),
        .sightingSyawal: ("Moon sighting for Shawwal", "Rukyah awal Syawal", "Rukyatul hilal Syawal"),
        .zulhijjahTen: ("First ten days of Dhul Hijjah", "Sepuluh hari awal Zulhijjah", "Sepuluh hari awal Zulhijjah"),
        .tarwiyah: ("Day of Tarwiyah", "Hari Tarwiyah", "Hari Tarwiyah"),
        .maulid: ("Prophet Muhammad's Birthday", "Maulidur Rasul", "Maulid Nabi"),
        .israMikraj: ("Isra and Mi'raj", "Israk dan Mikraj", "Isra Mi'raj"),
        .nisfuSyaaban: ("Middle of Sha'ban", "Nisfu Syaaban", "Nisfu Sya'ban"),
        .ramadanStart: ("First day of Ramadan", "Awal Ramadan", "Awal Ramadan"),
        .nuzulQuran: ("Nuzul al-Quran", "Nuzul al-Quran", "Nuzulul Quran"),
        .lastTen: ("Last ten nights", "Sepuluh malam terakhir", "Sepuluh malam terakhir"),
        .aidilfitri: ("Eid al-Fitr", "Hari Raya Aidilfitri", "Idulfitri"),
        .arafah: ("Day of Arafah", "Hari Arafah", "Hari Arafah"),
        .aidiladha: ("Eid al-Adha", "Hari Raya Aidiladha", "Iduladha"),
        .tasyrik: ("Days of Tashriq", "Hari Tasyrik", "Hari Tasyrik"),
        .whiteDay: ("White days", "Hari putih", "Ayyamul bidh"),
    ]

    /// Short names that fit inside a calendar day.
    private static let short: [IslamicDayKind: (String, String, String)] = [
        .newYear: ("New Year", "Maal Hijrah", "Tahun Baru"),
        .tasua: ("Tasu'a", "Tasu'a", "Tasu'a"),
        .ashura: ("Ashura", "Asyura", "Asyura"),
        .rejabStart: ("Rajab", "Awal Rejab", "Awal Rajab"),
        .sightingRamadan: ("Moon sighting", "Rukyah", "Rukyat"),
        .sightingSyawal: ("Moon sighting", "Rukyah", "Rukyat"),
        .tarwiyah: ("Tarwiyah", "Tarwiyah", "Tarwiyah"),
        .maulid: ("Mawlid", "Maulid", "Maulid"),
        .israMikraj: ("Isra Mi'raj", "Israk Mikraj", "Isra Mi'raj"),
        .nisfuSyaaban: ("Nisfu Sha'ban", "Nisfu Syaaban", "Nisfu Sya'ban"),
        .ramadanStart: ("Ramadan", "Awal Ramadan", "Awal Ramadan"),
        .nuzulQuran: ("Nuzul Quran", "Nuzul Quran", "Nuzulul Quran"),
        .aidilfitri: ("Eid al-Fitr", "Aidilfitri", "Idulfitri"),
        .arafah: ("Arafah", "Arafah", "Arafah"),
        .aidiladha: ("Eid al-Adha", "Aidiladha", "Iduladha"),
    ]

    private static func pick(_ t: (String, String, String), _ s: NamingStyle) -> String {
        switch lang(s) { case .en: t.0; case .ms: t.1; case .id: t.2 }
    }

    static func name(_ k: IslamicDayKind, _ s: NamingStyle) -> String { pick(names[k]!, s) }
    static func shortName(_ k: IslamicDayKind, _ s: NamingStyle) -> String { pick(short[k] ?? names[k]!, s) }

    /// Hijri month names short enough for a calendar day (English and Malay/Indonesian; others use the full name).
    static func monthShort(_ month: Int, _ s: NamingStyle) -> String {
        let i = max(0, min(11, month - 1))
        switch s {
        case .indonesian:
            return s.hijriMonths[i]
        case .malay:
            return ["Muharram", "Safar", "Rabiul Awal", "Rabiul Akhir", "Jamadil Awal", "Jamadil Akhir",
                    "Rejab", "Syaaban", "Ramadan", "Syawal", "Zulkaedah", "Zulhijjah"][i]
        case .international, .southAsian:
            return ["Muharram", "Safar", "Rabi I", "Rabi II", "Jumada I", "Jumada II",
                    "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhul Qa'dah", "Dhul Hijjah"][i]
        default:
            return s.hijriMonths[i]
        }
    }

    /// Words for the calendar, in the user's language. No colons or dashes.
    struct Words {
        let today, and, none, print, adjust, adjustNone, earlier, later, dayOff, prayerTimes: String
        let months, week: [String]
        let note: (String?) -> String
        let notePublished: (String) -> String
    }

    static func words(_ s: NamingStyle) -> Words {
        switch lang(s) {
        case .en:
            Words(today: "Today", and: "and", none: "No special days this month.", print: "Print the whole year",
                  adjust: "Move the Hijri date", adjustNone: "Not moved", earlier: "One day earlier", later: "One day later", dayOff: "day",
                  prayerTimes: "Prayer times",
                  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
                  week: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                  note: { a in a.map { "Ramadan and Eid al-Fitr follow \($0) once announced. Other days are worked out ahead and can be a day apart from your area. Follow your local religious authority." }
                      ?? "Dates are worked out ahead and can be a day apart from your area. Follow your local religious authority." },
                  notePublished: { "These dates follow the \($0) Islamic calendar. Ramadan and Eid follow its announcement. Follow your local religious authority." })
        case .ms:
            Words(today: "Hari ini", and: "dan", none: "Tiada hari kebesaran bulan ini.", print: "Cetak kalendar setahun",
                  adjust: "Anjak tarikh Hijrah", adjustNone: "Tidak dianjak", earlier: "Sehari lebih awal", later: "Sehari lebih lewat", dayOff: "hari",
                  prayerTimes: "Waktu solat",
                  months: ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"],
                  week: ["Ahd", "Isn", "Sel", "Rab", "Kha", "Jum", "Sab"],
                  note: { a in a.map { "Ramadan dan Aidilfitri mengikut \($0) sebaik sahaja diumumkan. Tarikh lain dikira lebih awal dan mungkin berbeza sehari di tempat anda. Ikutlah pihak berkuasa agama tempatan anda." }
                      ?? "Tarikh dikira lebih awal dan mungkin berbeza sehari di tempat anda. Ikutlah pihak berkuasa agama tempatan anda." },
                  notePublished: { "Tarikh ini mengikut takwim Islam \($0). Ramadan dan Hari Raya mengikut pengumumannya. Ikutlah pihak berkuasa agama tempatan anda." })
        case .id:
            Words(today: "Hari ini", and: "dan", none: "Tidak ada hari besar bulan ini.", print: "Cetak kalender setahun",
                  adjust: "Geser tanggal Hijriah", adjustNone: "Tidak digeser", earlier: "Sehari lebih awal", later: "Sehari lebih lambat", dayOff: "hari",
                  prayerTimes: "Jadwal salat",
                  months: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
                  week: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"],
                  note: { a in a.map { "Awal Ramadan dan Idulfitri mengikuti \($0) setelah diumumkan. Tanggal lain dihitung lebih dulu dan bisa berbeda sehari di daerah Anda. Ikuti otoritas keagamaan setempat." }
                      ?? "Tanggal dihitung lebih dulu dan bisa berbeda sehari di daerah Anda. Ikuti otoritas keagamaan setempat." },
                  notePublished: { "Tanggal ini mengikuti kalender Islam \($0). Awal Ramadan dan Lebaran mengikuti pengumumannya. Ikuti otoritas keagamaan setempat." })
        }
    }
}
