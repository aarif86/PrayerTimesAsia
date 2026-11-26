# Store listings

Everything the App Store, Google Play and the Samsung Galaxy Store show to
people, in English, Malay and Indonesian. Nothing here has been sent to any
store yet. The owner reads and approves first.

| Language | Text | iPhone and iPad screenshots | Android screenshots and feature graphic |
|---|---|---|---|
| English | [en.md](en.md) | `design/store/app-store/en/` | `design/store/play/en/` |
| Bahasa Melayu | [ms.md](ms.md) | `design/store/app-store/ms/` | `design/store/play/ms/` |
| Bahasa Indonesia | [id.md](id.md) | `design/store/app-store/id/` | `design/store/play/id/` |

Store settings, privacy answers and the App Review note stay in
[../app-store.md](../app-store.md) and [../play-store.md](../play-store.md).
The Galaxy Store uses the Google Play text and pictures
(see the Samsung guide in the project files).

## House rules for this text

- Plain everyday words, no colons, no long dashes (they read as machine written).
- Malay in bahasa baku, as in Berita Harian. No "lah" or slang.
- Prayer comes first. No talk of how the app was built.
- Every description ends with "follow your local religious authority" (in each
  language) and the line "Built fisabilillah in Singapore by Ustaz Aarif Raziff
  and Ustazah Nasibah Hamzah, with Nasar Digital (Nasar Pte Ltd)".
- The promise is **no outside ads** (no Google or Facebook ads, no tracking),
  which stays true when Barakah Picks (PR #114) goes live.

`python3 tools/check_store_copy.py` checks every box for length and the rules
above. Run it after any change.

## Screenshots, in order

| # | Screen | English | Malay | Indonesian |
|---|---|---|---|---|
| 1 | Prayer screen at home | Know when to pray, wherever you land | Tahu waktu solat, di mana sahaja anda berada | Tahu waktu sholat, di mana pun Anda berada |
| 2 | Just landed in Hanoi | Your times switch the moment you arrive | Waktu solat bertukar sebaik sahaja anda tiba | Jadwal berganti begitu Anda tiba |
| 3 | Journey (musafir) | Jamak and qasar, worked out for you | Jamak dan qasar, dikira untuk anda | Jamak dan qashar, dihitung untuk Anda |
| 4 | Qibla, facing the Kaaba | Face the Kaaba in one glance | Hadap Kaabah dengan sekali pandang | Menghadap Ka'bah dengan sekali lihat |
| 5 | Ramadan, Berbuka countdown | Imsak and Berbuka, counted down for you | Kiraan detik ke imsak dan berbuka | Hitung mundur menuju imsak dan buka puasa |
| 6 | Prayer alarms | Never miss Subuh again | Jangan terlepas Subuh lagi | Jangan sampai terlewat Subuh lagi |
| 7 | Your masjid's jamaah times | Your masjid's jamaah times, right here | Waktu jemaah masjid anda, di sini | Jadwal jamaah masjid Anda, di sini |
| 8 | Dial look | Five looks for your Prayer screen | Lima gaya paparan waktu solat | Lima tampilan layar sholat |

The app screens themselves are in English for now. When the whole app is in
Malay and Indonesian (PR #110 and the work after it), retake the shots in
those languages.

Sizes. iPhone 6.9" 1320 × 2868, iPad 13" 2064 × 2752, Android phone
1080 × 2160 (Play takes up to 8), Play feature graphic 1024 × 500.

## Before going live

1. Owner reads the English text and the screenshots.
2. A native speaker reads the Malay and the Indonesian once.
3. Colour Bands is left out of the screenshots until the prayertime.sg
   designer has agreed to the tribute.
4. Paste into each store, starting with the English (default) listing.
5. About three weeks before Ramadan 1448 (expected around 8 February 2027),
   swap in the Ramadan boxes at the bottom of each file, and swap back after
   Hari Raya.
