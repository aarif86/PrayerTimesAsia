package com.prayertimesasia.core

/**
 * Short hadith and ayat shown around the app, chosen by Ustaz Aarif Raziff.
 * Every hadith was checked on sunnah.com (see ref). Generated from
 * web/src/core/hadith.ts, keep the three in step (ios Core/HadithContent.swift).
 */
/** [key] is the id the web and iPhone use, kept in the closed list. */
enum class HadithId(val key: String) { FIXED_TIMES("fixedTimes"), COOL_PRAYERS("coolPrayers"), SYURUK("syuruk"), RIVER("river"), ILLNESS("illness"), FAJR_RAKAAT("fajrRakaat"), NIGHT_PRAYER("nightPrayer"), WHITE_DAYS("whiteDays"), MON_THU("monThu"), AZAN("azan"), IFTAR("iftar"), FALAK_JIBRIL("falakJibril"), FALAK_DAWN("falakDawn"), FALAK_FEET("falakFeet"), LAST_THIRD("lastThird") }

data class Hadith(
    val id: HadithId,
    val arabic: String,
    val meaning: Doa.Words,
    /** Who said it and who narrated it. */
    val source: Doa.Words,
    /** Where to check it. Not shown. */
    val ref: String,
) {
    /** The one line added under an alert: the meaning in quotes and the book. */
    fun alertLine(lang: RamadanContent.Lang): String {
        val book = source(lang).replace(Regex("^.*?(narrated by|riwayat) "), "")
        return "“${meaning(lang)}” $book"
    }

    companion object {
        fun of(id: HadithId): Hadith = ALL.first { it.id == id }

        val ALL: List<Hadith> = listOf(
            Hadith(
                HadithId.FIXED_TIMES,
                "إِنَّ ٱلصَّلَوٰةَ كَانَتْ عَلَى ٱلْمُؤْمِنِينَ كِتَٰبًا مَّوْقُوتًا",
                Doa.Words("Prayer has been set for the believers at fixed times.", "Sesungguhnya solat itu kewajipan yang ditentukan waktunya ke atas orang beriman.", "Sesungguhnya salat itu kewajiban yang ditentukan waktunya atas orang beriman."),
                Doa.Words("Surah an Nisa, ayah 103", "Surah an Nisa, ayat 103", "Surah an Nisa, ayat 103"),
                "Quran 4:103",
            ),
            Hadith(
                HadithId.COOL_PRAYERS,
                "مَنْ صَلَّى الْبَرْدَيْنِ دَخَلَ الْجَنَّةَ",
                Doa.Words("Whoever prays the two cool prayers, Fajr and Asr, will enter Paradise.", "Sesiapa yang solat dua waktu sejuk, Subuh dan Asar, akan masuk syurga.", "Siapa yang salat dua waktu sejuk, Subuh dan Asar, akan masuk surga."),
                Doa.Words("The Prophet ﷺ, narrated by al Bukhari", "Sabda Nabi ﷺ, riwayat al Bukhari", "Sabda Nabi ﷺ, riwayat al Bukhari"),
                "Sahih al Bukhari 574",
            ),
            Hadith(
                HadithId.SYURUK,
                "لاَ صَلاَةَ بَعْدَ الصُّبْحِ حَتَّى تَرْتَفِعَ الشَّمْسُ",
                Doa.Words("No prayer after Fajr until the sun has risen. Sunrise is when Fajr time ends. It is not a prayer.", "Tiada solat selepas Subuh sehingga matahari naik. Syuruk ialah waktu matahari terbit, tamatnya waktu Subuh. Ia bukan waktu solat.", "Tidak ada salat setelah Subuh hingga matahari naik. Syuruk adalah terbit matahari, saat waktu Subuh berakhir. Ia bukan waktu salat."),
                Doa.Words("The Prophet ﷺ, narrated by al Bukhari", "Sabda Nabi ﷺ, riwayat al Bukhari", "Sabda Nabi ﷺ, riwayat al Bukhari"),
                "Sahih al Bukhari 586",
            ),
            Hadith(
                HadithId.RIVER,
                "فَذَلِكَ مِثْلُ الصَّلَوَاتِ الْخَمْسِ يَمْحُو اللَّهُ بِهَا الْخَطَايَا",
                Doa.Words("Like a river at your door you bathe in five times a day. That is like the five prayers. Allah wipes away sins with them.", "Seperti sungai di depan pintu yang kamu mandi lima kali sehari. Begitulah solat lima waktu, Allah menghapuskan dosa dengannya.", "Seperti sungai di depan pintu yang kamu mandi lima kali sehari. Begitulah salat lima waktu, Allah menghapus dosa dengannya."),
                Doa.Words("The Prophet ﷺ, narrated by al Bukhari", "Sabda Nabi ﷺ, riwayat al Bukhari", "Sabda Nabi ﷺ, riwayat al Bukhari"),
                "Sahih al Bukhari 528",
            ),
            Hadith(
                HadithId.ILLNESS,
                "إِذَا مَرِضَ الْعَبْدُ أَوْ سَافَرَ كُتِبَ لَهُ مِثْلُ مَا كَانَ يَعْمَلُ مُقِيمًا صَحِيحًا",
                Doa.Words("When a servant falls ill or travels, he gets the reward of what he used to do when well and at home.", "Apabila seseorang sakit atau bermusafir, ditulis baginya pahala seperti amalannya ketika sihat dan bermukim.", "Apabila seorang hamba sakit atau bepergian, dicatat baginya pahala seperti amalannya ketika sehat dan bermukim."),
                Doa.Words("The Prophet ﷺ, narrated by al Bukhari", "Sabda Nabi ﷺ, riwayat al Bukhari", "Sabda Nabi ﷺ, riwayat al Bukhari"),
                "Sahih al Bukhari 2996",
            ),
            Hadith(
                HadithId.FAJR_RAKAAT,
                "رَكْعَتَا الْفَجْرِ خَيْرٌ مِنَ الدُّنْيَا وَمَا فِيهَا",
                Doa.Words("The two rakaat of Fajr are better than the world and all in it.", "Dua rakaat sebelum Subuh lebih baik daripada dunia dan segala isinya.", "Dua rakaat sebelum Subuh lebih baik daripada dunia dan seisinya."),
                Doa.Words("The Prophet ﷺ, narrated by Muslim", "Sabda Nabi ﷺ, riwayat Muslim", "Sabda Nabi ﷺ, riwayat Muslim"),
                "Sahih Muslim 725a",
            ),
            Hadith(
                HadithId.NIGHT_PRAYER,
                "أَفْضَلُ الصَّلاَةِ بَعْدَ الْفَرِيضَةِ صَلاَةُ اللَّيْلِ",
                Doa.Words("The best prayer after the obligatory prayers is the night prayer.", "Solat paling utama selepas solat fardhu ialah solat malam.", "Salat paling utama setelah salat fardu adalah salat malam."),
                Doa.Words("The Prophet ﷺ, narrated by Muslim", "Sabda Nabi ﷺ, riwayat Muslim", "Sabda Nabi ﷺ, riwayat Muslim"),
                "Sahih Muslim 1163a",
            ),
            Hadith(
                HadithId.WHITE_DAYS,
                "صَوْمُ ثَلاَثَةِ أَيَّامٍ صَوْمُ الدَّهْرِ كُلِّهِ",
                Doa.Words("Fasting three days a month is like fasting the whole year.", "Puasa tiga hari sebulan seperti berpuasa sepanjang tahun.", "Puasa tiga hari setiap bulan seperti puasa sepanjang tahun."),
                Doa.Words("The Prophet ﷺ, narrated by al Bukhari", "Sabda Nabi ﷺ, riwayat al Bukhari", "Sabda Nabi ﷺ, riwayat al Bukhari"),
                "Sahih al Bukhari 1979",
            ),
            Hadith(
                HadithId.MON_THU,
                "تُعْرَضُ الأَعْمَالُ يَوْمَ الاِثْنَيْنِ وَالْخَمِيسِ فَأُحِبُّ أَنْ يُعْرَضَ عَمَلِي وَأَنَا صَائِمٌ",
                Doa.Words("Deeds are shown on Monday and Thursday, and I love that mine are shown while I am fasting.", "Amalan dibentangkan pada hari Isnin dan Khamis, dan aku suka amalanku dibentangkan ketika aku berpuasa.", "Amal diperlihatkan pada hari Senin dan Kamis, dan aku suka amalku diperlihatkan saat aku berpuasa."),
                Doa.Words("The Prophet ﷺ, narrated by at Tirmidhi", "Sabda Nabi ﷺ, riwayat at Tirmizi", "Sabda Nabi ﷺ, riwayat at Tirmidzi"),
                "Jami at Tirmidhi 747 (Hasan)",
            ),
            Hadith(
                HadithId.AZAN,
                "إِذَا سَمِعْتُمُ النِّدَاءَ فَقُولُوا مِثْلَ مَا يَقُولُ الْمُؤَذِّنُ",
                Doa.Words("When you hear the azan, say what the muazzin says.", "Apabila kamu mendengar azan, ucapkanlah seperti yang diucapkan muazzin.", "Apabila kalian mendengar azan, ucapkanlah seperti yang diucapkan muazin."),
                Doa.Words("The Prophet ﷺ, narrated by al Bukhari", "Sabda Nabi ﷺ, riwayat al Bukhari", "Sabda Nabi ﷺ, riwayat al Bukhari"),
                "Sahih al Bukhari 611",
            ),
            Hadith(
                HadithId.IFTAR,
                "مَنْ فَطَّرَ صَائِمًا كَانَ لَهُ مِثْلُ أَجْرِهِ",
                Doa.Words("Whoever gives iftar to a fasting person gets the same reward as him.", "Sesiapa memberi makan orang berbuka, dia mendapat pahala seperti orang itu.", "Siapa yang memberi makan orang berbuka, ia mendapat pahala seperti orang itu."),
                Doa.Words("The Prophet ﷺ, narrated by at Tirmidhi", "Sabda Nabi ﷺ, riwayat at Tirmizi", "Sabda Nabi ﷺ, riwayat at Tirmidzi"),
                "Jami at Tirmidhi 807 (Sahih)",
            ),
            Hadith(
                HadithId.FALAK_JIBRIL,
                "الْوَقْتُ فِيمَا بَيْنَ هَذَيْنِ الْوَقْتَيْنِ",
                Doa.Words("Jibril led me in prayer at the Kaaba on two days. The time is between these two times.", "Jibril mengimamiku di Kaabah selama dua hari. Waktunya ialah antara dua waktu ini.", "Jibril mengimamiku di Kakbah selama dua hari. Waktunya adalah di antara dua waktu ini."),
                Doa.Words("The Prophet ﷺ, narrated by Abu Dawud", "Sabda Nabi ﷺ, riwayat Abu Daud", "Sabda Nabi ﷺ, riwayat Abu Dawud"),
                "Sunan Abi Dawud 393 (Hasan Sahih, al Albani). Also Jami at Tirmidhi 149",
            ),
            Hadith(
                HadithId.FALAK_DAWN,
                "لَا يَغُرَّنَّكُمْ أَذَانُ بِلَالٍ وَلَا هَذَا الْبَيَاضُ حَتَّى يَسْتَطِيرَ هَكَذَا",
                Doa.Words("Do not let the azan of Bilal or this upright whiteness fool you, until the light spreads out like this.", "Jangan kamu tertipu oleh azan Bilal dan cahaya putih yang tegak ini, sehingga cahaya itu melebar begini.", "Jangan kalian tertipu oleh azan Bilal dan cahaya putih yang tegak ini, sampai cahaya itu melebar seperti ini."),
                Doa.Words("The Prophet ﷺ, narrated by Muslim", "Sabda Nabi ﷺ, riwayat Muslim", "Sabda Nabi ﷺ, riwayat Muslim"),
                "Sahih Muslim 1094b",
            ),
            Hadith(
                HadithId.FALAK_FEET,
                "كَانَ قَدْرُ صَلَاةِ رَسُولِ اللَّهِ ﷺ الظُّهْرَ فِي الصَّيْفِ ثَلَاثَةَ أَقْدَامٍ إِلَى خَمْسَةِ أَقْدَامٍ",
                Doa.Words("The shadow when the Prophet ﷺ prayed Dhuhr in summer was three to five feet, and in winter five to seven feet.", "Ukuran bayang ketika Rasulullah ﷺ solat Zohor pada musim panas ialah tiga hingga lima tapak kaki, dan pada musim sejuk lima hingga tujuh tapak kaki.", "Ukuran bayangan ketika Rasulullah ﷺ salat Zuhur pada musim panas adalah tiga sampai lima telapak kaki, dan pada musim dingin lima sampai tujuh telapak kaki."),
                Doa.Words("Ibn Masud, narrated by Abu Dawud", "Ibn Masud, riwayat Abu Daud", "Ibnu Masud, riwayat Abu Dawud"),
                "Sunan Abi Dawud 400 (Sahih, al Albani)",
            ),
            Hadith(
                HadithId.LAST_THIRD,
                "مَنْ يَدْعُونِي فَأَسْتَجِيبَ لَهُ",
                Doa.Words("Our Lord comes down to the lowest heaven when the last third of the night remains, and says, who calls on Me so I may answer him?", "Tuhan kita turun ke langit dunia ketika tinggal sepertiga malam terakhir, lalu berfirman, siapa yang berdoa kepada-Ku, nescaya Aku perkenankan.", "Tuhan kita turun ke langit dunia ketika tersisa sepertiga malam terakhir, lalu berfirman, siapa yang berdoa kepada-Ku, niscaya Aku kabulkan."),
                Doa.Words("The Prophet ﷺ, narrated by al Bukhari", "Sabda Nabi ﷺ, riwayat al Bukhari", "Sabda Nabi ﷺ, riwayat al Bukhari"),
                "Sahih al Bukhari 1145 (also Sahih Muslim 758a). Arabic is the clause quoted from the full hadith",
            ),
        )
    }
}
