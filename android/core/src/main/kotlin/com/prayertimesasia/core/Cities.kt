package com.prayertimesasia.core

/**
 * Cities across Asia for searching with no network and no geocoder (many
 * phones without Google services have none). Coordinates are city centres.
 */
object Cities {
    data class City(val name: String, val region: String?, val country: String, val lat: Double, val lng: Double, val zone: String) {
        fun place(): Place = Place(
            name = name, region = region, countryCode = country,
            countryName = AsiaRegions.profile(country)?.name, timeZoneId = zone,
            coordinates = Coordinates(lat, lng), district = if (country == "ID") name else null,
        )
    }

    val all: List<City> = listOf(
        City("Singapore", null, "SG", 1.3521, 103.8198, "Asia/Singapore"),
        City("Pasir Ris", "Singapore", "SG", 1.3721, 103.9474, "Asia/Singapore"),
        City("Woodlands", "Singapore", "SG", 1.4382, 103.7890, "Asia/Singapore"),
        City("Jurong West", "Singapore", "SG", 1.3404, 103.7090, "Asia/Singapore"),
        City("Kuala Lumpur", null, "MY", 3.1390, 101.6869, "Asia/Kuala_Lumpur"),
        City("Putrajaya", null, "MY", 2.9264, 101.6964, "Asia/Kuala_Lumpur"),
        City("Shah Alam", "Selangor", "MY", 3.0733, 101.5185, "Asia/Kuala_Lumpur"),
        City("Johor Bahru", "Johor", "MY", 1.4927, 103.7414, "Asia/Kuala_Lumpur"),
        City("George Town", "Penang", "MY", 5.4141, 100.3288, "Asia/Kuala_Lumpur"),
        City("Ipoh", "Perak", "MY", 4.5975, 101.0901, "Asia/Kuala_Lumpur"),
        City("Melaka", null, "MY", 2.1896, 102.2501, "Asia/Kuala_Lumpur"),
        City("Kota Bharu", "Kelantan", "MY", 6.1254, 102.2381, "Asia/Kuala_Lumpur"),
        City("Kuala Terengganu", "Terengganu", "MY", 5.3302, 103.1408, "Asia/Kuala_Lumpur"),
        City("Kuantan", "Pahang", "MY", 3.8077, 103.3260, "Asia/Kuala_Lumpur"),
        City("Alor Setar", "Kedah", "MY", 6.1248, 100.3678, "Asia/Kuala_Lumpur"),
        City("Kuching", "Sarawak", "MY", 1.5535, 110.3593, "Asia/Kuching"),
        City("Kota Kinabalu", "Sabah", "MY", 5.9804, 116.0735, "Asia/Kuching"),
        City("Bandar Seri Begawan", null, "BN", 4.9031, 114.9398, "Asia/Brunei"),
        City("Jakarta", null, "ID", -6.2088, 106.8456, "Asia/Jakarta"),
        City("Bandung", "Jawa Barat", "ID", -6.9175, 107.6191, "Asia/Jakarta"),
        City("Bogor", "Jawa Barat", "ID", -6.5971, 106.8060, "Asia/Jakarta"),
        City("Surabaya", "Jawa Timur", "ID", -7.2575, 112.7521, "Asia/Jakarta"),
        City("Semarang", "Jawa Tengah", "ID", -6.9667, 110.4167, "Asia/Jakarta"),
        City("Yogyakarta", null, "ID", -7.7956, 110.3695, "Asia/Jakarta"),
        City("Medan", "Sumatera Utara", "ID", 3.5952, 98.6722, "Asia/Jakarta"),
        City("Banda Aceh", "Aceh", "ID", 5.5483, 95.3238, "Asia/Jakarta"),
        City("Padang", "Sumatera Barat", "ID", -0.9471, 100.4172, "Asia/Jakarta"),
        City("Palembang", "Sumatera Selatan", "ID", -2.9761, 104.7754, "Asia/Jakarta"),
        City("Pontianak", "Kalimantan Barat", "ID", -0.0263, 109.3425, "Asia/Pontianak"),
        City("Denpasar", "Bali", "ID", -8.6705, 115.2126, "Asia/Makassar"),
        City("Makassar", "Sulawesi Selatan", "ID", -5.1477, 119.4327, "Asia/Makassar"),
        City("Bangkok", null, "TH", 13.7563, 100.5018, "Asia/Bangkok"),
        City("Pattani", null, "TH", 6.8695, 101.2502, "Asia/Bangkok"),
        City("Phuket", null, "TH", 7.8804, 98.3923, "Asia/Bangkok"),
        City("Hanoi", null, "VN", 21.0285, 105.8542, "Asia/Ho_Chi_Minh"),
        City("Ho Chi Minh City", null, "VN", 10.8231, 106.6297, "Asia/Ho_Chi_Minh"),
        City("Phnom Penh", null, "KH", 11.5564, 104.9282, "Asia/Phnom_Penh"),
        City("Vientiane", null, "LA", 17.9757, 102.6331, "Asia/Vientiane"),
        City("Yangon", null, "MM", 16.8409, 96.1735, "Asia/Yangon"),
        City("Manila", null, "PH", 14.5995, 120.9842, "Asia/Manila"),
        City("Cotabato City", null, "PH", 7.2236, 124.2464, "Asia/Manila"),
        City("Dili", null, "TL", -8.5569, 125.5603, "Asia/Dili"),
        City("Tokyo", null, "JP", 35.6762, 139.6503, "Asia/Tokyo"),
        City("Osaka", null, "JP", 34.6937, 135.5023, "Asia/Tokyo"),
        City("Kyoto", null, "JP", 35.0116, 135.7681, "Asia/Tokyo"),
        City("Seoul", null, "KR", 37.5665, 126.9780, "Asia/Seoul"),
        City("Busan", null, "KR", 35.1796, 129.0756, "Asia/Seoul"),
        City("Beijing", null, "CN", 39.9042, 116.4074, "Asia/Shanghai"),
        City("Shanghai", null, "CN", 31.2304, 121.4737, "Asia/Shanghai"),
        City("Guangzhou", null, "CN", 23.1291, 113.2644, "Asia/Shanghai"),
        City("Xi'an", null, "CN", 34.3416, 108.9398, "Asia/Shanghai"),
        City("Urumqi", null, "CN", 43.8256, 87.6168, "Asia/Urumqi"),
        City("Taipei", null, "TW", 25.0330, 121.5654, "Asia/Taipei"),
        City("Hong Kong", null, "HK", 22.3193, 114.1694, "Asia/Hong_Kong"),
        City("Macau", null, "MO", 22.1987, 113.5439, "Asia/Macau"),
        City("Ulaanbaatar", null, "MN", 47.8864, 106.9057, "Asia/Ulaanbaatar"),
        City("New Delhi", null, "IN", 28.6139, 77.2090, "Asia/Kolkata"),
        City("Mumbai", null, "IN", 19.0760, 72.8777, "Asia/Kolkata"),
        City("Hyderabad", null, "IN", 17.3850, 78.4867, "Asia/Kolkata"),
        City("Kolkata", null, "IN", 22.5726, 88.3639, "Asia/Kolkata"),
        City("Chennai", null, "IN", 13.0827, 80.2707, "Asia/Kolkata"),
        City("Srinagar", null, "IN", 34.0837, 74.7973, "Asia/Kolkata"),
        City("Karachi", null, "PK", 24.8607, 67.0011, "Asia/Karachi"),
        City("Lahore", null, "PK", 31.5204, 74.3587, "Asia/Karachi"),
        City("Islamabad", null, "PK", 33.6844, 73.0479, "Asia/Karachi"),
        City("Dhaka", null, "BD", 23.8103, 90.4125, "Asia/Dhaka"),
        City("Chittagong", null, "BD", 22.3569, 91.7832, "Asia/Dhaka"),
        City("Kabul", null, "AF", 34.5553, 69.2075, "Asia/Kabul"),
        City("Kathmandu", null, "NP", 27.7172, 85.3240, "Asia/Kathmandu"),
        City("Thimphu", null, "BT", 27.4728, 89.6390, "Asia/Thimphu"),
        City("Colombo", null, "LK", 6.9271, 79.8612, "Asia/Colombo"),
        City("Malé", null, "MV", 4.1755, 73.5093, "Indian/Maldives"),
        City("Almaty", null, "KZ", 43.2220, 76.8512, "Asia/Almaty"),
        City("Astana", null, "KZ", 51.1694, 71.4491, "Asia/Almaty"),
        City("Tashkent", null, "UZ", 41.2995, 69.2401, "Asia/Tashkent"),
        City("Samarkand", null, "UZ", 39.6270, 66.9750, "Asia/Samarkand"),
        City("Bukhara", null, "UZ", 39.7681, 64.4556, "Asia/Samarkand"),
        City("Bishkek", null, "KG", 42.8746, 74.5698, "Asia/Bishkek"),
        City("Dushanbe", null, "TJ", 38.5598, 68.7870, "Asia/Dushanbe"),
        City("Ashgabat", null, "TM", 37.9601, 58.3261, "Asia/Ashgabat"),
        City("Makkah", null, "SA", 21.4225, 39.8262, "Asia/Riyadh"),
        City("Madinah", null, "SA", 24.5247, 39.5692, "Asia/Riyadh"),
        City("Jeddah", null, "SA", 21.4858, 39.1925, "Asia/Riyadh"),
        City("Riyadh", null, "SA", 24.7136, 46.6753, "Asia/Riyadh"),
        City("Dubai", null, "AE", 25.2048, 55.2708, "Asia/Dubai"),
        City("Abu Dhabi", null, "AE", 24.4539, 54.3773, "Asia/Dubai"),
        City("Doha", null, "QA", 25.2854, 51.5310, "Asia/Qatar"),
        City("Kuwait City", null, "KW", 29.3759, 47.9774, "Asia/Kuwait"),
        City("Manama", null, "BH", 26.2285, 50.5860, "Asia/Bahrain"),
        City("Muscat", null, "OM", 23.5880, 58.3829, "Asia/Muscat"),
        City("Sana'a", null, "YE", 15.3694, 44.1910, "Asia/Aden"),
        City("Amman", null, "JO", 31.9539, 35.9106, "Asia/Amman"),
        City("Jerusalem", null, "PS", 31.7683, 35.2137, "Asia/Hebron"),
        City("Beirut", null, "LB", 33.8938, 35.5018, "Asia/Beirut"),
        City("Damascus", null, "SY", 33.5138, 36.2765, "Asia/Damascus"),
        City("Baghdad", null, "IQ", 33.3152, 44.3661, "Asia/Baghdad"),
        City("Tehran", null, "IR", 35.6892, 51.3890, "Asia/Tehran"),
        City("Istanbul", null, "TR", 41.0082, 28.9784, "Europe/Istanbul"),
        City("Ankara", null, "TR", 39.9334, 32.8597, "Europe/Istanbul"),
        City("Baku", null, "AZ", 40.4093, 49.8671, "Asia/Baku"),
        City("Tbilisi", null, "GE", 41.7151, 44.8271, "Asia/Tbilisi"),
        City("Yerevan", null, "AM", 40.1792, 44.4991, "Asia/Yerevan"),
        City("Nicosia", null, "CY", 35.1856, 33.3823, "Asia/Nicosia"),
        City("London", null, "GB", 51.5074, -0.1278, "Europe/London"),
        City("Sydney", null, "AU", -33.8688, 151.2093, "Australia/Sydney"),
        City("Melbourne", null, "AU", -37.8136, 144.9631, "Australia/Melbourne"),
        City("Perth", null, "AU", -31.9505, 115.8605, "Australia/Perth"),
    )

    /**
     * The time zone for a point in [country]: the zone of the nearest listed city
     * there (Indonesia, Malaysia and China have several), else the country's first.
     */
    fun zoneFor(coordinates: Coordinates, country: String?): String? {
        val code = country?.uppercase() ?: return null
        val nearest = all.filter { it.country == code }.minByOrNull { Geo.distanceKm(coordinates, Coordinates(it.lat, it.lng)) }
        return nearest?.zone ?: AsiaRegions.timeZoneId(code)
    }

    /** Names starting with the query first, then containing it (accent-insensitive). */
    fun search(query: String, limit: Int = 12): List<City> {
        val q = fold(query.trim())
        if (q.isEmpty()) return emptyList()
        val countryHits = { c: City -> fold(AsiaRegions.profile(c.country)?.name ?: "").startsWith(q) }
        val starts = all.filter { fold(it.name).startsWith(q) }
        val contains = all.filter { it !in starts && (fold(it.name).contains(q) || fold(it.region ?: "").contains(q) || countryHits(it)) }
        return (starts + contains).take(limit)
    }

    private fun fold(s: String): String =
        java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "").lowercase()
}
