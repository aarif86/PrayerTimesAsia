/**
 * Builds the pages search engines and AI answer tools read, from the SAME prayer
 * engine and country table the apps use, so a page can never disagree with the app.
 *
 *   cd web && npx vite-node scripts/build-search-pages.ts -- <siteDir> <base>
 *
 *   <siteDir>  the assembled website folder (_site). Pages are written into it.
 *   <base>     "/" on the custom domain, "/PrayerTimesAsia/" on github.io.
 *
 * Writes prayer-times/ (a list page and one page per major city), about.html
 * (how the times are worked out), sitemap.xml and robots.txt.
 *
 * Every city page carries today's times as plain text plus the next 30 days, so
 * nothing depends on a widget. A tiny script swaps in the visitor-day row if the
 * page is older than a day, and the Web workflow rebuilds daily.
 * Public copy rule: no colons or dashes in the sentences.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { computeFor } from '../src/core/engine'
import { qiblaBearing } from '../src/core/geo'
import { ALL_METHODS } from '../src/core/methods'
import { NAMES, type Prayer } from '../src/core/prayer'
import { profileFor, profileMethod } from '../src/core/regions'
import { CITIES } from '../src/services/cities'
import { zoned } from '../src/core/tz'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const [siteDir, baseArg = '/'] = argv
if (!siteDir) throw new Error('usage: build-search-pages.ts <siteDir> <base>')
const BASE = baseArg.endsWith('/') ? baseArg : baseArg + '/'
const ORIGIN = 'https://prayertimes.asia'
const PLAY = 'https://play.google.com/store/apps/details?id=com.prayertimesasia.app'
const DAYS = 30

/** [country, name in the built-in list, name shown on the page]. */
const WANTED: [string, string, string?][] = [
  ['SG', 'Singapore City', 'Singapore'], ['MY', 'Kuala Lumpur'], ['MY', 'Johor Bahru'], ['MY', 'George Town', 'Penang'],
  ['MY', 'Kota Kinabalu'], ['MY', 'Kuching'], ['BN', 'Bandar Seri Begawan'],
  ['ID', 'Jakarta'], ['ID', 'Surabaya'], ['ID', 'Bandung'], ['ID', 'Medan'], ['ID', 'Makassar'], ['ID', 'Yogyakarta'],
  ['TH', 'Bangkok'], ['PH', 'Manila'], ['VN', 'Hanoi'], ['VN', 'Ho Chi Minh City'], ['KH', 'Phnom Penh'],
  ['BD', 'Dhaka'], ['PK', 'Karachi'], ['PK', 'Lahore'], ['IN', 'Mumbai'], ['IN', 'New Delhi', 'Delhi'], ['LK', 'Colombo'],
  ['JP', 'Tokyo'], ['KR', 'Seoul'], ['HK', 'Hong Kong'],
  ['SA', 'Makkah'], ['SA', 'Madinah'], ['AE', 'Dubai'], ['TR', 'Istanbul'], ['GB', 'London'],
]

const slug = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const write = (path: string, body: string) => {
  const full = join(siteDir, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, body)
}

