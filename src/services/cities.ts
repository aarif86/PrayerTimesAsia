import { distanceKm } from '../core/geo'
import type { Place } from '../core/place'
import { profileFor, timeZoneForPlace } from '../core/regions'

/**
 * Built-in places, so choosing a city works offline and sends nothing anywhere.
 * [name, region, country, latitude, longitude, district (Kemenag regency) or zone override]
 */
type Row = [string, string, string, number, number, string?]

const ROWS: Row[] = [
  // Singapore
  ['Pasir Ris', 'East', 'SG', 1.3721, 103.9474], ['Tampines', 'East', 'SG', 1.3496, 103.9568],
  ['Bedok', 'East', 'SG', 1.3236, 103.9273], ['Changi', 'East', 'SG', 1.3644, 103.9915],
  ['Marine Parade', 'East', 'SG', 1.3020, 103.9070], ['Geylang', 'Central', 'SG', 1.3201, 103.8918],
  ['Kampong Glam', 'Central', 'SG', 1.3022, 103.8590], ['Singapore City', 'Central', 'SG', 1.2903, 103.8519],
  ['Kallang', 'Central', 'SG', 1.3100, 103.8650], ['Toa Payoh', 'Central', 'SG', 1.3343, 103.8563],
  ['Bishan', 'Central', 'SG', 1.3526, 103.8352], ['Queenstown', 'Central', 'SG', 1.2942, 103.7861],
  ['Bukit Merah', 'Central', 'SG', 1.2819, 103.8239], ['Ang Mo Kio', 'North-East', 'SG', 1.3691, 103.8454],
  ['Serangoon', 'North-East', 'SG', 1.3554, 103.8679], ['Hougang', 'North-East', 'SG', 1.3612, 103.8863],
  ['Sengkang', 'North-East', 'SG', 1.3868, 103.8914], ['Punggol', 'North-East', 'SG', 1.3984, 103.9072],
  ['Woodlands', 'North', 'SG', 1.4382, 103.7890], ['Yishun', 'North', 'SG', 1.4304, 103.8354],
  ['Sembawang', 'North', 'SG', 1.4491, 103.8185], ['Jurong East', 'West', 'SG', 1.3329, 103.7436],
  ['Jurong West', 'West', 'SG', 1.3404, 103.7090], ['Clementi', 'West', 'SG', 1.3162, 103.7649],
  ['Bukit Batok', 'West', 'SG', 1.3590, 103.7637], ['Bukit Panjang', 'West', 'SG', 1.3774, 103.7719],
  ['Choa Chu Kang', 'West', 'SG', 1.3840, 103.7470],
  // Malaysia
  ['Kuala Lumpur', 'Wilayah Persekutuan', 'MY', 3.1390, 101.6869], ['Putrajaya', 'Wilayah Persekutuan', 'MY', 2.9264, 101.6964],
  ['Shah Alam', 'Selangor', 'MY', 3.0733, 101.5185], ['Petaling Jaya', 'Selangor', 'MY', 3.1073, 101.6067],
  ['Klang', 'Selangor', 'MY', 3.0449, 101.4456], ['Johor Bahru', 'Johor', 'MY', 1.4927, 103.7414],
  ['Muar', 'Johor', 'MY', 2.0442, 102.5689], ['Batu Pahat', 'Johor', 'MY', 1.8548, 102.9325],
  ['Melaka', 'Melaka', 'MY', 2.1896, 102.2501], ['Seremban', 'Negeri Sembilan', 'MY', 2.7259, 101.9378],
  ['Ipoh', 'Perak', 'MY', 4.5975, 101.0901], ['George Town', 'Pulau Pinang', 'MY', 5.4141, 100.3288],
  ['Alor Setar', 'Kedah', 'MY', 6.1248, 100.3678], ['Langkawi', 'Kedah', 'MY', 6.3500, 99.8000],
  ['Kangar', 'Perlis', 'MY', 6.4414, 100.1986], ['Kota Bharu', 'Kelantan', 'MY', 6.1254, 102.2381],
  ['Kuala Terengganu', 'Terengganu', 'MY', 5.3296, 103.1370], ['Kuantan', 'Pahang', 'MY', 3.8077, 103.3260],
  ['Cameron Highlands', 'Pahang', 'MY', 4.4718, 101.3767], ['Kota Kinabalu', 'Sabah', 'MY', 5.9804, 116.0735],
  ['Sandakan', 'Sabah', 'MY', 5.8402, 118.1179], ['Tawau', 'Sabah', 'MY', 4.2448, 117.8912],
  ['Labuan', 'Wilayah Persekutuan', 'MY', 5.2831, 115.2308], ['Kuching', 'Sarawak', 'MY', 1.5535, 110.3593],
  ['Sibu', 'Sarawak', 'MY', 2.2870, 111.8305], ['Bintulu', 'Sarawak', 'MY', 3.1700, 113.0300],
  ['Miri', 'Sarawak', 'MY', 4.3995, 113.9914],
  // Brunei
  ['Bandar Seri Begawan', 'Brunei-Muara', 'BN', 4.9031, 114.9398],
  // Indonesia (district = the Kemenag city/regency)
  ['Jakarta', 'DKI Jakarta', 'ID', -6.2088, 106.8456, 'Kota Jakarta'], ['Bogor', 'Jawa Barat', 'ID', -6.5950, 106.8166, 'Kota Bogor'],
  ['Depok', 'Jawa Barat', 'ID', -6.4025, 106.7942, 'Kota Depok'], ['Bekasi', 'Jawa Barat', 'ID', -6.2383, 106.9756, 'Kota Bekasi'],
  ['Tangerang', 'Banten', 'ID', -6.1783, 106.6319, 'Kota Tangerang'], ['Bandung', 'Jawa Barat', 'ID', -6.9175, 107.6191, 'Kota Bandung'],
  ['Semarang', 'Jawa Tengah', 'ID', -6.9667, 110.4167, 'Kota Semarang'], ['Surakarta (Solo)', 'Jawa Tengah', 'ID', -7.5755, 110.8243, 'Kota Surakarta'],
  ['Yogyakarta', 'DI Yogyakarta', 'ID', -7.7956, 110.3695, 'Kota Yogyakarta'], ['Surabaya', 'Jawa Timur', 'ID', -7.2575, 112.7521, 'Kota Surabaya'],
  ['Malang', 'Jawa Timur', 'ID', -7.9666, 112.6326, 'Kota Malang'], ['Denpasar', 'Bali', 'ID', -8.6705, 115.2126, 'Kota Denpasar'],
  ['Mataram', 'Nusa Tenggara Barat', 'ID', -8.5833, 116.1167, 'Kota Mataram'], ['Kupang', 'Nusa Tenggara Timur', 'ID', -10.1772, 123.6070, 'Kota Kupang'],
  ['Banda Aceh', 'Aceh', 'ID', 5.5483, 95.3238, 'Kota Banda Aceh'], ['Medan', 'Sumatera Utara', 'ID', 3.5952, 98.6722, 'Kota Medan'],
  ['Padang', 'Sumatera Barat', 'ID', -0.9471, 100.4172, 'Kota Padang'], ['Pekanbaru', 'Riau', 'ID', 0.5071, 101.4478, 'Kota Pekanbaru'],
  ['Batam', 'Kepulauan Riau', 'ID', 1.0456, 104.0305, 'Kota Batam'], ['Palembang', 'Sumatera Selatan', 'ID', -2.9761, 104.7754, 'Kota Palembang'],
  ['Pontianak', 'Kalimantan Barat', 'ID', -0.0263, 109.3425, 'Kota Pontianak'], ['Banjarmasin', 'Kalimantan Selatan', 'ID', -3.3186, 114.5944, 'Kota Banjarmasin'],
  ['Balikpapan', 'Kalimantan Timur', 'ID', -1.2379, 116.8529, 'Kota Balikpapan'], ['Samarinda', 'Kalimantan Timur', 'ID', -0.5022, 117.1536, 'Kota Samarinda'],
  ['Makassar', 'Sulawesi Selatan', 'ID', -5.1477, 119.4327, 'Kota Makassar'], ['Manado', 'Sulawesi Utara', 'ID', 1.4748, 124.8421, 'Kota Manado'],
  ['Ambon', 'Maluku', 'ID', -3.6954, 128.1814, 'Kota Ambon'], ['Jayapura', 'Papua', 'ID', -2.5337, 140.7181, 'Kota Jayapura'],
  // Mainland Southeast Asia and the Philippines
  ['Bangkok', 'Bangkok', 'TH', 13.7563, 100.5018], ['Hat Yai', 'Songkhla', 'TH', 7.0086, 100.4747],
  ['Pattani', 'Pattani', 'TH', 6.8697, 101.2508], ['Yala', 'Yala', 'TH', 6.5413, 101.2803],
  ['Narathiwat', 'Narathiwat', 'TH', 6.4255, 101.8253], ['Phuket', 'Phuket', 'TH', 7.8804, 98.3923],
  ['Krabi', 'Krabi', 'TH', 8.0863, 98.9063], ['Chiang Mai', 'Chiang Mai', 'TH', 18.7883, 98.9853],
  ['Hanoi', 'Hanoi', 'VN', 21.0285, 105.8542], ['Ho Chi Minh City', 'Ho Chi Minh City', 'VN', 10.7769, 106.7009],
  ['Da Nang', 'Da Nang', 'VN', 16.0544, 108.2022], ['Chau Doc', 'An Giang', 'VN', 10.7000, 105.1167],
  ['Phnom Penh', 'Phnom Penh', 'KH', 11.5564, 104.9282], ['Siem Reap', 'Siem Reap', 'KH', 13.3671, 103.8448],
  ['Vientiane', 'Vientiane', 'LA', 17.9757, 102.6331], ['Yangon', 'Yangon', 'MM', 16.8409, 96.1735],
  ['Mandalay', 'Mandalay', 'MM', 21.9588, 96.0891], ['Manila', 'Metro Manila', 'PH', 14.5995, 120.9842],
  ['Cebu City', 'Cebu', 'PH', 10.3157, 123.8854], ['Davao City', 'Davao', 'PH', 7.1907, 125.4553],
  ['Zamboanga City', 'Zamboanga', 'PH', 6.9214, 122.0790], ['Cotabato City', 'Maguindanao', 'PH', 7.2236, 124.2464],
  ['Marawi', 'Lanao del Sur', 'PH', 7.9986, 124.2928], ['Dili', 'Dili', 'TL', -8.5569, 125.5603],
  // East Asia
  ['Tokyo', 'Tokyo', 'JP', 35.6762, 139.6503], ['Osaka', 'Osaka', 'JP', 34.6937, 135.5023],
  ['Kyoto', 'Kyoto', 'JP', 35.0116, 135.7681], ['Nagoya', 'Aichi', 'JP', 35.1815, 136.9066],
  ['Kobe', 'Hyogo', 'JP', 34.6901, 135.1955], ['Hiroshima', 'Hiroshima', 'JP', 34.3853, 132.4553],
  ['Fukuoka', 'Fukuoka', 'JP', 33.5904, 130.4017], ['Sapporo', 'Hokkaido', 'JP', 43.0618, 141.3545],
  ['Naha', 'Okinawa', 'JP', 26.2124, 127.6809], ['Seoul', 'Seoul', 'KR', 37.5665, 126.9780],
  ['Incheon', 'Incheon', 'KR', 37.4563, 126.7052], ['Busan', 'Busan', 'KR', 35.1796, 129.0756],
  ['Jeju', 'Jeju', 'KR', 33.4996, 126.5312], ['Beijing', 'Beijing', 'CN', 39.9042, 116.4074],
  ['Shanghai', 'Shanghai', 'CN', 31.2304, 121.4737], ['Guangzhou', 'Guangdong', 'CN', 23.1291, 113.2644],
  ['Shenzhen', 'Guangdong', 'CN', 22.5431, 114.0579], ["Xi'an", 'Shaanxi', 'CN', 34.3416, 108.9398],
  ['Lanzhou', 'Gansu', 'CN', 36.0611, 103.8343], ['Yinchuan', 'Ningxia', 'CN', 38.4872, 106.2309],
  ['Kunming', 'Yunnan', 'CN', 25.0389, 102.7183], ['Chengdu', 'Sichuan', 'CN', 30.5728, 104.0668],
  ['Urumqi', 'Xinjiang', 'CN', 43.8256, 87.6168], ['Kashgar', 'Xinjiang', 'CN', 39.4704, 75.9898],
  ['Hong Kong', 'Hong Kong', 'HK', 22.3193, 114.1694], ['Macau', 'Macau', 'MO', 22.1987, 113.5439],
  ['Taipei', 'Taipei', 'TW', 25.0330, 121.5654], ['Ulaanbaatar', 'Ulaanbaatar', 'MN', 47.8864, 106.9057],
  // South Asia
  ['New Delhi', 'Delhi', 'IN', 28.6139, 77.2090], ['Mumbai', 'Maharashtra', 'IN', 19.0760, 72.8777],
  ['Hyderabad', 'Telangana', 'IN', 17.3850, 78.4867], ['Bengaluru', 'Karnataka', 'IN', 12.9716, 77.5946],
  ['Chennai', 'Tamil Nadu', 'IN', 13.0827, 80.2707], ['Kolkata', 'West Bengal', 'IN', 22.5726, 88.3639],
  ['Lucknow', 'Uttar Pradesh', 'IN', 26.8467, 80.9462], ['Ahmedabad', 'Gujarat', 'IN', 23.0225, 72.5714],
  ['Kozhikode', 'Kerala', 'IN', 11.2588, 75.7804], ['Srinagar', 'Jammu and Kashmir', 'IN', 34.0837, 74.7973],
  ['Karachi', 'Sindh', 'PK', 24.8607, 67.0011], ['Lahore', 'Punjab', 'PK', 31.5204, 74.3587],
  ['Islamabad', 'Islamabad', 'PK', 33.6844, 73.0479], ['Peshawar', 'Khyber Pakhtunkhwa', 'PK', 34.0151, 71.5249],
  ['Quetta', 'Balochistan', 'PK', 30.1798, 66.9750], ['Dhaka', 'Dhaka', 'BD', 23.8103, 90.4125],
  ['Chattogram', 'Chattogram', 'BD', 22.3569, 91.7832], ['Sylhet', 'Sylhet', 'BD', 24.8949, 91.8687],
  ['Kabul', 'Kabul', 'AF', 34.5553, 69.2075], ['Kathmandu', 'Bagmati', 'NP', 27.7172, 85.3240],
  ['Thimphu', 'Thimphu', 'BT', 27.4728, 89.6390], ['Colombo', 'Western', 'LK', 6.9271, 79.8612],
  ['Kandy', 'Central', 'LK', 7.2906, 80.6337], ['Malé', 'Kaafu', 'MV', 4.1755, 73.5093],
  // Central Asia
  ['Almaty', 'Almaty', 'KZ', 43.2220, 76.8512], ['Astana', 'Astana', 'KZ', 51.1694, 71.4491],
  ['Tashkent', 'Tashkent', 'UZ', 41.2995, 69.2401], ['Samarkand', 'Samarkand', 'UZ', 39.6270, 66.9750],
  ['Bukhara', 'Bukhara', 'UZ', 39.7681, 64.4556], ['Bishkek', 'Chuy', 'KG', 42.8746, 74.5698],
  ['Dushanbe', 'Dushanbe', 'TJ', 38.5598, 68.7870], ['Ashgabat', 'Ashgabat', 'TM', 37.9601, 58.3261],
  // West Asia
  ['Makkah', 'Makkah', 'SA', 21.4225, 39.8262], ['Madinah', 'Madinah', 'SA', 24.5247, 39.5692],
  ['Jeddah', 'Makkah', 'SA', 21.4858, 39.1925], ['Riyadh', 'Riyadh', 'SA', 24.7136, 46.6753],
  ['Dubai', 'Dubai', 'AE', 25.2048, 55.2708], ['Abu Dhabi', 'Abu Dhabi', 'AE', 24.4539, 54.3773],
  ['Doha', 'Doha', 'QA', 25.2854, 51.5310], ['Kuwait City', 'Al Asimah', 'KW', 29.3759, 47.9774],
  ['Manama', 'Capital', 'BH', 26.2285, 50.5860], ['Muscat', 'Muscat', 'OM', 23.5880, 58.3829],
  ["Sana'a", "Sana'a", 'YE', 15.3694, 44.1910], ['Amman', 'Amman', 'JO', 31.9454, 35.9284],
  ['Al-Quds (Jerusalem)', 'Al-Quds', 'PS', 31.7780, 35.2354], ['Gaza', 'Gaza', 'PS', 31.5017, 34.4668],
  ['Beirut', 'Beirut', 'LB', 33.8938, 35.5018], ['Damascus', 'Damascus', 'SY', 33.5138, 36.2765],
  ['Baghdad', 'Baghdad', 'IQ', 33.3152, 44.3661], ['Tehran', 'Tehran', 'IR', 35.6892, 51.3890],
  ['Mashhad', 'Razavi Khorasan', 'IR', 36.2605, 59.6168], ['Istanbul', 'Istanbul', 'TR', 41.0082, 28.9784],
  ['Ankara', 'Ankara', 'TR', 39.9334, 32.8597], ['Baku', 'Baku', 'AZ', 40.4093, 49.8671],
  ['Tbilisi', 'Tbilisi', 'GE', 41.7151, 44.8271], ['Yerevan', 'Yerevan', 'AM', 40.1792, 44.4991],
  ['Nicosia', 'Nicosia', 'CY', 35.1856, 33.3823],
]

