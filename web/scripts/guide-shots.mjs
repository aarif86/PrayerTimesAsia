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
const NIGHT = '2026-10-25T00:49:00+08:00'
const light = { style: 'centre', appearance: 'system', now: DAY }
const dark = { style: 'centre', appearance: 'dark', now: NIGHT }
const tab = (name) => (p) => p.getByRole('button', { name, exact: true })
const scrollTo = (sel) => (p) => p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel)
const topBtn = (n) => (p) => p.locator('button.round-btn').nth(n)
const openMenu = (p) => p.locator('button.round-btn').nth(1).click()
const openAlerts = (p) => p.locator('button.round-btn').first().click()
const menuRow = (re) => (p) => p.locator('button.mi, a.mi').filter({ hasText: re }).first()
const lookRow = /Look and feel|Rupa dan|Gaya tampilan/
const alertsThen = (more) => async (p) => { await openAlerts(p); await p.waitForTimeout(500); if (more) await more(p) }

/** name: [query, before (what to do first), target (what the finger points at)] */
const SHOTS = {
  // Times
  home: [light, null, (p) => p.locator('.centre-dial').first()],
  home_next: [light, null, (p) => p.getByRole('button', { name: 'Next day' })],
  tomorrow: [light, (p) => p.getByRole('button', { name: 'Next day' }).click(), (p) => p.locator('.day-nav-main')],
  more: [light, scrollTo('.more-link'), (p) => p.locator('.more-link')],
  more_open: [light, async (p) => { await p.locator('.more-link').click(); await p.waitForTimeout(400); await scrollTo('.more-link')(p) }, (p) => p.locator('.more-link')],
  // The top bar and menu
  btn_alarm: [dark, null, topBtn(0)],
  btn_menu: [dark, null, topBtn(1)],
  menu_open: [dark, openMenu, (p) => p.getByRole('button', { name: 'Light', exact: true }).locator('..')],
  menu_look: [dark, openMenu, menuRow(lookRow)],
  menu_streak: [dark, openMenu, menuRow(/Prayer streak|Rentetan/)],
  // Looks
  look_list: [dark, async (p) => { await openMenu(p); await p.waitForTimeout(300); await menuRow(lookRow)(p).click(); await p.waitForTimeout(400) }, (p) => p.locator('button.mi').filter({ hasText: 'Sun Path' }).locator('..')],
  look_gold: [{ style: 'gold', appearance: 'light', now: DAY }, null, topBtn(1)],
  look_dark: [{ style: 'bands', appearance: 'dark', now: NIGHT }, null, topBtn(1)],
  // Alerts and alarms
  alarm_all: [dark, alertsThen(), (p) => p.locator('.sheet button.item').filter({ hasText: /Set for all|Tetapkan untuk|Atur untuk/ }).first()],
  alarm_each: [dark, alertsThen(), (p) => p.locator('.sheet .mode-block').first()],
  alarm_test: [dark, alertsThen(), (p) => p.locator('.test-card-btn')],
  alarm_early: [dark, alertsThen((p) => p.locator('.sheet button.item').filter({ hasText: /Remind me earlier|Ingatkan saya lebih awal/ }).first().scrollIntoViewIfNeeded()), (p) => p.locator('.sheet button.item').filter({ hasText: /Remind me earlier|Ingatkan saya lebih awal/ }).first()],
  // Qibla, Masjid
  qibla_tab: [dark, null, tab('Qibla')],
  qibla: [{ ...dark, tab: 'qibla', aligned: '1' }, null, (p) => p.locator('svg.ring, .qibla-dial, .qibla svg').first()],
  masjid_tab: [dark, null, tab('Masjid')],
  masjid: [{ ...dark, tab: 'masjid' }, null, (p) => p.locator('.space-row').first()],
  // Travel
  settings_tab: [light, null, tab('Settings')],
  travel_row: [{ ...light, tab: 'settings' }, null, (p) => p.locator('button.nav-item').filter({ hasText: /Prayer times/ }).first()],
  musafir_switch: [{ ...light, tab: 'settings' }, async (p) => { await p.locator('button.nav-item').first().click(); await p.waitForTimeout(500) }, (p) => p.locator('.item:has(.toggle, [role=switch], input[type=checkbox])').first()],
  musafir_line: [{ ...light, demo: 'travel' }, scrollTo('.musafir-chip-open'), (p) => p.locator('.musafir-chip-open')],
  journey: [{ ...light, demo: 'travel' }, (p) => p.locator('.musafir-chip-open').click(), (p) => p.getByText(/You are a traveller|You are a musafir/).first()],
  // Falak
  falak_tab: [light, null, tab('Falak')],
  falak: [{ ...light, tab: 'falak' }, null, (p) => p.locator('.falak2 svg').first()],
  falak_now: [{ ...light, tab: 'falak' }, null, (p) => p.locator('.falak2 .segmented button:nth-child(3)')],
  // Print, Yours
  print_row: [{ ...light, tab: 'settings' }, async (p) => { await p.locator('button.nav-item').filter({ hasText: /Prayer times/ }).first().click(); await p.waitForTimeout(500); await p.locator('a.item', { hasText: /Print a prayer calendar|Print/ }).first().scrollIntoViewIfNeeded() }, (p) => p.locator('a.item', { hasText: /Print a prayer calendar|Print/ }).first()],
  print_page: [{ ...light, page: 'print/' }, null, (p) => p.locator('button, .sheet-card, [role=radio]').filter({ hasText: /Monthly timetable|Islamic wall calendar/ }).first().locator('xpath=..')],
  date: [light, null, (p) => p.locator('.day-nav-main')],
  calendar: [light, (p) => p.locator('.day-nav-main').click(), (p) => p.locator('.sheet h2, .sheet h3').first()],
  help: [{ ...light, tab: 'settings' }, async (p) => { await p.locator('button.nav-item').filter({ hasText: /^Help/ }).first().click(); await p.waitForTimeout(500) }, (p) => p.locator('button.item').filter({ hasText: /quick guide/i }).first()],
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
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
  await page.addStyleTag({ content: '.hadith-card,.hadith-line,.hadith-undo{display:none!important}' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(params.tab === 'masjid' ? 2500 : params.tab === 'qibla' ? 1500 : 900)
  if (before) await before(page)
  await page.waitForTimeout(800)
  const el = target(page)
  await page.waitForTimeout(300)
  const b = await el.boundingBox({ timeout: 4000 }).catch(() => null)
  if (!b) { console.log('NO TARGET', name); await page.close(); continue }
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