const ENGLISH: Record<Prayer, string> = NAMES.arabic
const prayers: Prayer[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']

function clock(ms: number, tz: string): string {
  const z = zoned(ms, tz)
  const h12 = z.hour % 12 === 0 ? 12 : z.hour % 12
  return `${h12}:${String(z.minute).padStart(2, '0')} ${z.hour < 12 ? 'am' : 'pm'}`
}
const isoDay = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

interface City {
  name: string; slug: string; country: string; countryName: string; tz: string; lat: number; lng: number
  methodName: string; fajr: number; isha: number | null; ishaInterval: number | null; asrSchool: string
  authority: string; sourceKind: string; note: string; naming: Record<Prayer, string>
  rows: { d: string; t: Record<Prayer, string> }[]; longDate: string; qibla: number
}

const now = Date.now()
const cities: City[] = WANTED.map(([cc, listName, shown]) => {
  const p = CITIES.find((c) => c.countryCode === cc && c.name === listName)
  if (!p) throw new Error(`City missing from the built-in list: ${cc} ${listName}`)
  const profile = profileFor(cc)!
  const method = profileMethod(profile)
  const rows: City['rows'] = []
  for (let i = 0; i < DAYS; i++) {
    const ms = now + i * 86400000
    const day = computeFor(ms, p.timeZoneID, p.coordinates, method, profile.asr)
    const z = zoned(ms, p.timeZoneID)
    rows.push({ d: isoDay(z.year, z.month, z.day), t: Object.fromEntries(prayers.map((k) => [k, clock(day.times[k], p.timeZoneID)])) as Record<Prayer, string> })
  }
  const longDate = new Intl.DateTimeFormat('en-GB', { timeZone: p.timeZoneID, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)
  return {
    name: shown ?? p.name, slug: slug(shown ?? p.name), country: cc, countryName: profile.name, tz: p.timeZoneID,
    lat: p.coordinates.latitude, lng: p.coordinates.longitude, methodName: method.name.replace(' · ', ', '),
    fajr: method.fajrAngle, isha: method.ishaAngle, ishaInterval: method.ishaInterval,
    asrSchool: profile.asr === 'hanafi' ? 'Hanafi' : "Shafi'i", authority: profile.authority ?? 'No single national authority',
    sourceKind: profile.source, note: profile.note ?? '', naming: NAMES[profile.naming], rows, longDate,
    qibla: Math.round(qiblaBearing(p.coordinates)),
  }
})

const today = (c: City) => c.rows[0]
const BUILT = new Date(now).toISOString().slice(0, 10)

const compass = (deg: number) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(deg / 45) % 8].replace('-', ' ')

/** Local name next to the English one, only where they differ ("Fajr (Subuh)"). */
const both = (c: City, k: Prayer) => (c.naming[k] === ENGLISH[k] ? ENGLISH[k] : `${ENGLISH[k]} (${c.naming[k]})`)
const lead = (c: City, k: Prayer) => (c.naming[k] === ENGLISH[k] ? ENGLISH[k] : c.naming[k])

const CSS = `
  :root{--night:#0b0f2a;--card:rgba(255,255,255,.05);--line:rgba(255,255,255,.12);--text:#eef0fb;--muted:#a9b0d6;--gold:#f2b65a;color-scheme:dark}
  :root[data-theme=light]{--night:#F2EEE9;--card:#fff;--line:rgba(21,26,69,.13);--text:#151A45;--muted:#4c5380;--gold:#8a5a00;color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;background:var(--night);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;line-height:1.6}
  .wrap{max-width:860px;margin:0 auto;padding:0 20px}
  header{padding:18px 0;border-bottom:1px solid var(--line)}
  header .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px}
  header a{color:var(--text);text-decoration:none;font-weight:700;display:inline-flex;align-items:center;gap:10px}
  header img{width:30px;height:30px;border-radius:8px}
  header a.app{font-weight:600;font-size:.92rem;color:var(--gold);border:1px solid var(--line);border-radius:999px;padding:7px 14px}
  h1{font-size:clamp(1.8rem,5vw,2.6rem);margin:34px 0 6px;letter-spacing:-.02em;line-height:1.15}
  h2{font-size:1.3rem;margin:34px 0 10px}
  .date{color:var(--muted);margin:0 0 18px}
  .lead{color:var(--muted);font-size:1.05rem}
  .times{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin:18px 0 6px;padding:0;list-style:none}
  .times li{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 16px}
  .times b{display:block;color:var(--muted);font-weight:600;font-size:.9rem}
  .times span{font-size:1.5rem;font-weight:700;color:var(--gold);white-space:nowrap}
  .card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px 20px;margin:14px 0}
  .card p{margin:6px 0}
  table{width:100%;border-collapse:collapse;font-size:.92rem}
  th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
  th{color:var(--muted);font-weight:600}
  tr.now td{color:var(--gold);font-weight:700}
  .scroll{overflow-x:auto;border:1px solid var(--line);border-radius:16px;margin:10px 0}
  details{margin:10px 0}
  summary{cursor:pointer;font-weight:600}
  dt{font-weight:700;margin-top:16px}
  dd{margin:4px 0 0;color:var(--muted)}
  a{color:var(--gold)}
  .links{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}
  .links a{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:6px 14px;text-decoration:none;color:var(--text);font-size:.93rem}
  .cta{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}
  .cta a{background:var(--gold);color:#0b0f2a;text-decoration:none;font-weight:700;border-radius:999px;padding:11px 20px}
  :root[data-theme=light] .cta a{color:#fff}
  footer{color:var(--muted);padding:30px 0 70px;margin-top:50px;border-top:1px solid var(--line);font-size:.92rem}
`
const THEME = `<script>(function(){var t=null;try{t=localStorage.getItem('pta-theme')}catch(e){}if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.setAttribute('data-theme',t)})()</script>`

function shell(o: { title: string; desc: string; path: string; depth: number; body: string; ld: object[]; extra?: string }): string {
  const up = '../'.repeat(o.depth)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#0b0f2a" />
<meta name="color-scheme" content="dark light" />
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}" />
<link rel="canonical" href="${ORIGIN}/${o.path}" />
<link rel="icon" type="image/png" sizes="32x32" href="${up}img/favicon-32.png" />
<link rel="apple-touch-icon" href="${up}img/apple-touch-icon.png" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Prayer Times Asia" />
<meta property="og:title" content="${esc(o.title)}" />
<meta property="og:description" content="${esc(o.desc)}" />
<meta property="og:url" content="${ORIGIN}/${o.path}" />
<meta property="og:image" content="${ORIGIN}/img/share.png" />
<meta name="twitter:card" content="summary_large_image" />
<style>${CSS}</style>
${THEME}
${o.ld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
<header><div class="wrap"><a href="${up}./"><img src="${up}img/icon-192.png" alt="" width="30" height="30" />Prayer Times Asia</a><a class="app" href="${up}app/">Open the app</a></div></header>
<main class="wrap">
${o.body}
</main>
<footer><div class="wrap">Always follow your local religious authority. <a href="${up}about.html">How we work out the times</a> · <a href="${up}sources.html">Where our times come from</a> · <a href="${up}prayer-times/">All cities</a> · <a href="${up}privacy.html">Privacy</a></div></footer>
${o.extra ?? ''}
</body>
</html>
`
}

const orgLd = {
  '@context': 'https://schema.org', '@type': 'Organization', '@id': `${ORIGIN}/#org`, name: 'Prayer Times Asia', url: `${ORIGIN}/`,
  logo: `${ORIGIN}/img/icon-192.png`, email: 'salam@prayertimes.asia',
  founder: [{ '@type': 'Person', name: 'Ustaz Aarif Raziff' }, { '@type': 'Person', name: 'Ustazah Nasibah Hamzah' }],
  sameAs: [PLAY],
}
const siteLd = { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${ORIGIN}/#site`, url: `${ORIGIN}/`, name: 'Prayer Times Asia', publisher: { '@id': `${ORIGIN}/#org` }, inLanguage: 'en' }

/** Swaps in the visitor's day if the page was built on an earlier day. Nothing else on the page needs JavaScript. */
const dayScript = (c: City) => `<script type="application/json" id="days">${JSON.stringify(c.rows)}</script>
<script>
(function(){try{
  var rows=JSON.parse(document.getElementById('days').textContent);
  var d=new Intl.DateTimeFormat('en-CA',{timeZone:${JSON.stringify(c.tz)}}).format(new Date());
  var i=-1;rows.forEach(function(r,n){if(r.d===d)i=n});
  if(i<0){document.querySelectorAll('[data-stale]').forEach(function(e){e.hidden=false});return}
  var r=rows[i];
  document.querySelectorAll('[data-t]').forEach(function(e){e.textContent=r.t[e.getAttribute('data-t')]});
  document.querySelectorAll('[data-date]').forEach(function(e){e.textContent=new Intl.DateTimeFormat('en-GB',{timeZone:${JSON.stringify(c.tz)},weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date())});
  document.querySelectorAll('tbody tr').forEach(function(e){e.className=e.getAttribute('data-d')===d?'now':''});
}catch(e){}})();
</script>`

const t = (c: City, k: Prayer) => `<span data-t="${k}">${today(c).t[k]}</span>`

function cityPage(c: City): string {
  const title = `Prayer times in ${c.name} today | Fajr, Dhuhr, Asr, Maghrib, Isha`
  const T = today(c).t
  const desc = `Prayer times in ${c.name} today, ${c.longDate}. ${lead(c, 'fajr')} ${T.fajr}, ${lead(c, 'dhuhr')} ${T.dhuhr}, ${lead(c, 'asr')} ${T.asr}, ${lead(c, 'maghrib')} ${T.maghrib}, ${lead(c, 'isha')} ${T.isha}. Method and source explained.`
  const ishaRule = c.isha != null ? `${c.isha} degrees` : `${c.ishaInterval} minutes after Maghrib`
  const official = c.sourceKind === 'table'
    ? `The official timetable comes from ${c.authority}. The times on this page are worked out with the same method and sit within about 2 minutes of it, never earlier. The Prayer Times Asia app shows the official timetable itself when you are online.`
    : c.sourceKind === 'authority'
      ? `The app follows ${c.authority} and works out the times with that authority's own method.`
      : `There is no single national authority whose timetable the app can read here, so it uses what most masjids use. ${c.note}`.trim()
  const faq: [string, string][] = [
    [`What time is ${lead(c, 'fajr')} in ${c.name} today?`, `${lead(c, 'fajr')} in ${c.name} today is at ${t(c, 'fajr')}. Sunrise is at ${t(c, 'sunrise')}, so ${lead(c, 'fajr')} ends then.`],
    [`What time is ${lead(c, 'maghrib')} in ${c.name} today?`, `${lead(c, 'maghrib')} in ${c.name} today is at ${t(c, 'maghrib')}. This is also the time to break the fast during Ramadan.`],
    [`What are all the prayer times in ${c.name} today?`, `${both(c, 'fajr')} ${t(c, 'fajr')}, ${both(c, 'dhuhr')} ${t(c, 'dhuhr')}, ${both(c, 'asr')} ${t(c, 'asr')}, ${both(c, 'maghrib')} ${t(c, 'maghrib')} and ${both(c, 'isha')} ${t(c, 'isha')}. Times are in local time for ${c.name}.`],
    [`Which method are the prayer times in ${c.name} based on?`, `${c.methodName}, with Fajr at ${c.fajr} degrees and Isha at ${ishaRule}. Asr uses the ${c.asrSchool} school. ${official}`],
    [`Which way is the qibla from ${c.name}?`, `The qibla from ${c.name} is about ${c.qibla} degrees clockwise from north, towards the ${compass(c.qibla)}. The app shows it live on your phone.`],
  ]
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') } })),
  }
  const same = cities.filter((o) => o.country === c.country && o !== c)
  const others = [...same, ...cities.filter((o) => o.country !== c.country && o !== c)]
  const body = `
<nav aria-label="Breadcrumb" class="date"><a href="${BASE}">Home</a> / <a href="${BASE}prayer-times/">Prayer times</a> / ${esc(c.name)}</nav>
<h1>Prayer times in ${esc(c.name)} today</h1>
<p class="date" data-date>${esc(c.longDate)}</p>
<p class="lead" data-stale hidden>These times are older than a month. Open the app for today's times.</p>
<ul class="times">
${prayers.map((k) => `  <li><b>${esc(both(c, k))}</b><span data-t="${k}">${T_(c, k)}</span></li>`).join('\n')}
</ul>
<p class="lead">All times are local time in ${esc(c.name === c.countryName ? c.name : `${c.name}, ${c.countryName}`)}. ${official}</p>
<div class="cta"><a href="${BASE}app/">Open the web app</a><a href="${PLAY}">Get it on Google Play</a></div>

<h2>Questions about prayer times in ${esc(c.name)}</h2>
<dl>
${faq.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${a}</dd>`).join('\n')}
</dl>