/** A few places outside Asia that travellers and expatriates ask for (International method). */
const OUTSIDE: [string, string, string, string, number, number, string][] = [
  ['London', 'England', 'GB', 'United Kingdom', 51.5074, -0.1278, 'Europe/London'],
  ['Paris', 'Île-de-France', 'FR', 'France', 48.8566, 2.3522, 'Europe/Paris'],
  ['Berlin', 'Berlin', 'DE', 'Germany', 52.5200, 13.4050, 'Europe/Berlin'],
  ['Cairo', 'Cairo', 'EG', 'Egypt', 30.0444, 31.2357, 'Africa/Cairo'],
  ['Sydney', 'New South Wales', 'AU', 'Australia', -33.8688, 151.2093, 'Australia/Sydney'],
  ['Melbourne', 'Victoria', 'AU', 'Australia', -37.8136, 144.9631, 'Australia/Melbourne'],
  ['Perth', 'Western Australia', 'AU', 'Australia', -31.9505, 115.8605, 'Australia/Perth'],
  ['Auckland', 'Auckland', 'NZ', 'New Zealand', -36.8485, 174.7633, 'Pacific/Auckland'],
  ['New York', 'New York', 'US', 'United States', 40.7128, -74.0060, 'America/New_York'],
  ['Toronto', 'Ontario', 'CA', 'Canada', 43.6532, -79.3832, 'America/Toronto'],
]

