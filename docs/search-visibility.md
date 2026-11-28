# Search and AI answer visibility

What the website publishes so Google, Bing and AI answer tools can find and read it.

## What is built (every Web workflow run)
- `prayer-times/` plus one page per city (50 today. Each city has English plus the language spoken there, so Malay at `ms/waktu-solat/` for Malaysia, Singapore and Brunei, Indonesian at `id/jadwal-sholat/` for Indonesia, and Thai, Burmese, Nepali, Chinese, Japanese, Korean, Vietnamese, Khmer, Filipino, Hindi and Sinhala in their own folders such as `th/prayer-times/`. Makkah and Madinah also keep Malay and Indonesian for pilgrims. Each page has a printable monthly and Ramadan timetable page under `printable-timetables/`, `ms/jadual-cetak/` and `id/jadwal-cetak/`), built by `web/scripts/build-search-pages.ts` from the same prayer engine and country table as the apps. Today's times are plain text, with the next 30 days, a short FAQ, and FAQPage, BreadcrumbList, WebSite and Organization markup.
- `about.html`, how the times are worked out and which authorities are followed.
- `sitemap.xml` (home in 8 languages with hreflang, every public page, every city page) and `robots.txt`.
- A daily rebuild (16:20 UTC) so the written "today" times stay fresh. A small script also shows the right day if a page is older.
- Home page structured data (Organization, WebSite, MobileApplication).

To add a city, add a line to `WANTED` in the script. The city must exist in `web/src/services/cities.ts`.

## Owner only
1. Add https://prayertimes.asia to Google Search Console (domain property, verify by DNS at the registrar) and submit https://prayertimes.asia/sitemap.xml.
2. Add the site to Bing Webmaster Tools (it can import from Search Console) and submit the same sitemap.
3. Ask a few masjid websites, Muslim directories and community pages to link to prayertimes.asia.
