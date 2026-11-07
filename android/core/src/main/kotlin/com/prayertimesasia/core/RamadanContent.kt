package com.prayertimesasia.core

/**
 * The Ramadan and Syawal words the app shows: doa, niat and the takbir, plus
 * where to pay zakat fitrah. Kept short on purpose and to be read by Ustaz
 * Aarif Raziff before launch. Same text as web/src/core/ramadanContent.ts and
 * ios Core/RamadanContent.swift.
 */
enum class DoaId { NIAT_PUASA, BERBUKA, BERBUKA_HADITH, QADR, TAKBIR, NIAT_SYAWAL, NIAT_QADHA }

data class Doa(val id: DoaId, val title: Words, val arabic: String, val rumi: String, val meaning: Words, val note: Words) {
    data class Words(val en: String, val ms: String, val id: String) {
        operator fun invoke(lang: RamadanContent.Lang): String = when (lang) {
            RamadanContent.Lang.MS -> ms
            RamadanContent.Lang.ID -> id
            RamadanContent.Lang.EN -> en
        }
    }
}

object RamadanContent {
    enum class Lang { EN, MS, ID }

    fun lang(style: NamingStyle): Lang = when (style) {
        NamingStyle.MALAY -> Lang.MS
        NamingStyle.INDONESIAN -> Lang.ID
        else -> Lang.EN
    }

    val allDoa: List<Doa> = listOf(
        Doa(
            DoaId.NIAT_PUASA,
            title = Doa.Words("Intention to fast (niat)", "Niat puasa Ramadan", "Niat puasa Ramadan"),
            arabic = "نَوَيْتُ صَوْمَ غَدٍ عَنْ أَدَاءِ فَرْضِ شَهْرِ رَمَضَانَ هَذِهِ السَّنَةِ لِلّٰهِ تَعَالَى",
            rumi = "Nawaitu sauma ghadin 'an adā'i fardhi syahri Ramadhāna hādzihis sanati lillāhi ta'ālā",
            meaning = Doa.Words("I intend to fast tomorrow, fulfilling the obligation of the month of Ramadan this year, for Allah Most High.", "Sahaja aku berpuasa esok hari menunaikan fardhu bulan Ramadan tahun ini kerana Allah Taala.", "Aku berniat puasa esok hari untuk menunaikan kewajiban bulan Ramadan tahun ini karena Allah Taala."),
            note = Doa.Words("Made in the heart each night before Subuh. Saying it helps.", "Niat di dalam hati setiap malam sebelum Subuh. Melafazkannya membantu.", "Diniatkan dalam hati setiap malam sebelum Subuh. Melafalkannya membantu."),
        ),
        Doa(
            DoaId.BERBUKA,
            title = Doa.Words("Dua when breaking the fast", "Doa berbuka puasa", "Doa berbuka puasa"),
            arabic = "اللَّهُمَّ لَكَ صُمْتُ وَبِكَ آمَنْتُ وَعَلَى رِزْقِكَ أَفْطَرْتُ",
            rumi = "Allāhumma laka sumtu wa bika āmantu wa 'alā rizqika aftartu",
            meaning = Doa.Words("O Allah, for You I fasted, in You I believe, and with Your provision I break my fast.", "Ya Allah, kerana-Mu aku berpuasa, kepada-Mu aku beriman, dan dengan rezeki-Mu aku berbuka.", "Ya Allah, untuk-Mu aku berpuasa, kepada-Mu aku beriman, dan dengan rezeki-Mu aku berbuka."),
            note = Doa.Words("Reported by Abu Dawud", "Riwayat Abu Daud", "Riwayat Abu Dawud"),
        ),
        Doa(
            DoaId.BERBUKA_HADITH,
            title = Doa.Words("After breaking the fast", "Selepas berbuka", "Setelah berbuka"),
            arabic = "ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللَّهُ",
            rumi = "Dzahabaz zama'u wabtallatil 'urūqu wa tsabatal ajru in syā Allāh",
            meaning = Doa.Words("The thirst is gone, the veins are moist, and the reward is certain, if Allah wills.", "Telah hilang dahaga, telah basah urat-urat, dan telah tetap pahala, insya-Allah.", "Telah hilang rasa haus, urat-urat telah basah, dan pahala telah tetap, insya Allah."),
            note = Doa.Words("Reported by Abu Dawud", "Riwayat Abu Daud", "Riwayat Abu Dawud"),
        ),
        Doa(
            DoaId.QADR,
            title = Doa.Words("Dua for Lailatul Qadr", "Doa Lailatul Qadar", "Doa Lailatul Qadar"),
            arabic = "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي",
            rumi = "Allāhumma innaka 'afuwwun tuhibbul 'afwa fa'fu 'annī",
            meaning = Doa.Words("O Allah, You are Most Forgiving and You love to forgive, so forgive me.", "Ya Allah, sesungguhnya Engkau Maha Pemaaf, Engkau suka memaafkan, maka maafkanlah aku.", "Ya Allah, sesungguhnya Engkau Maha Pemaaf dan menyukai maaf, maka maafkanlah aku."),
            note = Doa.Words("Taught by the Prophet ﷺ to Aisyah. Reported by at Tirmidhi", "Diajar Nabi ﷺ kepada Aisyah. Riwayat at Tirmizi", "Diajarkan Nabi ﷺ kepada Aisyah. Riwayat at Tirmidzi"),
        ),
        Doa(
            DoaId.TAKBIR,
            title = Doa.Words("Takbir Raya", "Takbir Raya", "Takbir Idul Fitri"),
            arabic = "اللهُ أَكْبَرُ اللهُ أَكْبَرُ اللهُ أَكْبَرُ، لَا إِلٰهَ إِلَّا اللهُ وَاللهُ أَكْبَرُ، اللهُ أَكْبَرُ وَلِلّٰهِ الْحَمْدُ",
            rumi = "Allāhu akbar, Allāhu akbar, Allāhu akbar. Lā ilāha illallāhu wallāhu akbar. Allāhu akbar wa lillāhil hamd.",
            meaning = Doa.Words("Allah is the Greatest (three times). There is no god but Allah, and Allah is the Greatest. Allah is the Greatest, and to Allah belongs all praise.", "Allah Maha Besar (tiga kali). Tiada Tuhan melainkan Allah, dan Allah Maha Besar. Allah Maha Besar, dan bagi Allah segala puji.", "Allah Maha Besar (tiga kali). Tiada Tuhan selain Allah, dan Allah Maha Besar. Allah Maha Besar, dan bagi Allah segala puji."),
            note = Doa.Words("From Maghrib on Raya eve until the Raya prayer begins.", "Dari Maghrib malam Raya hingga solat sunat Aidilfitri bermula.", "Dari Maghrib malam Idul Fitri hingga sholat Id dimulai."),
        ),
        Doa(
            DoaId.NIAT_SYAWAL,
            title = Doa.Words("Intention for the six days of Syawal", "Niat puasa enam Syawal", "Niat puasa Syawal"),
            arabic = "نَوَيْتُ صَوْمَ غَدٍ عَنْ سُنَّةِ السِّتَّةِ مِنْ شَوَّالٍ لِلّٰهِ تَعَالَى",
            rumi = "Nawaitu sauma ghadin 'an sunnatis sittati min Syawwālin lillāhi ta'ālā",
            meaning = Doa.Words("I intend to fast tomorrow, one of the six sunnah days of Syawal, for Allah Most High.", "Sahaja aku berpuasa esok hari sunat enam hari bulan Syawal kerana Allah Taala.", "Aku berniat puasa esok hari, sunnah enam hari bulan Syawal, karena Allah Taala."),
            note = Doa.Words("Fasting Ramadan then six days of Syawal is like fasting the whole year. Reported by Muslim", "Puasa Ramadan diikuti enam hari Syawal seperti berpuasa setahun. Riwayat Muslim", "Puasa Ramadan lalu enam hari Syawal seperti puasa setahun. Riwayat Muslim"),
        ),
        Doa(
            DoaId.NIAT_QADHA,
            title = Doa.Words("Intention to replace a missed fast", "Niat puasa ganti (qadha)", "Niat puasa qadha Ramadan"),
            arabic = "نَوَيْتُ صَوْمَ غَدٍ عَنْ قَضَاءِ فَرْضِ شَهْرِ رَمَضَانَ لِلّٰهِ تَعَالَى",
            rumi = "Nawaitu sauma ghadin 'an qadhā'i fardhi syahri Ramadhāna lillāhi ta'ālā",
            meaning = Doa.Words("I intend to fast tomorrow to replace an obligatory fast of Ramadan, for Allah Most High.", "Sahaja aku berpuasa esok hari menggantikan fardhu Ramadan kerana Allah Taala.", "Aku berniat puasa esok hari untuk mengqadha fardhu Ramadan karena Allah Taala."),
            note = Doa.Words("Replace missed days before the next Ramadan. Ask your local religious authority about fidyah.", "Ganti sebelum Ramadan akan datang. Tanya pihak berkuasa agama tempatan tentang fidyah.", "Ganti sebelum Ramadan berikutnya. Tanyakan kepada otoritas agama setempat tentang fidyah."),
        ),
    )

