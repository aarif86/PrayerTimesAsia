/** The look shared by every generated page (city pages, planner). Moved out of build-search-pages.ts unchanged. */
export const CSS = `
  :root{--night:#0b0f2a;--card:rgba(255,255,255,.05);--line:rgba(255,255,255,.10);--text:#eef0fa;--muted:#a9b2d6;--gold:#f2c063;--ember:#f39a4a;--radius:22px;color-scheme:dark;
    --font:ui-rounded,"SF Pro Rounded","Nunito",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  :root[data-theme=light]{--night:#F2EEE9;--card:#fff;--line:rgba(21,26,69,.13);--text:#151A45;--muted:#4c5380;--gold:#8a5a00;color-scheme:light}
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%;overflow-x:clip}
  body{margin:0;background:var(--night);color:var(--text);font-family:var(--font);font-size:17px;line-height:1.6;overflow-x:clip}
  body::before{content:"";position:fixed;inset:0;z-index:-1;background:
    radial-gradient(1px 1px at 12% 18%,#fff8 50%,transparent 51%),radial-gradient(1px 1px at 72% 9%,#fff6 50%,transparent 51%),
    radial-gradient(1.5px 1.5px at 85% 32%,#fff7 50%,transparent 51%),radial-gradient(1px 1px at 33% 42%,#fff5 50%,transparent 51%),
    radial-gradient(1px 1px at 58% 66%,#fff5 50%,transparent 51%),radial-gradient(1.5px 1.5px at 22% 78%,#fff6 50%,transparent 51%),
    radial-gradient(60% 50% at 80% 0%,#2a2f78 0%,transparent 70%),radial-gradient(50% 40% at 0% 100%,#3a1f52 0%,transparent 70%),var(--night)}
  :root[data-theme=light] body::before{background:radial-gradient(50% 40% at 85% 0%,#f7bd8f90,transparent 70%),radial-gradient(40% 35% at 0% 100%,#e2b65a60,transparent 70%),var(--night)}
  a{color:var(--gold)}
  .wrap{max-width:900px;margin:0 auto;padding:0 20px}
  header.top{position:sticky;top:0;z-index:10;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);background:rgba(11,15,42,.72);border-bottom:1px solid var(--line)}
  :root[data-theme=light] header.top{background:rgba(242,238,233,.85)}
  header.top .wrap{display:flex;align-items:center;justify-content:space-between;height:62px;gap:10px}
  .brand{display:flex;align-items:center;gap:10px;color:var(--text);text-decoration:none;font-weight:800;white-space:nowrap}
  .brand img{width:34px;height:34px;border-radius:9px}
  .tr{display:flex;align-items:center;gap:8px}
  .langs{display:flex;gap:4px}.langs a{border:1px solid var(--line);border-radius:999px;padding:6px 11px;font-size:.78rem;font-weight:800;letter-spacing:.04em;color:var(--muted);text-decoration:none;min-height:34px;display:inline-flex;align-items:center}
  .langs a[aria-current]{background:var(--card);color:var(--text);border-color:var(--gold)}
  .mode{width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--gold);cursor:pointer;font-size:1.05rem}
  .btn{display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f2c063,#f39a4a);color:#1b1230;font-weight:800;border-radius:999px;padding:12px 20px;min-height:46px;text-decoration:none;margin:4px 8px 4px 0}
  .btn.o{background:var(--card);color:var(--text);border:1px solid var(--line)}
  .btn.sm{padding:8px 14px;min-height:40px;font-size:.9rem;margin:0}
  @media(max-width:520px){.tr .btn.sm{display:none}}
  :lang(th),:lang(my),:lang(km),:lang(si),:lang(hi),:lang(ne){letter-spacing:0!important;text-transform:none}
  h1{font-size:clamp(1.9rem,5.5vw,2.8rem);font-weight:800;margin:30px 0 6px;letter-spacing:-.01em;line-height:1.15}
  h2{font-size:1.35rem;font-weight:800;margin:36px 0 10px}
  .srcbadge{margin:8px 0;font-size:.9rem}.srcbadge span{color:var(--muted)}.srcbadge b{display:inline-block;border:1px solid var(--gold);border-radius:99px;padding:2px 12px;color:var(--gold);margin-left:6px}
  .eyebrow{display:inline-block;font-size:.8rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-top:26px}
  .date{color:var(--muted);margin:0 0 14px}.lead{color:var(--muted);font-size:1.08rem}
  .times{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin:18px 0 6px;padding:0;list-style:none}
  .times li{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px}
  .times b{display:block;color:var(--muted);font-weight:700;font-size:.9rem}
  .times span{font-size:1.55rem;font-weight:800;color:var(--gold);white-space:nowrap}
  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:16px 20px;margin:14px 0}
  .card p{margin:6px 0}
  table{width:100%;border-collapse:collapse;font-size:.92rem}
  th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
  th{color:var(--muted);font-weight:700}
  tr.now td{color:var(--gold);font-weight:800}
  .scroll{overflow-x:auto;border:1px solid var(--line);border-radius:18px;margin:10px 0;background:var(--card)}
  details{margin:10px 0}summary{cursor:pointer;font-weight:700}
  dt{font-weight:800;margin-top:16px}dd{margin:4px 0 0;color:var(--muted)}
  .links{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}
  .links a{display:inline-block;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:7px 15px;text-decoration:none;color:var(--text);font-size:.95rem}
  footer{color:var(--muted);padding:34px 0 70px;margin-top:50px;border-top:1px solid var(--line);font-size:.92rem}
  footer a{color:var(--muted)}
  footer .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:14px}
  @media print{
    .printbrand{display:flex!important}
    body{background:#fff!important;color:#000!important;font-size:11pt}body::before,header.top,footer,.noprint,.cta{display:none!important}
    .card,.scroll,.times li{background:#fff!important;border:1px solid #999!important;color:#000!important}
    .times span,tr.now td,a,.eyebrow{color:#000!important}th,.date,.lead,dd{color:#333!important}
    table{font-size:9pt}th,td{padding:3px 5px;border-bottom:1px solid #bbb}
    h2{break-after:avoid}table,.card{break-inside:avoid}.print-only{display:block!important}
  }
  .print-only{display:none}
  .printbrand{align-items:center;gap:10px;font-weight:800;margin-bottom:8px}.printbrand img{border-radius:8px}
  [dir=rtl] th,[dir=rtl] td{text-align:right}
  @media(max-width:700px){.langs a{padding:6px 8px;font-size:.72rem}.tr{gap:5px}.mode{width:36px;height:36px}}
  @media(max-width:560px){.bt{display:none}}
`
export const THEME = `<script>(function(){var t=null;try{t=localStorage.getItem('pta-theme')}catch(e){}if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.setAttribute('data-theme',t)})()</script>`
export const TOGGLE = `<script>(function(){var b=document.querySelector('.mode');if(!b)return;b.hidden=false;function paint(){b.textContent=document.documentElement.getAttribute('data-theme')==='light'?'\\u2600':'\\u263E'}paint();b.addEventListener('click',function(){var t=document.documentElement.getAttribute('data-theme')==='light'?'dark':'light';document.documentElement.setAttribute('data-theme',t);try{localStorage.setItem('pta-theme',t)}catch(e){}paint()})})()</script>`

