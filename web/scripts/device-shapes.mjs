// Pictures of the web app on many device shapes (small phones, folding phones open and
// closed, dual screens, tablets, laptops), with a check for sideways scrolling and cut-off
// text. Needs no network. Same demo place and clock as screenshots.mjs.
//
//   npm run build && node scripts/device-shapes.mjs [outDir]
//
// Exits with 1 when a screen scrolls sideways, so a layout slip is caught in the pull request.
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { chromium } from 'playwright'

const root = resolve(new URL('..', import.meta.url).pathname)
const dist = join(root, 'dist')
const out = resolve(process.argv[2] ?? join(root, 'docs/device-shapes'))
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
const origin = `http://127.0.0.1:${server.address().port}${base}`

const NIGHT = '2026-10-25T00:49:00+08:00'
const DAY = '2026-10-25T13:35:00+08:00'

// Sizes are CSS pixels (what the page sees), width x height.
const devices = [
  ['iphone-se', 320, 568, 'Small iPhone, the narrowest we support'],
  ['iphone-pro-max', 440, 956, 'Biggest iPhone'],
  ['galaxy-fold-closed', 344, 882, 'Galaxy Z Fold, cover screen (narrow and tall)'],
  ['galaxy-flip-cover', 412, 914, 'Galaxy Z Flip, open (tall 22:9)'],
  ['galaxy-flip-half-fold', 412, 420, 'Galaxy Z Flip folded half way (top half only, Flex mode)'],
  ['surface-duo-one-screen', 540, 720, 'Surface Duo style, one screen'],
  ['surface-duo-spanned', 1114, 720, 'Surface Duo style, spread over both screens (hinge in the middle, about 84px)'],
  ['fold-open-square', 673, 841, 'Galaxy Z Fold, opened'],
  ['pixel-fold-open', 841, 701, 'Pixel Fold, opened (nearly square, wide)'],
  ['ipad-portrait', 820, 1180, 'iPad portrait'],
  ['ipad-landscape', 1180, 820, 'iPad landscape'],
  ['phone-landscape', 852, 393, 'Phone on its side'],
  ['laptop', 1344, 667, 'Laptop window'],
]
const states = [
  ['centre-night', { style: 'centre', appearance: 'dark', now: NIGHT }],
  ['simple-day', { style: 'simple', appearance: 'light', now: DAY }],
  ['qibla', { tab: 'qibla', appearance: 'dark', now: NIGHT }],
  ['settings', { tab: 'settings', appearance: 'dark', now: NIGHT }],
]

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const report = []
for (const [dev, w, h, note] of devices) {
  const touch = w < 1000
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch,
    locale: 'en-US', timezoneId: 'Asia/Singapore', colorScheme: 'dark' })
  await context.route(/data\.gov\.sg|e-solat|myquran|overpass|tile\.openstreetmap|raw\.githubusercontent\.com/, (r) => r.abort())
  for (const [name, params] of states) {
    const q = new URLSearchParams({ demo: '1', ...params })
    const page = await context.newPage()
    await page.goto(`${origin}?${q}`, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(900)
    // Sideways scroll: the page (or a column that should not scroll) is wider than the window.
    const sideways = await page.evaluate(() => {
      const de = document.documentElement
      const wide = [...document.querySelectorAll('body *')].filter((el) => {
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        return r.width > 0 && s.position !== 'fixed' && r.right > de.clientWidth + 2 && !el.closest('[aria-hidden="true"], svg, .sky, .backdrop')
      }).slice(0, 3).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`)
      return { scrollW: de.scrollWidth, clientW: de.clientWidth, wide }
    })
    const bad = sideways.scrollW > sideways.clientW + 1
    report.push({ dev, name, w, h, note, bad, ...sideways })
    await page.screenshot({ path: join(out, `${dev}-${name}.png`) })
    await page.close()
    console.log(bad ? 'SIDEWAYS' : 'ok      ', dev, name, `${w}x${h}`, bad ? JSON.stringify(sideways) : '')
  }
  await context.close()
}
await browser.close()
server.close()

const bads = report.filter((r) => r.bad)
const md = ['# Device shapes check (web app)', '',
  bads.length ? `${bads.length} screen(s) scroll sideways:` : 'No screen scrolls sideways.', '',
  ...bads.map((r) => `- ${r.dev} ${r.name} (${r.w}x${r.h}): page ${r.scrollW}px in a ${r.clientW}px window, widest: ${r.wide.join(', ') || 'unknown'}`), '',
  '| Device | Size | What it stands for |', '|---|---|---|',
  ...devices.map(([d, w, h, n]) => `| ${d} | ${w}x${h} | ${n} |`), ''].join('\n')
writeFileSync(join(out, 'REPORT.md'), md)
process.exit(bads.length ? 1 : 0)
