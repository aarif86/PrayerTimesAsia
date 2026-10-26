// Screenshots of every screen at iPhone size, with a fixed place (Pasir Ris,
// Singapore) and a fixed clock, like the iOS app's CI screenshots.
//
//   npm run build && node scripts/screenshots.mjs [outDir]
//
// Serves dist/ itself. Official MUIS times come from the app's calendar feed;
// set FEED_FILE to a local copy of sg-muis.ics to work offline. Masjid search
// is answered from scripts/fixtures/overpass-pasir-ris.json so it is repeatable.
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { chromium } from 'playwright'

const root = resolve(new URL('..', import.meta.url).pathname)
const dist = join(root, 'dist')
const out = resolve(process.argv[2] ?? join(root, 'docs/screenshots'))
const base = '/PrayerTimesAsia/'
mkdirSync(out, { recursive: true })

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' }
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (!path.startsWith(base)) { res.writeHead(302, { location: base }); return res.end() }
  path = path.slice(base.length) || 'index.html'
  let file = join(dist, path)
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html')
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
}).listen(0)
const port = server.address().port
const origin = `http://127.0.0.1:${port}${base}`

const NIGHT = '2026-10-25T00:49:00+08:00'
const DAY = '2026-10-25T13:35:00+08:00'

const shots = [
  ['01-classic-night', { style: 'list', appearance: 'dark', now: NIGHT }],
  ['02-classic-day', { style: 'list', appearance: 'system', now: DAY }],
  ['03-classic-show-more', { style: 'list', appearance: 'dark', now: NIGHT, more: '1' }],
  ['04-centre-night', { style: 'centre', appearance: 'dark', now: NIGHT }],
  ['05-centre-day', { style: 'centre', appearance: 'system', now: DAY }],
  ['06-dial-night', { style: 'dial', appearance: 'dark', now: NIGHT }],
  ['07-dial-day', { style: 'dial', appearance: 'system', now: DAY }],
  ['08-sunpath-night', { style: 'sunPath', appearance: 'dark', now: NIGHT }],
  ['09-sunpath-day', { style: 'sunPath', appearance: 'system', now: DAY }],
  ['10-bands-night', { style: 'bands', appearance: 'dark', now: NIGHT }],
  ['11-bands-day-more', { style: 'bands', appearance: 'system', now: DAY, more: '1' }],
  ['12-auto-soft-night', { style: 'list', appearance: 'system', now: NIGHT }],
  ['13-light-night', { style: 'list', appearance: 'light', now: NIGHT }],
  ['14-qibla-aligned', { tab: 'qibla', appearance: 'dark', now: NIGHT, aligned: '1' }],
  ['15-qibla-day', { tab: 'qibla', appearance: 'system', now: DAY }],
  ['16-falak-night', { tab: 'falak', appearance: 'dark', now: NIGHT }],
  ['17-falak-day', { tab: 'falak', appearance: 'system', now: DAY }],
  ['18-masjid', { tab: 'masjid', appearance: 'dark', now: NIGHT }],
  ['19-settings', { tab: 'settings', appearance: 'dark', now: NIGHT }],
  ['20-settings-makers', { tab: 'settings', appearance: 'dark', now: NIGHT, settings: 'makers' }],
  ['21-visitor-kl', { demo: 'visitor', style: 'list', appearance: 'dark', now: NIGHT }],
  ['22-travel-hanoi', { demo: 'travel', style: 'list', appearance: 'dark', now: NIGHT }],
  ['23-masjid-about', { tab: 'masjid', appearance: 'dark', now: NIGHT }, (p) => p.click('button[aria-label="About this app"]')],
  ['24-source-sheet', { style: 'list', appearance: 'dark', now: NIGHT }, (p) => p.click('.source-badge')],
  ['25-calendar-sheet', { style: 'list', appearance: 'dark', now: NIGHT }, (p) => p.click('.date-main')],
  ['26-places-sheet', { style: 'list', appearance: 'dark', now: NIGHT }, async (p) => { await p.click('.place-chip'); await p.fill('input[type=search]', 'ku') }],
  ['27-style-menu', { style: 'list', appearance: 'dark', now: NIGHT }, (p) => p.click('button[aria-label^="Prayer screen style"]', { button: 'right' })],
  ['28-journey', { demo: 'travel', style: 'list', appearance: 'dark', now: NIGHT }, (p) => p.click('button[aria-label^="Musafir"]')],
]

const feed = process.env.FEED_FILE && existsSync(process.env.FEED_FILE) ? readFileSync(process.env.FEED_FILE, 'utf8') : null
const overpass = readFileSync(join(root, 'scripts/fixtures/overpass-pasir-ris.json'), 'utf8')

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  locale: 'en-US', timezoneId: 'Asia/Singapore', colorScheme: 'dark',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
})
await context.route(/data\.gov\.sg|e-solat|myquran/, (r) => r.abort())
await context.route(/raw\.githubusercontent\.com\/aarif86\/PrayerTimesAsia\/feeds\/sg-muis\.ics/, (r) =>
  feed ? r.fulfill({ status: 200, contentType: 'text/plain', body: feed, headers: { 'access-control-allow-origin': '*' } }) : r.continue())
await context.route(/overpass/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: overpass, headers: { 'access-control-allow-origin': '*' } }))
if (process.env.OFFLINE_TILES) await context.route(/basemaps\.cartocdn\.com/, (r) => r.abort())

const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null
for (const [name, params, action] of shots) {
  if (only && !only.test(name)) continue
  const q = new URLSearchParams({ demo: params.demo ?? '1', ...params })
  q.delete('demo'); q.set('demo', params.demo ?? '1')
  const page = await context.newPage()
  await page.goto(`${origin}?${q}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(name.includes('masjid') ? 2500 : name.includes('qibla-day') ? 3200 : 900)
  if (action) { await action(page); await page.waitForTimeout(700) }
  await page.screenshot({ path: join(out, `${name}.png`) })
  await page.close()
  console.log('saved', name)
}
await browser.close()
server.close()
