// Accessibility check of every screen of the web app and the mosque screen,
// with axe-core in Chromium. Light and Dark, every Prayer screen style, every
// mosque screen look, the sheets, and 200% text. Fails on serious or critical
// problems.
//
//   npm run build && node scripts/a11y.mjs
//
// ONLY=regex runs some pages. Set CHROMIUM_PATH to use another Chromium.
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { extname, join, resolve } from 'node:path'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const root = resolve(new URL('..', import.meta.url).pathname)
const dist = join(root, 'dist')
// The same base path the app was built with (vite.config.ts reads BASE_PATH too).
const base = process.env.BASE_PATH || '/PrayerTimesAsia/'

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.webp': 'image/webp' }
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (!path.startsWith(base)) { res.writeHead(302, { location: base }); return res.end() }
  path = path.slice(base.length) || 'index.html'
  let file = join(dist, path)
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  if (!existsSync(file)) file = join(dist, 'index.html')
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
}).listen(0)
const origin = `http://127.0.0.1:${server.address().port}${base}`

const NIGHT = '2026-10-25T00:49:00+08:00'
const DAY = '2026-10-25T13:35:00+08:00'
const STYLES = ['list', 'centre', 'dial', 'sunPath', 'bands', 'simple']
const click = (sel) => (p) => p.click(sel)

/** [name, path and query, optional action before the check] */
const pages = []
for (const appearance of ['light', 'dark']) {
  for (const style of STYLES) pages.push([`prayer-${style}-${appearance}`, { style, appearance, now: appearance === 'light' ? DAY : NIGHT }])
  pages.push([`prayer-more-${appearance}`, { style: 'centre', appearance, now: NIGHT, more: '1' }])
  for (const tab of ['qibla', 'falak', 'masjid', 'settings']) pages.push([`${tab}-${appearance}`, { tab, appearance, now: appearance === 'light' ? DAY : NIGHT }])
  pages.push([`source-sheet-${appearance}`, { style: 'centre', appearance, now: NIGHT }, click('.source-line')])
  pages.push([`calendar-sheet-${appearance}`, { style: 'centre', appearance, now: NIGHT }, click('.day-nav-main')])
  pages.push([`places-sheet-${appearance}`, { style: 'centre', appearance, now: NIGHT }, async (p) => { await p.click('.place-chip'); await p.fill('input[type=search]', 'ku') }])
  pages.push([`alarms-sheet-${appearance}`, { style: 'centre', appearance, now: NIGHT }, click('button[aria-label^="Alerts and alarms"]')])
  pages.push([`journey-sheet-${appearance}`, { demo: 'travel', style: 'centre', appearance, now: NIGHT }, click('button[aria-label^="Musafir"]')])
  pages.push([`masjid-about-${appearance}`, { tab: 'masjid', appearance, now: NIGHT }, click('button[aria-label="About this app"]')])
}
pages.push(['prayer-simple-large', { style: 'simple', appearance: 'dark', now: NIGHT, large: '1' }])
pages.push(['prayer-text-200', { style: 'centre', appearance: 'dark', now: NIGHT }, (p) => p.addStyleTag({ content: 'html { font-size: 200% !important }' })])
pages.push(['settings-text-200', { tab: 'settings', appearance: 'light', now: DAY }, (p) => p.addStyleTag({ content: 'html { font-size: 200% !important }' })])
for (const look of ['night', 'day', 'board', 'bands', 'dial', 'sunpath']) pages.push([`screen-${look}`, { path: 'screen/', look }])
pages.push(['screen-surau', { path: 'screen/', look: 'surau' }], ['screen-surau-light', { path: 'screen/', look: 'surau', mode: 'light' }])
// The layouts with slides and notices, in a few looks, Light and Dark.
for (const layout of ['splitN', 'split', 'mirror', 'strip', 'big', 'port', 'portT']) {
  pages.push([`screen-layout-${layout}`, { path: 'screen/', look: 'surau', layout }], [`screen-layout-${layout}-light`, { path: 'screen/', look: 'night', mode: 'light', layout }])
}
for (const look of ['board', 'bands', 'dial', 'sunpath', 'simple']) pages.push([`screen-layout-splitN-${look}`, { path: 'screen/', look, layout: 'splitN' }])
pages.push(['screen-setup', { path: 'screen/', hash: 'setup' }])

const IMPACT = { minor: 0, moderate: 1, serious: 2, critical: 3 }
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
// A fresh browser profile for every page, so one page's choices never leak into the next.
async function newPage() {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, locale: 'en-US', timezoneId: 'Asia/Singapore', reducedMotion: 'reduce',
  })
  // Repeatable and offline: no official downloads, no map tiles, no masjid search.
  await context.route(/data\.gov\.sg|e-solat|myquran|raw\.githubusercontent|tile\.openstreetmap|overpass|nominatim/, (r) => r.abort())
  return context.newPage()
}

const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null
let failures = 0
for (const [name, params, action] of pages) {
  if (only && !only.test(name)) continue
  const { path = '', hash = '', ...rest } = params
  const q = new URLSearchParams({ demo: '1', preview: 'off', ...rest })
  const page = await newPage()
  await page.goto(`${origin}${path}?${q}${hash ? `#${hash}` : ''}`, { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, `${name}.png`) })
  if (action) {
    try { await action(page); await page.waitForTimeout(700) } catch (e) {
      failures++; console.log(`FAIL ${name}  could not open it: ${String(e.message).split('\n')[0]}`); await page.context().close(); continue
    }
  }
  await page.addScriptTag({ content: axeSource })
  const result = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }))
  const bad = result.violations.filter((v) => IMPACT[v.impact] >= IMPACT.serious)
  if (bad.length) failures += bad.length
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${name}${result.violations.length ? `  (${result.violations.map((v) => `${v.id}:${v.impact}`).join(', ')})` : ''}`)
  for (const v of bad) {
    console.log(`     ${v.id} (${v.impact}) ${v.help}`)
    for (const n of v.nodes.slice(0, 6)) console.log(`       ${n.target.join(' ')}  ${n.failureSummary?.split('\n').slice(1, 2).join(' ').trim() ?? ''}`)
  }
  await page.context().close()
}
// Keyboard only: a sheet opens with Enter, takes the focus, keeps Tab inside, and Escape gives the focus back.
if (!only || only.test('keyboard')) {
  const page = await newPage()
  await page.goto(`${origin}?${new URLSearchParams({ demo: '1', preview: 'off', style: 'centre', now: NIGHT })}`, { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  await page.focus('.source-line')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  const inSheet = () => page.evaluate(() => !!document.activeElement?.closest('.sheet'))
  const problems = []
  if (!(await inSheet())) problems.push('the focus did not move into the sheet')
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab')
  if (!(await inSheet())) problems.push('Tab left the open sheet')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const back = await page.evaluate(() => document.activeElement?.classList.contains('source-line'))
  if (!back) problems.push('Escape did not give the focus back to the button that opened the sheet')
  failures += problems.length
  console.log(`${problems.length ? 'FAIL' : 'ok  '} keyboard${problems.length ? `  ${problems.join('; ')}` : ''}`)
  await page.context().close()
}

await browser.close()
server.close()
if (failures) { console.error(`\n${failures} serious accessibility problems`); process.exit(1) }
console.log('\nNo serious accessibility problems')
