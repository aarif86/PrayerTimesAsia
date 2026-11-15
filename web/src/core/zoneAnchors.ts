/**
 * Extra points for working out the time zone of a searched or GPS place in a
 * country with several zones, when the built-in city list has no city in that
 * zone (Novosibirsk, Manaus, Halifax, the Canary Islands...) or the nearest
 * listed city by longitude alone is in the wrong zone (Indianapolis is closer
 * in longitude to Chicago but keeps Eastern time; Salt Lake City is closer to
 * Phoenix, which has no summer time). The nearest point wins, so each border
 * has points on both sides. Only used for the zone, never shown as a city.
 *
 * [country, latitude, longitude, IANA zone]
 */
export const ZONE_ANCHORS: [string, number, number, string][] = [
  // United States
  ['US', 39.7684, -86.1581, 'America/Indiana/Indianapolis'], ['US', 38.2527, -85.7585, 'America/Kentucky/Louisville'],
  ['US', 39.9612, -82.9988, 'America/New_York'], ['US', 41.4993, -81.6944, 'America/New_York'],
  ['US', 35.9606, -83.9207, 'America/New_York'], ['US', 30.4383, -84.2807, 'America/New_York'],
  ['US', 25.7617, -80.1918, 'America/New_York'], ['US', 42.9634, -85.6681, 'America/Detroit'],
  ['US', 36.1627, -86.7816, 'America/Chicago'], ['US', 30.4213, -87.2169, 'America/Chicago'],
  ['US', 43.0389, -87.9065, 'America/Chicago'], ['US', 39.0997, -94.5786, 'America/Chicago'],
  ['US', 41.2565, -95.9345, 'America/Chicago'], ['US', 35.4676, -97.5164, 'America/Chicago'],
  ['US', 37.6872, -97.3301, 'America/Chicago'], ['US', 35.2220, -101.8313, 'America/Chicago'],
  ['US', 33.5779, -101.8552, 'America/Chicago'], ['US', 31.9973, -102.0779, 'America/Chicago'],
  ['US', 29.4241, -98.4936, 'America/Chicago'], ['US', 46.8083, -100.7837, 'America/Chicago'],
  ['US', 41.1240, -100.7654, 'America/Chicago'],
  ['US', 44.0805, -103.2310, 'America/Denver'], ['US', 45.7833, -108.5007, 'America/Denver'],
  ['US', 40.7608, -111.8910, 'America/Denver'], ['US', 35.0844, -106.6504, 'America/Denver'],
  ['US', 31.7619, -106.4850, 'America/Denver'], ['US', 43.6150, -116.2023, 'America/Boise'],
  ['US', 37.9716, -87.5711, 'America/Chicago'], ['US', 44.3683, -100.3510, 'America/Chicago'],
  ['US', 46.8792, -102.7896, 'America/Denver'], ['US', 39.3500, -101.7101, 'America/Denver'],
  ['US', 37.0965, -113.5684, 'America/Denver'],
  ['US', 41.6764, -86.2520, 'America/Indiana/Indianapolis'], ['US', 46.5436, -87.3954, 'America/Detroit'],
  ['US', 31.2232, -85.3905, 'America/Chicago'], ['US', 30.1588, -85.6602, 'America/Chicago'],
  ['US', 37.9717, -100.8727, 'America/Chicago'], ['US', 32.4610, -84.9877, 'America/New_York'],
  ['US', 45.8202, -88.0660, 'America/Chicago'], ['US', 32.6927, -114.6277, 'America/Phoenix'], ['US', 35.1894, -114.0530, 'America/Phoenix'],
  ['US', 32.2226, -110.9747, 'America/Phoenix'], ['US', 36.1699, -115.1398, 'America/Los_Angeles'],
  ['US', 47.6588, -117.4260, 'America/Los_Angeles'], ['US', 45.5152, -122.6784, 'America/Los_Angeles'],
  ['US', 32.7157, -117.1611, 'America/Los_Angeles'],
  ['US', 61.2181, -149.9003, 'America/Anchorage'], ['US', 21.3069, -157.8583, 'Pacific/Honolulu'],
  // Canada
  ['CA', 44.6488, -63.5752, 'America/Halifax'], ['CA', 46.0878, -64.7782, 'America/Moncton'],
  ['CA', 47.5615, -52.7126, 'America/St_Johns'], ['CA', 46.8139, -71.2080, 'America/Toronto'],
  ['CA', 48.3809, -89.2477, 'America/Toronto'], ['CA', 50.4452, -104.6189, 'America/Regina'],
  ['CA', 52.1332, -106.6700, 'America/Regina'], ['CA', 60.7212, -135.0568, 'America/Whitehorse'],
  ['CA', 62.4540, -114.3718, 'America/Edmonton'],
  // Russia
  ['RU', 54.7104, 20.4522, 'Europe/Kaliningrad'], ['RU', 53.1959, 50.1002, 'Europe/Samara'],
  ['RU', 56.8526, 53.2045, 'Europe/Samara'], ['RU', 54.3142, 48.4031, 'Europe/Ulyanovsk'],
  ['RU', 51.5336, 46.0343, 'Europe/Saratov'], ['RU', 46.3479, 48.0336, 'Europe/Astrakhan'],
  ['RU', 48.7080, 44.5133, 'Europe/Volgograd'], ['RU', 56.8389, 60.6057, 'Asia/Yekaterinburg'],
  ['RU', 55.1644, 61.4368, 'Asia/Yekaterinburg'], ['RU', 57.1522, 65.5272, 'Asia/Yekaterinburg'],
  ['RU', 51.7682, 55.0970, 'Asia/Yekaterinburg'], ['RU', 54.9885, 73.3242, 'Asia/Omsk'],
  ['RU', 55.0084, 82.9357, 'Asia/Novosibirsk'], ['RU', 53.3548, 83.7698, 'Asia/Barnaul'],
  ['RU', 56.4847, 84.9482, 'Asia/Tomsk'], ['RU', 56.0153, 92.8932, 'Asia/Krasnoyarsk'],
  ['RU', 52.2870, 104.3050, 'Asia/Irkutsk'], ['RU', 62.0355, 129.6755, 'Asia/Yakutsk'],
  ['RU', 52.0515, 113.4712, 'Asia/Chita'], ['RU', 43.1155, 131.8855, 'Asia/Vladivostok'],
  ['RU', 48.4802, 135.0719, 'Asia/Vladivostok'], ['RU', 46.9591, 142.7380, 'Asia/Sakhalin'],
  ['RU', 55.7963, 49.1088, 'Europe/Moscow'], ['RU', 55.7436, 52.3958, 'Europe/Moscow'],
  ['RU', 55.6366, 51.8245, 'Europe/Moscow'], ['RU', 54.9014, 52.2971, 'Europe/Moscow'],
  ['RU', 53.1959, 45.0183, 'Europe/Moscow'], ['RU', 58.6036, 49.6680, 'Europe/Kirov'],
  ['RU', 58.0105, 56.2502, 'Asia/Yekaterinburg'],
  ['RU', 59.5612, 150.8301, 'Asia/Magadan'], ['RU', 53.0452, 158.6483, 'Asia/Kamchatka'],
  // Brazil
  ['BR', -3.1190, -60.0217, 'America/Manaus'], ['BR', 2.8235, -60.6758, 'America/Boa_Vista'],
  ['BR', -8.7612, -63.9039, 'America/Porto_Velho'], ['BR', -9.9754, -67.8249, 'America/Rio_Branco'],
  ['BR', -15.6014, -56.0979, 'America/Cuiaba'], ['BR', -20.4697, -54.6201, 'America/Campo_Grande'],
  ['BR', -1.4558, -48.4902, 'America/Belem'], ['BR', -3.7319, -38.5267, 'America/Fortaleza'],
  ['BR', -8.0476, -34.8770, 'America/Recife'], ['BR', -15.7975, -47.8919, 'America/Sao_Paulo'],
  ['BR', -25.4284, -49.2733, 'America/Sao_Paulo'],
  // Mexico
  ['MX', 21.1619, -86.8515, 'America/Cancun'], ['MX', 32.5149, -117.0382, 'America/Tijuana'],
  ['MX', 29.0729, -110.9559, 'America/Hermosillo'], ['MX', 23.2494, -106.4111, 'America/Mazatlan'],
  ['MX', 28.6320, -106.0691, 'America/Chihuahua'], ['MX', 25.6866, -100.3161, 'America/Monterrey'],
  ['MX', 20.6597, -103.3496, 'America/Mexico_City'], ['MX', 20.9674, -89.5926, 'America/Merida'],
  // Spain and Portugal: the Atlantic islands are an hour behind
  ['ES', 28.1235, -15.4363, 'Atlantic/Canary'], ['ES', 28.4636, -16.2518, 'Atlantic/Canary'],
  ['ES', 37.3891, -5.9845, 'Europe/Madrid'], ['ES', 43.3623, -8.4115, 'Europe/Madrid'],
  ['PT', 38.7223, -9.1393, 'Europe/Lisbon'], ['PT', 37.7412, -25.6756, 'Atlantic/Azores'],
  ['PT', 32.6669, -16.9241, 'Atlantic/Madeira'],
  // Australia
  ['AU', -31.9539, 141.4539, 'Australia/Broken_Hill'], ['AU', -42.8821, 147.3272, 'Australia/Hobart'],
  ['AU', -35.2809, 149.1300, 'Australia/Sydney'], ['AU', -23.6980, 133.8807, 'Australia/Darwin'],
  ['AU', -16.9186, 145.7781, 'Australia/Brisbane'], ['AU', -19.2590, 146.8169, 'Australia/Brisbane'],
  ['AU', -28.0167, 153.4000, 'Australia/Brisbane'], ['AU', -34.1855, 142.1625, 'Australia/Melbourne'],
  ['AU', -37.8284, 140.7804, 'Australia/Adelaide'], ['AU', -31.6770, 128.8830, 'Australia/Eucla'],
  ['AU', -20.7256, 139.4927, 'Australia/Brisbane'], ['AU', -28.1760, 153.5410, 'Australia/Sydney'],
  // DR Congo, Mongolia (Bayan-Ölgii, where most Mongolian Muslims live, is an hour behind)
  ['CD', -4.4419, 15.2663, 'Africa/Kinshasa'], ['CD', 0.0487, 18.2603, 'Africa/Kinshasa'],
  ['CD', -11.6876, 27.5026, 'Africa/Lubumbashi'], ['CD', -1.6792, 29.2228, 'Africa/Lubumbashi'],
  ['CD', 0.5153, 25.1910, 'Africa/Lubumbashi'],
  ['MN', 47.8864, 106.9057, 'Asia/Ulaanbaatar'], ['MN', 48.9683, 89.9625, 'Asia/Hovd'],
  ['MN', 48.0056, 91.6419, 'Asia/Hovd'],
  // Indonesia, where a longitude line would be wrong: the east of Central Kalimantan
  // keeps WIB while South and East Kalimantan beside it are WITA, and the Sula
  // Islands (North Maluku) are WIT though west of 127°E.
  ['ID', -0.6290, 114.5700, 'Asia/Jakarta'], ['ID', -0.9550, 114.8940, 'Asia/Jakarta'],
  ['ID', -1.7120, 114.8420, 'Asia/Jakarta'], ['ID', -2.1180, 115.1700, 'Asia/Jakarta'],
  ['ID', -2.2100, 113.9200, 'Asia/Jakarta'], ['ID', -0.0263, 109.3425, 'Asia/Jakarta'],
  ['ID', -8.1700, 114.4300, 'Asia/Makassar'], ['ID', -8.2190, 114.3690, 'Asia/Jakarta'],
  ['ID', -3.0000, 114.3900, 'Asia/Jakarta'], ['ID', -2.7500, 114.2600, 'Asia/Jakarta'],
  ['ID', -2.4180, 115.2500, 'Asia/Makassar'], ['ID', -2.1700, 115.3830, 'Asia/Makassar'],
  ['ID', -2.5830, 115.3830, 'Asia/Makassar'], ['ID', -2.9900, 114.7600, 'Asia/Makassar'],
  ['ID', -3.3194, 114.5908, 'Asia/Makassar'], ['ID', -0.2350, 115.8300, 'Asia/Makassar'],
  ['ID', 0.4800, 115.1000, 'Asia/Makassar'], ['ID', -1.2379, 116.8529, 'Asia/Makassar'],
  ['ID', -0.5022, 117.1536, 'Asia/Makassar'], ['ID', -1.5400, 123.4500, 'Asia/Makassar'],
  ['ID', -0.9000, 122.7900, 'Asia/Makassar'],
  ['ID', -2.0600, 125.9800, 'Asia/Jayapura'], ['ID', -1.9500, 124.4000, 'Asia/Jayapura'],
  ['ID', 0.7900, 127.3800, 'Asia/Jayapura'],
]
