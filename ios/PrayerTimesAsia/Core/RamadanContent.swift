import Foundation

/// The Ramadan and Syawal words the app shows: doa, niat and the takbir, plus
/// where to pay zakat fitrah. Kept short on purpose and to be read by Ustaz
/// Aarif Raziff before launch. Same text as web/src/core/ramadanContent.ts and
/// android core RamadanContent.kt.
struct Doa: Identifiable, Sendable {
    enum ID: String, Sendable { case niatPuasa, berbuka, berbukaHadith, qadr, takbir, niatSyawal, niatQadha }
    struct Words: Sendable {
        let en: String, ms: String, id: String
        func callAsFunction(_ lang: RamadanContent.Lang) -> String { lang == .ms ? ms : lang == .id ? self.id : en }
    }
    let id: ID
    let title: Words
    let arabic: String
    /// Read aloud, in the spelling used in Malaysia and Singapore.
    let rumi: String
    let meaning: Words
    let note: Words
}

enum RamadanContent {
    enum Lang: Sendable { case en, ms, id }
    static func lang(_ style: NamingStyle) -> Lang { style == .malay ? .ms : style == .indonesian ? .id : .en }

    static let allDoa: [Doa] = [
        Doa(id: .niatPuasa,
            title: .init(en: "Intention to fast (niat)", ms: "Niat puasa Ramadan", id: "Niat puasa Ramadan"),
            arabic: "نَوَيْتُ صَوْمَ غَدٍ عَنْ أَدَاءِ فَرْضِ شَهْرِ رَمَضَانَ هَذِهِ السَّنَةِ لِلّٰهِ تَعَالَى",
            rumi: "Nawaitu sauma ghadin 'an adā'i fardhi syahri Ramadhāna hādzihis sanati lillāhi ta'ālā",
            meaning: .init(en: "I intend to fast tomorrow, fulfilling the obligation of the month of Ramadan this year, for Allah Most High.", ms: "Sahaja aku berpuasa esok hari menunaikan fardhu bulan Ramadan tahun ini kerana Allah Taala.", id: "Aku berniat puasa esok hari untuk menunaikan kewajiban bulan Ramadan tahun ini karena Allah Taala."),
            note: .init(en: "Made in the heart each night before Subuh. Saying it helps.", ms: "Niat di dalam hati setiap malam sebelum Subuh. Melafazkannya membantu.", id: "Diniatkan dalam hati setiap malam sebelum Subuh. Melafalkannya membantu.")),
        Doa(id: .berbuka,
            title: .init(en: "Dua when breaking the fast", ms: "Doa berbuka puasa", id: "Doa berbuka puasa"),
            arabic: "اللَّهُمَّ لَكَ صُمْتُ وَبِكَ آمَنْتُ وَعَلَى رِزْقِكَ أَفْطَرْتُ",
            rumi: "Allāhumma laka sumtu wa bika āmantu wa 'alā rizqika aftartu",
            meaning: .init(en: "O Allah, for You I fasted, in You I believe, and with Your provision I break my fast.", ms: "Ya Allah, kerana-Mu aku berpuasa, kepada-Mu aku beriman, dan dengan rezeki-Mu aku berbuka.", id: "Ya Allah, untuk-Mu aku berpuasa, kepada-Mu aku beriman, dan dengan rezeki-Mu aku berbuka."),
            note: .init(en: "Reported by Abu Dawud", ms: "Riwayat Abu Daud", id: "Riwayat Abu Dawud")),
        Doa(id: .berbukaHadith,
            title: .init(en: "After breaking the fast", ms: "Selepas berbuka", id: "Setelah berbuka"),
            arabic: "ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللَّهُ",
            rumi: "Dzahabaz zama'u wabtallatil 'urūqu wa tsabatal ajru in syā Allāh",
            meaning: .init(en: "The thirst is gone, the veins are moist, and the reward is certain, if Allah wills.", ms: "Telah hilang dahaga, telah basah urat-urat, dan telah tetap pahala, insya-Allah.", id: "Telah hilang rasa haus, urat-urat telah basah, dan pahala telah tetap, insya Allah."),
            note: .init(en: "Reported by Abu Dawud", ms: "Riwayat Abu Daud", id: "Riwayat Abu Dawud")),
        Doa(id: .qadr,
            title: .init(en: "Dua for Lailatul Qadr", ms: "Doa Lailatul Qadar", id: "Doa Lailatul Qadar"),
            arabic: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي",
            rumi: "Allāhumma innaka 'afuwwun tuhibbul 'afwa fa'fu 'annī",
            meaning: .init(en: "O Allah, You are Most Forgiving and You love to forgive, so forgive me.", ms: "Ya Allah, sesungguhnya Engkau Maha Pemaaf, Engkau suka memaafkan, maka maafkanlah aku.", id: "Ya Allah, sesungguhnya Engkau Maha Pemaaf dan menyukai maaf, maka maafkanlah aku."),
            note: .init(en: "Taught by the Prophet ﷺ to Aisyah. Reported by at Tirmidhi", ms: "Diajar Nabi ﷺ kepada Aisyah. Riwayat at Tirmizi", id: "Diajarkan Nabi ﷺ kepada Aisyah. Riwayat at Tirmidzi")),
        Doa(id: .takbir,
            title: .init(en: "Takbir Raya", ms: "Takbir Raya", id: "Takbir Idul Fitri"),
            arabic: "اللهُ أَكْبَرُ اللهُ أَكْبَرُ اللهُ أَكْبَرُ، لَا إِلٰهَ إِلَّا اللهُ وَاللهُ أَكْبَرُ، اللهُ أَكْبَرُ وَلِلّٰهِ الْحَمْدُ",
            rumi: "Allāhu akbar, Allāhu akbar, Allāhu akbar. Lā ilāha illallāhu wallāhu akbar. Allāhu akbar wa lillāhil hamd.",
            meaning: .init(en: "Allah is the Greatest (three times). There is no god but Allah, and Allah is the Greatest. Allah is the Greatest, and to Allah belongs all praise.", ms: "Allah Maha Besar (tiga kali). Tiada Tuhan melainkan Allah, dan Allah Maha Besar. Allah Maha Besar, dan bagi Allah segala puji.", id: "Allah Maha Besar (tiga kali). Tiada Tuhan selain Allah, dan Allah Maha Besar. Allah Maha Besar, dan bagi Allah segala puji."),
            note: .init(en: "From Maghrib on Raya eve until the Raya prayer begins.", ms: "Dari Maghrib malam Raya hingga solat sunat Aidilfitri bermula.", id: "Dari Maghrib malam Idul Fitri hingga sholat Id dimulai.")),
        Doa(id: .niatSyawal,
            title: .init(en: "Intention for the six days of Syawal", ms: "Niat puasa enam Syawal", id: "Niat puasa Syawal"),
            arabic: "نَوَيْتُ صَوْمَ غَدٍ عَنْ سُنَّةِ السِّتَّةِ مِنْ شَوَّالٍ لِلّٰهِ تَعَالَى",
            rumi: "Nawaitu sauma ghadin 'an sunnatis sittati min Syawwālin lillāhi ta'ālā",
            meaning: .init(en: "I intend to fast tomorrow, one of the six sunnah days of Syawal, for Allah Most High.", ms: "Sahaja aku berpuasa esok hari sunat enam hari bulan Syawal kerana Allah Taala.", id: "Aku berniat puasa esok hari, sunnah enam hari bulan Syawal, karena Allah Taala."),
            note: .init(en: "Fasting Ramadan then six days of Syawal is like fasting the whole year. Reported by Muslim", ms: "Puasa Ramadan diikuti enam hari Syawal seperti berpuasa setahun. Riwayat Muslim", id: "Puasa Ramadan lalu enam hari Syawal seperti puasa setahun. Riwayat Muslim")),
        Doa(id: .niatQadha,
            title: .init(en: "Intention to replace a missed fast", ms: "Niat puasa ganti (qadha)", id: "Niat puasa qadha Ramadan"),
            arabic: "نَوَيْتُ صَوْمَ غَدٍ عَنْ قَضَاءِ فَرْضِ شَهْرِ رَمَضَانَ لِلّٰهِ تَعَالَى",
            rumi: "Nawaitu sauma ghadin 'an qadhā'i fardhi syahri Ramadhāna lillāhi ta'ālā",
            meaning: .init(en: "I intend to fast tomorrow to replace an obligatory fast of Ramadan, for Allah Most High.", ms: "Sahaja aku berpuasa esok hari menggantikan fardhu Ramadan kerana Allah Taala.", id: "Aku berniat puasa esok hari untuk mengqadha fardhu Ramadan karena Allah Taala."),
            note: .init(en: "Replace missed days before the next Ramadan. Ask your local religious authority about fidyah.", ms: "Ganti sebelum Ramadan akan datang. Tanya pihak berkuasa agama tempatan tentang fidyah.", id: "Ganti sebelum Ramadan berikutnya. Tanyakan kepada otoritas agama setempat tentang fidyah.")),
    ]

