/**
 * Builds the Journey Prayer Planner pages (English, Malay, Indonesian) into the assembled website folder.
 *
 *   cd web && npx vite-node scripts/build-journey-planner.ts -- <siteDir> <base>
 *
 * The page runs entirely in the visitor's browser with the same prayer engine as the apps (journey/planner.ts is
 * bundled into the page). Nothing a visitor types is sent anywhere. Run it BEFORE build-search-pages.ts so the
 * sitemap picks the pages up. Public copy rule: no colons or dashes in the sentences.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { CSS, THEME, TOGGLE } from './site-theme'
import { JOURNEY_DIR, JOURNEY_WORDS, type JLang } from '../journey/words'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const [siteDir, baseArg = '/'] = argv
if (!siteDir) throw new Error('usage: build-journey-planner.ts <siteDir> <base>')
const BASE = baseArg.endsWith('/') ? baseArg : baseArg + '/'
const ORIGIN = 'https://prayertimes.asia'
const LANGS: JLang[] = ['en', 'ms', 'id']
const HOME: Record<JLang, string> = { en: '', ms: 'ms/', id: 'id/' }
const NATIVE: Record<JLang, string> = { en: 'EN', ms: 'MS', id: 'ID' }
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const here = dirname(fileURLToPath(import.meta.url))
const out = (await build({
  configFile: false, logLevel: 'silent', root: resolve(here, '..'),
  build: { write: false, minify: true, target: 'es2020', lib: { entry: resolve(here, '../journey/planner.ts'), formats: ['iife'], name: 'JourneyPlanner', fileName: 'planner' } },
})) as { output: { type: string; code?: string }[] } | { output: { type: string; code?: string }[] }[]
const first = Array.isArray(out) ? out[0] : out
const code = first.output.find((o) => o.type === 'chunk')!.code!
const bundle = `journey-planner.js`

const EXTRA = `
  .planner{margin:18px 0 8px}
  fieldset.leg{border:1px solid var(--line);border-radius:var(--radius);background:var(--card);padding:14px 18px 18px;margin:14px 0;display:grid;grid-template-columns:1fr 1fr;gap:14px 16px}
  fieldset.leg legend{font-weight:800;padding:0 8px;color:var(--gold)}
  @media(max-width:620px){fieldset.leg{grid-template-columns:1fr}}
  label,.lbl{display:block;font-weight:700;font-size:.9rem;color:var(--muted);margin-bottom:4px}
  input[type=text],input[type=datetime-local]{width:100%;min-height:46px;border-radius:14px;border:1px solid var(--line);background:var(--night);color:var(--text);font:inherit;padding:8px 12px}
  input:focus-visible,button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
  .cf,.tf{position:relative}
  .cf ul{position:absolute;z-index:5;left:0;right:0;top:100%;margin:4px 0 0;padding:4px;list-style:none;background:var(--card);backdrop-filter:blur(14px);border:1px solid var(--line);border-radius:14px;box-shadow:0 10px 30px #0006;background-color:var(--night)}
  .cf li{padding:10px 12px;border-radius:10px;cursor:pointer}
  .cf li[aria-selected=true],.cf li:hover{background:var(--card);outline:1px solid var(--gold)}
  .cf li.none{color:var(--muted);cursor:default}
  .cf.fixed b{display:block;font-size:1.05rem}.cf.fixed small,.tf small{color:var(--muted);font-size:.82rem}
  .row{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
  button.btn{border:0;cursor:pointer;font:inherit;font-weight:800;margin:0}
  button.btn.o{border:1px solid var(--line)}
  .rm{grid-column:1/-1;justify-self:start}
  .go{font-size:1.05rem;padding:14px 28px}
  .err{color:#ff9b9b;font-weight:700}:root[data-theme=light] .err{color:#a30d0d}
  .sum{font-size:1.15rem;font-weight:800;color:var(--gold);margin:22px 0 0}
  .pic{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;margin:12px 0 4px}
  .rowl{font-size:.82rem;font-weight:700;color:var(--muted);margin:8px 0 4px}
  .bar{display:flex;height:40px;border-radius:12px;overflow:hidden;border:1px solid var(--line);background:var(--night)}
  .seg{display:flex;align-items:center;justify-content:center;overflow:hidden;min-width:0;white-space:nowrap}
  .seg.air{background:linear-gradient(135deg,#f2c063,#f39a4a);color:#1b1230}
  .seg.lay{background:#6a58b8}.seg.ground{background:var(--night);border:1px solid var(--line)}
  .seg.p b{font-size:.78rem;color:#1b1230;padding:0 4px;overflow:hidden;text-overflow:ellipsis}
  .ends{display:flex;justify-content:space-between;gap:10px;font-size:.85rem;color:var(--muted);margin-top:8px}.ends span:last-child{text-align:right}
  .key{display:flex;flex-wrap:wrap;gap:14px;font-size:.82rem;color:var(--muted);margin-top:10px}.key i{display:inline-block;width:14px;height:14px;border-radius:4px;vertical-align:-2px;margin-right:6px}
  .note{color:var(--muted);font-size:.92rem}
  .pc{border-left:6px solid var(--pc)}.pc h3{margin:2px 0 6px;font-size:1.2rem}
  .pc ul{margin:8px 0 0;padding-left:20px}.pc li{margin:6px 0}.pc li small{display:block;color:var(--muted)}
  .when{margin:4px 0;font-size:.95rem}
  .badge{display:inline-block;font-size:.72rem;font-weight:800;border-radius:999px;padding:3px 10px;margin-left:6px;vertical-align:2px;border:1px solid var(--line)}
  .badge.air{background:linear-gradient(135deg,#f2c063,#f39a4a);color:#1b1230;border:0}.badge.part{border-color:var(--gold);color:var(--gold)}
  .cta .btn{margin-top:6px}
  @media print{.planner form,.cta,.row{display:none!important}.pic{border:1px solid #999!important;background:#fff!important}.seg.p b{color:#000}.pc{border-left-color:#000!important}.badge,.sum{color:#000!important}}
`

function page(l: JLang): string {
  const w = JOURNEY_WORDS[l]
  const path = `${JOURNEY_DIR[l]}/`
  const up = '../'.repeat(path.split('/').filter(Boolean).length)
  const alts = LANGS.map((x) => `<link rel="alternate" hreflang="${x}" href="${ORIGIN}/${JOURNEY_DIR[x]}/" />`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${ORIGIN}/${JOURNEY_DIR.en}/" />`
  const ld = { '@context': 'https://schema.org', '@type': 'WebApplication', name: w.h1, url: `${ORIGIN}/${path}`, applicationCategory: 'LifestyleApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, inLanguage: l, description: w.desc, publisher: { '@id': `${ORIGIN}/#org` } }
  return `<!doctype html>
<html lang="${l}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#0b0f2a" />
<meta name="color-scheme" content="dark light" />
<title>${esc(w.title)}</title>
<meta name="description" content="${esc(w.desc)}" />
<link rel="canonical" href="${ORIGIN}/${path}" />
${alts}
<link rel="icon" type="image/png" sizes="32x32" href="${up}img/favicon-32.png" />
<link rel="apple-touch-icon" href="${up}img/apple-touch-icon.png" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Prayer Times Asia" />
<meta property="og:title" content="${esc(w.title)}" />
<meta property="og:description" content="${esc(w.desc)}" />
<meta property="og:url" content="${ORIGIN}/${path}" />
<meta property="og:image" content="${ORIGIN}/img/share.png" />
<meta name="twitter:card" content="summary_large_image" />
<style>${CSS}${EXTRA}</style>
${THEME}
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body data-app="${BASE}app/">
<header class="top"><div class="wrap"><a class="brand" href="${BASE}${HOME[l]}"><img src="${up}img/icon-96.webp" alt="" width="34" height="34" /><span class="bt">Prayer Times Asia</span></a>
<div class="tr"><nav class="langs" aria-label="Language">${LANGS.map((x) => `<a href="${BASE}${JOURNEY_DIR[x]}/" hreflang="${x}" lang="${x}"${x === l ? ' aria-current="page"' : ''}>${NATIVE[x]}</a>`).join('')}</nav>
<button class="mode" type="button" hidden aria-label="${esc(w.theme)}"></button><a class="btn sm" href="${BASE}app/">${esc(w.open)}</a></div></div></header>
<main class="wrap">
<div class="print-only printbrand"><img src="${up}img/icon-96.webp" alt="" width="28" height="28" /> Prayer Times Asia · prayertimes.asia</div>
<nav aria-label="Breadcrumb" class="date noprint"><a href="${BASE}${HOME[l]}">${esc(w.home)}</a> / ${esc(w.crumb)}</nav>
<span class="eyebrow">${esc(w.eyebrow)}</span>
<h1>${esc(w.h1)}</h1>
<p class="lead">${esc(w.lead)}</p>
<p class="date">${esc(w.steps)} ${esc(w.footFollow)}</p>
<div class="planner" id="planner"><noscript><p class="card">JavaScript is needed for this planner. It runs on your device and sends nothing anywhere.</p></noscript></div>
</main>
<footer><div class="wrap"><div>${esc(w.footFollow)} <a href="${BASE}about.html">${esc(w.about)}</a> · <a href="${BASE}sources.html">${esc(w.sources)}</a> · <a href="${BASE}privacy.html">${esc(w.privacy)}</a></div>
<div>${esc(w.nasar)} <a href="https://nasardigital.com/">Nasar Digital</a></div></div></footer>
${TOGGLE}
<script type="application/json" id="jw">${JSON.stringify(w).replace(/</g, '\\u003c')}</script>
<script src="${up}${bundle}" defer></script>
</body>
</html>
`
}

const put = (p: string, body: string) => { const f = join(siteDir, p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, body) }
put(bundle, code)
for (const l of LANGS) put(`${JOURNEY_DIR[l]}/index.html`, page(l))
console.log(`Journey planner built: ${LANGS.length} pages, script ${(code.length / 1024).toFixed(0)} KB`)
