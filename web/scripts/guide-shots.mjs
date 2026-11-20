// Real app screens for the quick guide's little moving phone, with where each
// highlighted button sits. Run after npm run build:
//   node scripts/guide-shots.mjs
// Writes src/assets/guide/steps/*.webp and ../data/guide-shots.json, then run
// python3 tools/build_guide_words.py to copy the boxes into the three apps.
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { chromium } from 'playwright'

const root = resolve(new URL('..', import.meta.url).pathname)
const dist = join(root, 'dist'), base = '/PrayerTimesAsia/'
const outImg = join(root, 'src/assets/guide/steps'), tmp = join(root, 'node_modules/.guide-shots')
mkdirSync(outImg, { recursive: true }); mkdirSync(tmp, { recursive: true })
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' }
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (!path.startsWith(base)) { res.writeHead(302, { location: base }); return res.end() }
  path = path.slice(base.length) || 'index.html'
  let file = join(dist, path)
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  if (!existsSync(file)) file = join(dist, 'index.html')
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); res.end(readFileSync(file))
}).listen(0)
const origin = `http://127.0.0.1:${server.address().port}${base}`

const DAY = '2026-10-25T13:35:00+08:00'
const home = { style: 'centre', appearance: 'system', now: DAY }
const tab = (name) => (p) => p.getByRole('button', { name, exact: true })
const scrollTo = (sel) => (p) => p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel)

/** name: [query, before (what to do first), target (what the finger points at)] */
const SHOTS = {
  home: [home, null, (p) => p.locator('.dial-wrap, .centre-dial, .next-card').first()],
  home_next: [home, null, (p) => p.getByRole('button', { name: 'Next day' })],
  tomorrow: [home, (p) => p.getByRole('button', { name: 'Next day' }).click(), (p) => p.locator('.day-nav-main')],
  btn_look: [home, null, (p) => p.locator('button[aria-label^="Prayer screen style"]')],
  btn_light: [home, null, (p) => p.locator('button[aria-label^="Appearance"]')],
  btn_alarm: [home, null, (p) => p.locator('button[aria-label^="Alerts and alarms"]')],
  btn_streak: [home, null, (p) => p.locator('.streak-chip')],
  look_centre: [home, null, (p) => p.locator('button[aria-label^="Prayer screen style"]')],
  look_list: [{ ...home, style: 'list' }, null, (p) => p.locator('button[aria-label^="Prayer screen style"]')],
  look_dial: [{ ...home, style: 'dial' }, null, (p) => p.locator('button[aria-label^="Prayer screen style"]')],
  look_sunPath: [{ ...home, style: 'sunPath' }, null, (p) => p.locator('button[aria-label^="Prayer screen style"]')],
  look_bands: [{ ...home, style: 'bands' }, null, (p) => p.locator('button[aria-label^="Prayer screen style"]')],
  look_simple: [{ ...home, style: 'simple' }, null, (p) => p.locator('button[aria-label^="Prayer screen style"]')],
  look_light: [{ ...home, style: 'list', appearance: 'dark' }, null, (p) => p.locator('button[aria-label^="Appearance"]')],
  look_lightOn: [{ ...home, style: 'list', appearance: 'light' }, null, (p) => p.locator('button[aria-label^="Appearance"]')],
  bell: [home, null, (p) => p.locator('button.bell').first()],
  alarm: [home, null, (p) => p.locator('button[aria-label^="Alerts and alarms"]')],
  alarm_sheet: [home, (p) => p.locator('button[aria-label^="Alerts and alarms"]').click(), (p) => p.locator('.sheet .mode-switch[aria-label="Fajr"]')],
  qibla_tab: [home, null, tab('Qibla')],
  qibla: [{ ...home, tab: 'qibla', aligned: '1' }, null, (p) => p.locator('svg.ring')],
  masjid_tab: [home, null, tab('Masjid')],
  masjid: [{ ...home, tab: 'masjid' }, null, (p) => p.locator('.space-row').first()],
  settings_tab: [home, null, tab('Settings')],
  musafir_switch: [{ ...home, tab: 'settings' }, scrollTo('button[aria-label="Musafir features"]'), (p) => p.locator('button[aria-label="Musafir features"]')],
  musafir_line: [{ ...home, demo: 'travel' }, scrollTo('.musafir-chip-open'), (p) => p.locator('.musafir-chip-open')],
  journey: [{ ...home, demo: 'travel' }, (p) => p.locator('.musafir-chip-open').click(), (p) => p.getByText('You are a musafir')],
  falak_tab: [home, null, tab('Falak')],
  falak: [{ ...home, tab: 'falak' }, null, (p) => p.locator('svg[aria-label^="Shadow points"]')],
  date: [home, null, (p) => p.locator('.day-nav-main')],
  calendar: [home, (p) => p.locator('.day-nav-main').click(), (p) => p.getByText('1 Ramadan 1448 AH').locator('..')],
  print_row: [{ ...home, tab: 'settings' }, null, (p) => p.locator('a.item', { hasText: 'Print a prayer calendar' })],
  print_page: [{ ...home, page: 'print/' }, null, (p) => p.locator('button, .sheet-card, [role=radio]').filter({ hasText: /Monthly timetable|Islamic wall calendar/ }).first().locator('xpath=..')],
  help: [{ ...home, tab: 'settings' }, scrollTo('h2.group-title ~ * button, .x'), (p) => p.getByText('Show the quick guide', { exact: true })],
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  locale: 'en-US', timezoneId: 'Asia/Singapore', colorScheme: 'light' })
const overpass = readFileSync(join(root, 'scripts/fixtures/overpass-pasir-ris.json'), 'utf8')
await ctx.route(/data\.gov\.sg|e-solat|myquran/, (r) => r.abort())
await ctx.route(/PrayerTimesAsia\/masjids\//, (r) => r.fulfill({ status: 404, body: '' }))
await ctx.route(/overpass/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: overpass, headers: { 'access-control-allow-origin': '*' } }))

const boxes = {}
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null
for (const [name, [params, before, target]] of Object.entries(SHOTS)) {
  if (only && !only.test(name)) continue
  const { page: path = '', ...rest } = params
  const q = new URLSearchParams({ demo: '1', alerts: 'on', ...rest })
  const page = await ctx.newPage()
  await page.goto(`${origin}${path}?${path ? '' : q}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(params.tab === 'masjid' ? 2500 : params.tab === 'qibla' ? 1500 : 900)
  if (name === 'help' || name === 'print_row') await target(page).scrollIntoViewIfNeeded()
  else if (before) await before(page)
  await page.waitForTimeout(800)
  const el = target(page)
  if (name === 'help' || name === 'print_row') await el.evaluate((e) => e.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(300)
  const b = await el.boundingBox()
  if (!b) throw new Error(`no target for ${name}`)
  const r = (n) => Math.round(n * 1000) / 1000
  boxes[name] = { x: r(b.x / 393), y: r(b.y / 852), w: r(b.width / 393), h: r(b.height / 852) }
  const png = join(tmp, `${name}.png`)
  await page.screenshot({ path: png })
  execFileSync('convert', [png, '-resize', '330x', '-quality', '70', join(outImg, `${name}.webp`)])
  await page.close()
  console.log(name, boxes[name])
}
await browser.close(); server.close()
const file = resolve(root, '../data/guide-shots.json')
const old = !only || !existsSync(file) ? {} : JSON.parse(readFileSync(file, 'utf8'))
writeFileSync(file, JSON.stringify({ ...old, ...boxes }, null, 1) + '\n')