<h2>How these times are worked out</h2>
<div class="card">
  <p>Source ${esc(c.authority)}</p>
  <p>Method ${esc(c.methodName)}, Fajr ${c.fajr} degrees, Isha ${esc(ishaRule)}, Asr ${esc(c.asrSchool)}</p>
  <p>Place ${esc(c.name)}, ${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}, time zone ${esc(c.tz)}</p>
  <p><a href="${BASE}about.html">Read more about how we work out the times</a>. Masjids can differ by a few minutes, so please follow your local religious authority.</p>
</div>

<h2>Prayer times in ${esc(c.name)} for the next 30 days</h2>
<details>
<summary>Show the 30 day timetable</summary>
<div class="scroll"><table><thead><tr><th>Date</th>${prayers.map((k) => `<th>${esc(lead(c, k))}</th>`).join('')}</tr></thead><tbody>
${c.rows.map((r, i) => `<tr data-d="${r.d}"${i === 0 ? ' class="now"' : ''}><td>${r.d}</td>${prayers.map((k) => `<td>${r.t[k]}</td>`).join('')}</tr>`).join('\n')}
</tbody></table></div>
</details>

<h2>Other cities</h2>
<ul class="links">
${others.map((o) => `  <li><a href="${BASE}prayer-times/${o.slug}/">${esc(o.name)}</a></li>`).join('\n')}
</ul>
<p class="date">Page built ${BUILT}.</p>`
  return shell({
    title, desc, path: `prayer-times/${c.slug}/`, depth: 2, body, extra: dayScript(c),
    ld: [orgLd, siteLd, faqLd, {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [['Home', `${ORIGIN}/`], ['Prayer times', `${ORIGIN}/prayer-times/`], [c.name, `${ORIGIN}/prayer-times/${c.slug}/`]]
        .map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
    }],
  })
}
const T_ = (c: City, k: Prayer) => today(c).t[k]

// Pages
for (const c of cities) write(`prayer-times/${c.slug}/index.html`, cityPage(c))

write('prayer-times/index.html', shell({
  title: 'Prayer times by city | Prayer Times Asia',
  desc: `Today's prayer times for ${cities.length} cities across Asia and the world, with the method and source explained for each.`,
  path: 'prayer-times/', depth: 1,
  ld: [orgLd, siteLd, { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: cities.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: `Prayer times in ${c.name}`, url: `${ORIGIN}/prayer-times/${c.slug}/` })) }],
  body: `
<h1>Prayer times by city</h1>
<p class="lead">Pick a city to see today's prayer times and the next 30 days, with the method and source written out. For your exact spot, open the free app.</p>
<div class="cta"><a href="${BASE}app/">Open the web app</a><a href="${PLAY}">Get it on Google Play</a></div>
${[...new Set(cities.map((c) => c.countryName))].map((cn) => `<h2>${esc(cn)}</h2>
<ul class="links">${cities.filter((c) => c.countryName === cn).map((c) => `<li><a href="${BASE}prayer-times/${c.slug}/">${esc(c.name)}</a></li>`).join('')}</ul>`).join('\n')}
<p class="date">The app covers 143 countries and works offline.</p>`,
}))