    fun doa(id: DoaId): Doa = allDoa.first { it.id == id }

    data class ZakatBody(val name: String, val url: String)

    /** Where zakat fitrah is paid, by country. Links go to the official bodies; no money passes through the app. */
    val zakat: Map<String, List<ZakatBody>> = mapOf(
        "SG" to listOf(ZakatBody("MUIS Zakat", "https://www.zakat.sg")),
        "MY" to listOf(
            ZakatBody("PPZ MAIWP (Wilayah Persekutuan)", "https://www.zakat.com.my"),
            ZakatBody("Lembaga Zakat Selangor", "https://www.zakatselangor.com.my"),
        ),
        "ID" to listOf(ZakatBody("BAZNAS", "https://baznas.go.id")),
        "BN" to listOf(ZakatBody("Majlis Ugama Islam Brunei", "https://www.muib.gov.bn")),
    )

    val zakatNote = Doa.Words(
        "Zakat fitrah is due from every Muslim who has enough for Raya, for themselves and those they support. Pay before the Raya prayer. Your authority sets this year's amount.",
        "Zakat fitrah wajib atas setiap Muslim yang cukup keperluan Raya, untuk diri dan tanggungannya. Bayar sebelum solat sunat Aidilfitri. Kadar tahun ini ditetapkan oleh pihak berkuasa agama anda.",
        "Zakat fitrah wajib bagi setiap Muslim yang memiliki kelebihan untuk hari raya, bagi dirinya dan tanggungannya. Bayar sebelum sholat Id. Besarnya ditetapkan oleh otoritas setempat.",
    )

    fun juzLink(juz: Int): String = "https://quran.com/juz/${juz.coerceIn(1, 30)}"
}