function slug(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export const CITIES: Place[] = [
  ...ROWS.map(([name, region, code, lat, lng, district]) => ({
    id: `city-${code.toLowerCase()}-${slug(name)}`,
    name, region, countryCode: code, countryName: profileFor(code)?.name ?? code,
    timeZoneID: timeZoneForPlace(code, lng) ?? 'UTC',
    coordinates: { latitude: lat, longitude: lng },
    district: district ?? null,
  })),
  ...OUTSIDE.map(([name, region, code, country, lat, lng, tz]) => ({
    id: `city-${code.toLowerCase()}-${slug(name)}`,
    name, region, countryCode: code, countryName: country, timeZoneID: tz,
    coordinates: { latitude: lat, longitude: lng }, district: null,
  })),
]

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Matches on the start of any word of the name, region or country. */
export function searchCities(query: string, limit = 30): Place[] {
  const q = fold(query.trim())
  if (!q) return []
  const scored: [number, Place][] = []
  for (const p of CITIES) {
    const name = fold(p.name), rest = fold(`${p.region ?? ''} ${p.countryName ?? ''}`)
    let score = -1
    if (name.startsWith(q)) score = 0
    else if (name.split(/[\s()-]+/).some((w) => w.startsWith(q))) score = 1
    else if (rest.split(/\s+/).some((w) => w.startsWith(q))) score = 2
    else if (name.includes(q)) score = 3
    if (score >= 0) scored.push([score, p])
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name)).slice(0, limit).map((x) => x[1])
}

/** The nearest built-in place within `maxKm`, to name a GPS fix without sending it anywhere. */
export function nearestCity(lat: number, lng: number, maxKm = 25): Place | null {
  let best: Place | null = null, bestKm = Infinity
  for (const p of CITIES) {
    const km = distanceKm(p.coordinates, { latitude: lat, longitude: lng })
    if (km < bestKm) { best = p; bestKm = km }
  }
  return best && bestKm <= maxKm ? best : null
}