// About and method
const methodRows = ALL_METHODS.map((m) => `<tr><td>${esc(m.name.replace(' · ', ', '))}</td><td>${m.fajrAngle}</td><td>${m.ishaAngle != null ? m.ishaAngle : (m.ishaInterval ?? 0) + ' min after Maghrib'}</td></tr>`).join('\n')
write('about.html', shell({
  title: 'About Prayer Times Asia and how we work out prayer times',
  desc: 'Who makes Prayer Times Asia, which authorities and calculation methods the times follow, and why you should always follow your local religious authority.',
  path: 'about.html', depth: 0,
  ld: [orgLd, siteLd, { '@context': 'https://schema.org', '@type': 'AboutPage', url: `${ORIGIN}/about.html`, name: 'About Prayer Times Asia', about: { '@id': `${ORIGIN}/#org` } }],
  body: `
<h1>About Prayer Times Asia and how we work out the times</h1>
<p class="lead">Prayer Times Asia is a free prayer times and qibla app for Muslims in Asia and everywhere else. It has no outside ads, no account and no tracking. It was built by Ustaz Aarif Raziff and Ustazah Nasibah Hamzah with Nasar Digital after a family trip where none of their prayer apps worked.</p>

<h2>Our rule, your local authority first</h2>
<p>Where a country's religious authority publishes a timetable, the app shows that timetable. Where an authority publishes its method but not a timetable the app can read, the app works out the times the same way the authority does. Only where there is no national authority does the app use the method most masjids there use, and it tells you so. The full list for every country is on <a href="${BASE}sources.html">Where our times come from</a>.</p>
<ul>
<li>Singapore follows MUIS, the Islamic Religious Council of Singapore.</li>
<li>Malaysia follows JAKIM e-Solat for your state zone.</li>
<li>Indonesia follows Kemenag, the Ministry of Religious Affairs.</li>
<li>Brunei follows the Ministry of Religious Affairs, Brunei.</li>
</ul>

<h2>How the calculation works</h2>
<p>The app works out where the sun is for your exact spot, then finds the moment it reaches the angle each authority uses for Fajr and Isha. Asr is when the shadow of an object grows to one length (Shafi'i, Maliki, Hanbali) or two lengths (Hanafi) of the object plus its noon shadow. Maghrib is at sunset. We round up to the next minute and add the small precaution minutes each authority uses, so a time is never earlier than the official one. We checked the offline results against the full official 2026 timetables for Singapore, Malaysia and Indonesia, and they sit within about 2 minutes, never earlier.</p>
<div class="scroll"><table><thead><tr><th>Method</th><th>Fajr angle</th><th>Isha angle</th></tr></thead><tbody>
${methodRows}
</tbody></table></div>

<h2>Please check with your masjid</h2>
<p>Prayer times can differ by a few minutes between authorities and masjids. Prayer Times Asia is a helper and not a replacement for your local religious authority or your masjid. When they differ, follow them.</p>

<h2>Prayer times by city</h2>
<p><a href="${BASE}prayer-times/">See today's times for ${cities.length} cities</a>, each with its method and source written out.</p>
<div class="cta"><a href="${BASE}app/">Open the web app</a><a href="${PLAY}">Get it on Google Play</a></div>
<p>Questions or corrections are welcome at <a href="mailto:salam@prayertimes.asia">salam@prayertimes.asia</a>.</p>`,
}))

