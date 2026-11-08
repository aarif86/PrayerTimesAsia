import Foundation

/// Short hadith and ayat shown around the app, chosen by Ustaz Aarif Raziff.
/// Every hadith was checked on sunnah.com (see ref). Generated from
/// web/src/core/hadith.ts, keep the three in step (android core HadithContent.kt).
struct Hadith: Identifiable, Sendable {
    enum ID: String, CaseIterable, Sendable { case fixedTimes, coolPrayers, syuruk, river, illness, fajrRakaat, nightPrayer, whiteDays, monThu, azan, iftar }
    let id: ID
    let arabic: String
    let meaning: Doa.Words
    /// Who said it and who narrated it.
    let source: Doa.Words
    /// Where to check it. Not shown.
    let ref: String

    /// The one line added under an alert: the meaning in quotes and the book.
    func alertLine(_ lang: RamadanContent.Lang) -> String {
        let book = source(lang).replacingOccurrences(of: #"^.*?(narrated by|riwayat) "#, with: "", options: .regularExpression)
        return "“\(meaning(lang))” \(book)"
    }

    static func of(_ id: ID) -> Hadith { all.first { $0.id == id }! }

    static let all: [Hadith] = [
        Hadith(
            id: .fixedTimes,
            arabic: "إِنَّ ٱلصَّلَوٰةَ كَانَتْ عَلَى ٱلْمُؤْمِنِينَ كِتَٰبًا مَّوْقُوتًا",
            meaning: .init(en: "Prayer has been set for the believers at fixed times.", ms: "Sesungguhnya solat itu kewajipan yang ditentukan waktunya ke atas orang beriman.", id: "Sesungguhnya salat itu kewajiban yang ditentukan waktunya atas orang beriman."),
            source: .init(en: "Surah an Nisa, ayah 103", ms: "Surah an Nisa, ayat 103", id: "Surah an Nisa, ayat 103"),
            ref: "Quran 4:103"),
        Hadith(
            id: .coolPrayers,
            arabic: "مَنْ صَلَّى الْبَرْدَيْنِ دَخَلَ الْجَنَّةَ",
            meaning: .init(en: "Whoever prays the two cool prayers, Subuh and Asar, will enter Paradise.", ms: "Sesiapa yang solat dua waktu sejuk, Subuh dan Asar, akan masuk syurga.", id: "Siapa yang salat dua waktu sejuk, Subuh dan Asar, akan masuk surga."),
            source: .init(en: "The Prophet ﷺ, narrated by al Bukhari", ms: "Sabda Nabi ﷺ, riwayat al Bukhari", id: "Sabda Nabi ﷺ, riwayat al Bukhari"),
            ref: "Sahih al Bukhari 574"),
        Hadith(
            id: .syuruk,
            arabic: "لاَ صَلاَةَ بَعْدَ الصُّبْحِ حَتَّى تَرْتَفِعَ الشَّمْسُ",
            meaning: .init(en: "No prayer after Subuh until the sun has risen. Syuruk is sunrise, when Subuh time ends. It is not a prayer.", ms: "Tiada solat selepas Subuh sehingga matahari naik. Syuruk ialah waktu matahari terbit, tamatnya waktu Subuh. Ia bukan waktu solat.", id: "Tidak ada salat setelah Subuh hingga matahari naik. Syuruk adalah terbit matahari, saat waktu Subuh berakhir. Ia bukan waktu salat."),
            source: .init(en: "The Prophet ﷺ, narrated by al Bukhari", ms: "Sabda Nabi ﷺ, riwayat al Bukhari", id: "Sabda Nabi ﷺ, riwayat al Bukhari"),
            ref: "Sahih al Bukhari 586"),
        Hadith(
            id: .river,
            arabic: "فَذَلِكَ مِثْلُ الصَّلَوَاتِ الْخَمْسِ يَمْحُو اللَّهُ بِهَا الْخَطَايَا",
            meaning: .init(en: "Like a river at your door you bathe in five times a day. That is like the five prayers. Allah wipes away sins with them.", ms: "Seperti sungai di depan pintu yang kamu mandi lima kali sehari. Begitulah solat lima waktu, Allah menghapuskan dosa dengannya.", id: "Seperti sungai di depan pintu yang kamu mandi lima kali sehari. Begitulah salat lima waktu, Allah menghapus dosa dengannya."),
            source: .init(en: "The Prophet ﷺ, narrated by al Bukhari", ms: "Sabda Nabi ﷺ, riwayat al Bukhari", id: "Sabda Nabi ﷺ, riwayat al Bukhari"),
            ref: "Sahih al Bukhari 528"),
        Hadith(
            id: .illness,
            arabic: "إِذَا مَرِضَ الْعَبْدُ أَوْ سَافَرَ كُتِبَ لَهُ مِثْلُ مَا كَانَ يَعْمَلُ مُقِيمًا صَحِيحًا",
            meaning: .init(en: "When a servant falls ill or travels, he gets the reward of what he used to do when well and at home.", ms: "Apabila seseorang sakit atau bermusafir, ditulis baginya pahala seperti amalannya ketika sihat dan bermukim.", id: "Apabila seorang hamba sakit atau bepergian, dicatat baginya pahala seperti amalannya ketika sehat dan bermukim."),
            source: .init(en: "The Prophet ﷺ, narrated by al Bukhari", ms: "Sabda Nabi ﷺ, riwayat al Bukhari", id: "Sabda Nabi ﷺ, riwayat al Bukhari"),
            ref: "Sahih al Bukhari 2996"),
        Hadith(
            id: .fajrRakaat,
            arabic: "رَكْعَتَا الْفَجْرِ خَيْرٌ مِنَ الدُّنْيَا وَمَا فِيهَا",
            meaning: .init(en: "The two rakaat of Fajr are better than the world and all in it.", ms: "Dua rakaat sebelum Subuh lebih baik daripada dunia dan segala isinya.", id: "Dua rakaat sebelum Subuh lebih baik daripada dunia dan seisinya."),
            source: .init(en: "The Prophet ﷺ, narrated by Muslim", ms: "Sabda Nabi ﷺ, riwayat Muslim", id: "Sabda Nabi ﷺ, riwayat Muslim"),
            ref: "Sahih Muslim 725a"),
        Hadith(
            id: .nightPrayer,
            arabic: "أَفْضَلُ الصَّلاَةِ بَعْدَ الْفَرِيضَةِ صَلاَةُ اللَّيْلِ",
            meaning: .init(en: "The best prayer after the fardhu is the night prayer.", ms: "Solat paling utama selepas solat fardhu ialah solat malam.", id: "Salat paling utama setelah salat fardu adalah salat malam."),
            source: .init(en: "The Prophet ﷺ, narrated by Muslim", ms: "Sabda Nabi ﷺ, riwayat Muslim", id: "Sabda Nabi ﷺ, riwayat Muslim"),
            ref: "Sahih Muslim 1163a"),
        Hadith(
            id: .whiteDays,
            arabic: "صَوْمُ ثَلاَثَةِ أَيَّامٍ صَوْمُ الدَّهْرِ كُلِّهِ",
            meaning: .init(en: "Fasting three days a month is like fasting the whole year.", ms: "Puasa tiga hari sebulan seperti berpuasa sepanjang tahun.", id: "Puasa tiga hari setiap bulan seperti puasa sepanjang tahun."),
            source: .init(en: "The Prophet ﷺ, narrated by al Bukhari", ms: "Sabda Nabi ﷺ, riwayat al Bukhari", id: "Sabda Nabi ﷺ, riwayat al Bukhari"),
            ref: "Sahih al Bukhari 1979"),
        Hadith(
            id: .monThu,
            arabic: "تُعْرَضُ الأَعْمَالُ يَوْمَ الاِثْنَيْنِ وَالْخَمِيسِ فَأُحِبُّ أَنْ يُعْرَضَ عَمَلِي وَأَنَا صَائِمٌ",
            meaning: .init(en: "Deeds are shown on Monday and Thursday, and I love that mine are shown while I am fasting.", ms: "Amalan dibentangkan pada hari Isnin dan Khamis, dan aku suka amalanku dibentangkan ketika aku berpuasa.", id: "Amal diperlihatkan pada hari Senin dan Kamis, dan aku suka amalku diperlihatkan saat aku berpuasa."),
            source: .init(en: "The Prophet ﷺ, narrated by at Tirmidhi", ms: "Sabda Nabi ﷺ, riwayat at Tirmizi", id: "Sabda Nabi ﷺ, riwayat at Tirmidzi"),
            ref: "Jami at Tirmidhi 747 (Hasan)"),
        Hadith(
            id: .azan,
            arabic: "إِذَا سَمِعْتُمُ النِّدَاءَ فَقُولُوا مِثْلَ مَا يَقُولُ الْمُؤَذِّنُ",
            meaning: .init(en: "When you hear the azan, say what the muazzin says.", ms: "Apabila kamu mendengar azan, ucapkanlah seperti yang diucapkan muazzin.", id: "Apabila kalian mendengar azan, ucapkanlah seperti yang diucapkan muazin."),
            source: .init(en: "The Prophet ﷺ, narrated by al Bukhari", ms: "Sabda Nabi ﷺ, riwayat al Bukhari", id: "Sabda Nabi ﷺ, riwayat al Bukhari"),
            ref: "Sahih al Bukhari 611"),
        Hadith(
            id: .iftar,
            arabic: "مَنْ فَطَّرَ صَائِمًا كَانَ لَهُ مِثْلُ أَجْرِهِ",
            meaning: .init(en: "Whoever gives iftar to a fasting person gets the same reward as him.", ms: "Sesiapa memberi makan orang berbuka, dia mendapat pahala seperti orang itu.", id: "Siapa yang memberi makan orang berbuka, ia mendapat pahala seperti orang itu."),
            source: .init(en: "The Prophet ﷺ, narrated by at Tirmidhi", ms: "Sabda Nabi ﷺ, riwayat at Tirmizi", id: "Sabda Nabi ﷺ, riwayat at Tirmidzi"),
            ref: "Jami at Tirmidhi 807 (Sahih)"),
    ]
}
