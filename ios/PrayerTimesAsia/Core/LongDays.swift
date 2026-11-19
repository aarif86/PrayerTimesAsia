import Foundation

/// Long summer days far from the equator (students abroad, travellers).
///
/// In summer at high latitudes the sky never gets as dark as the method's Fajr
/// or Isha angle, so the engine's high latitude rule sets those two times. This
/// only notices that it happens, to show a short closable note. It never
/// changes a time.
///
/// Same rules as web/src/core/longDays.ts and android core LongDays.kt.
enum LongDays {
    /// True when, on this date, the sun at its lowest in the night stays above the
    /// method's Fajr or Isha angle (twilight never ends), so a high latitude rule
    /// sets Fajr and Isha.
    static func twilightLastsAllNight(year: Int, month: Int, day: Int, latitude: Double, method: CalculationMethod) -> Bool {
        if abs(latitude) < 40 { return false }
        let declination = Astro.sun(jd: Astro.julianDay(year: year, month: month, day: day) + 0.5).declination
        let lowest = abs(latitude + declination) - 90
        let angle = max(method.fajrAngle, method.ishaAngle ?? 0)
        return lowest > -angle
    }

    /// One note per place and summer. A southern summer (October to March) counts as the year it began in.
    static func key(year: Int, month: Int, latitude: Double, longitude: Double, countryCode: String?) -> String {
        let summer = latitude >= 0 ? year : (month <= 6 ? year - 1 : year)
        let code = (countryCode?.isEmpty == false ? countryCode : nil) ?? "xx"
        return "\(code):\(jsRound(latitude)):\(jsRound(longitude)):\(summer)"
    }

    /// Rounds halves up like JavaScript's Math.round, so all three apps make the same key.
    private static func jsRound(_ x: Double) -> Int { Int((x + 0.5).rounded(.down)) }

    struct Words {
        let title: String
        let body: (_ fajr: String, _ isha: String) -> String
        let close: String
    }

    /// DRAFT wording, waiting for the owner's approval.
    static func words(_ lang: RamadanContent.Lang) -> Words {
        switch lang {
        case .ms:
            return Words(
                title: "Siang yang panjang pada musim panas",
                body: { f, i in "Pada musim panas, langit di sini tidak gelap sepenuhnya, jadi waktu \(f) sangat awal dan waktu \(i) sangat lewat. Aplikasi menggunakan kaedah khas untuk dua waktu ini, sebab itu ia mungkin kelihatan luar biasa. Sila ikut jadual masjid berhampiran dan pihak berkuasa agama tempatan anda." },
                close: "Tutup")
        case .id:
            return Words(
                title: "Siang yang panjang di musim panas",
                body: { f, i in "Di musim panas, langit di sini tidak pernah gelap sepenuhnya, sehingga waktu \(f) sangat awal dan waktu \(i) sangat larut. Aplikasi memakai aturan khusus untuk dua waktu ini, karena itu waktunya bisa terlihat tidak biasa. Ikuti jadwal masjid setempat dan otoritas keagamaan setempat Anda." },
                close: "Tutup")
        case .en:
            return Words(
                title: "Long summer days here",
                body: { f, i in "In summer the sky here never gets fully dark, so \(f) comes very early and \(i) very late. The app uses a twilight rule for these two times, which is why they may look unusual. Please follow the timetable of your local masjid and your local religious authority." },
                close: "Close")
        }
    }
}