// robots and sitemap
write('robots.txt', `User-agent: *
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`)

const has = (p: string) => existsSync(join(siteDir, p))
const pages = ['', 'ms/', 'id/', 'ar/', 'ur/', 'bn/', 'tr/', 'fr/', 'about.html', 'sources.html', 'whatsnew.html', 'credits.html', 'ms/credits.html',
  'id/credits.html', 'press.html', 'ramadan.html', 'privacy.html', 'terms.html', 'join.html', 'masjid.html', 'app/', 'prayer-times/',
  ...cities.map((c) => `prayer-times/${c.slug}/`)].filter((p) => p === '' || has(p === '' ? 'index.html' : p.endsWith('/') ? `${p}index.html` : p))
const home = ['', 'ms/', 'id/', 'ar/', 'ur/', 'bn/', 'tr/', 'fr/'].filter((p) => has(p === '' ? 'index.html' : `${p}index.html`))
const alt = (p: string) => (home.includes(p) ? home.map((h) => `<xhtml:link rel="alternate" hreflang="${h === '' ? 'en' : h.replace('/', '')}" href="${ORIGIN}/${h}"/>`).join('') : '')
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pages.map((p) => `<url><loc>${ORIGIN}/${p}</loc><lastmod>${BUILT}</lastmod>${alt(p)}</url>`).join('\n')}
</urlset>
`)
console.log(`Search pages built: ${cities.length} cities, about, sitemap with ${pages.length} addresses`)