    static func doa(_ id: Doa.ID) -> Doa { allDoa.first { $0.id == id }! }

    /// Where zakat fitrah is paid, by country. Links go to the official bodies; no money passes through the app.
    struct ZakatBody: Hashable, Sendable { var name: String; var url: URL }
    static let zakat: [String: [ZakatBody]] = [
        "SG": [.init(name: "MUIS Zakat", url: URL(string: "https://www.zakat.sg")!)],
        "MY": [.init(name: "PPZ MAIWP (Wilayah Persekutuan)", url: URL(string: "https://www.zakat.com.my")!),
               .init(name: "Lembaga Zakat Selangor", url: URL(string: "https://www.zakatselangor.com.my")!)],
        "ID": [.init(name: "BAZNAS", url: URL(string: "https://baznas.go.id")!)],
        "BN": [.init(name: "Majlis Ugama Islam Brunei", url: URL(string: "https://www.muib.gov.bn")!)],
    ]

    static let zakatNote = Doa.Words(en: "Zakat fitrah is due from every Muslim who has enough for Raya, for themselves and those they support. Pay before the Raya prayer. Your authority sets this year's amount.", ms: "Zakat fitrah wajib atas setiap Muslim yang cukup keperluan Raya, untuk diri dan tanggungannya. Bayar sebelum solat sunat Aidilfitri. Kadar tahun ini ditetapkan oleh pihak berkuasa agama anda.", id: "Zakat fitrah wajib bagi setiap Muslim yang memiliki kelebihan untuk hari raya, bagi dirinya dan tanggungannya. Bayar sebelum sholat Id. Besarnya ditetapkan oleh otoritas setempat.")

    /// quran.com opens at the right juz in the browser or the Quran app the phone prefers.
    static func juzLink(_ juz: Int) -> URL { URL(string: "https://quran.com/juz/\(max(1, min(30, juz)))")! }
}

/// How a day's fast went. Only kept on the phone.
enum FastMark: String, Codable, CaseIterable, Sendable {
    case fasted, period, sick, travel, other, qadha, syawal
    static let missed: [FastMark] = [.period, .sick, .travel, .other]
    var isMissed: Bool { Self.missed.contains(self) }
    var label: String {
        switch self {
        case .fasted: "Fasted"
        case .period: "Period"
        case .sick: "Sick"
        case .travel: "Travelling"
        case .other: "Other reason"
        case .qadha: "Replaced a fast"
        case .syawal: "Syawal fast"
        }
    }
    var letter: String {
        switch self {
        case .period: "P"
        case .sick: "S"
        case .travel: "T"
        case .other: "O"
        case .qadha: "G"
        default: ""
        }
    }
}
