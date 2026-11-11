import { useState } from 'preact/hooks'
import {
  BookOpen, Check, ChevronDown, ChevronRight, ExternalLink, Gift, HandCoins, HandHeart, Moon, MoonStar, Printer, Share2, Sparkles, Sunrise, Utensils,
} from 'lucide-preact'
import { authorityName } from '../core/calendarSanad'
import { DOA, juzLink, lang3, MISSED, ZAKAT, ZAKAT_NOTE, type DoaId, type FastMark, type Lang3 } from '../core/ramadanContent'
import { fastMarkLabel, fastMarkLetter, RAMADAN_LOCALE, wordsFor } from '../core/ramadanWords'
import { addDays, civilKey, daysApart, type CivilDay } from '../core/season'
import { store, useNow, useStore } from '../services/store'
import { openSheet, Sheet, short, TimeText, ToggleItem } from './common'
import { Hadith } from './Hadith'
import { rayaCard, sharePicture, weekCard } from './shareCard'

const fmtCivil = (d: CivilDay, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }, lang: Lang3 = 'en') =>
  new Intl.DateTimeFormat(RAMADAN_LOCALE[lang], { timeZone: 'UTC', ...opts }).format(new Date(Date.UTC(d.year, d.month - 1, d.day))).replace(',', '')

const ODD_NIGHTS = [21, 23, 25, 27, 29]

/** "tomorrow", "the day after tomorrow" or the date. */
function whenWords(from: CivilDay, d: CivilDay, lang: Lang3): string {
  const t = wordsFor(lang)
  const n = daysApart(from, d)
  const date = fmtCivil(d, { weekday: 'long', day: 'numeric', month: 'short' }, lang)
  if (n === 0) return t('today')
  if (n === 1) return t('tomorrow', { d: date })
  if (n === 2) return t('dayAfterTomorrow', { d: date })
  return fmtCivil(d, undefined, lang)
}

/** The Ramadan words in the language of the prayer names. */
function useWords() {
  const lang = lang3(useStore().naming)
  return { lang, t: wordsFor(lang) }
}

// ---------- The card on the Prayer screen ----------

/** Ramadan, Raya and Syawal at the top of the Prayer screen. Nothing outside the season. */
export function SeasonCard({ now }: { now: number }) {
  const s = useStore()
  const season = s.season(now)
  const today = s.civil(now)
  const key = civilKey(today)
  const authority = s.communityAuthority
  const preview = s.isSeasonPreview
  const { lang, t } = useWords()
  const previewTag = preview && <span class="preview-tag">{t('preview')}</span>

  if (season.phase === 'none') return null

  if (season.phase === 'syaaban') {
    const start = s.monthDays(season.hijri.year, 9)[0]
    const days = start ? daysApart(today, start) : null
    return (
      <button class="season-card glass" onClick={() => openSheet({ kind: 'ramadan' })}>
        <MoonStar size={26} class="season-icon" />
        <span class="season-text">
          {season.sightingTonight ? (
            <>
              <span class="season-title">{t('sightingTonightTitle')}</span>
              <span class="season-sub">{authority ? t('sightingAnnounces', { a: authorityName(authority) }) : t('sightingMaybe')}</span>
            </>
          ) : season.nextStart?.announced ? (
            <>
              <span class="season-title">{t('ramadanBegins', { w: whenWords(today, season.nextStart.day, lang) })}</span>
              <span class="season-sub">{t('announcedBy', { a: authorityName(authority ?? '') })}</span>
            </>
          ) : days != null && days >= 0 ? (
            <>
              <span class="season-title">{days === 0 ? t('beginsToday') : days === 1 ? t('beginsTomorrow') : t('beginsInDays', { n: days })}</span>
              <span class="season-sub">{days <= 1 ? t('firstTarawihTonight') : t('getReady')}</span>
            </>
          ) : <span class="season-title">{t('ramadanNear')}</span>}
        </span>
        <ChevronRight size={16} class="secondary" />
        {previewTag}
      </button>
    )
  }

  if (season.phase === 'ramadan') {
    const moment = s.fastingMoment(now)
    const mark = s.fastMark(key)
    const tarawih = s.prefs.tarawihLog.includes(key)
    const read = s.prefs.quranLog.includes(key)
    const night = season.nightTonight
    return (
      <div class="season-card glass ramadan">
        <button class="season-main" onClick={() => openSheet({ kind: 'ramadan' })} aria-label={t('cardAria', { n: season.ramadanDay ?? '' })}>
          <span class="season-day"><span class="caps">{t('ramadan')}</span><span class="mono big">{season.ramadanDay}</span></span>
          {moment ? (
            <span class="season-count">
              <span class="caps">{moment.kind === 'imsak' ? t('imsakIn') : t('berbukaIn')}</span>
              <span class="mono count">{short(moment.time - now)}</span>
              <span class="secondary at">{moment.kind === 'imsak' ? t('finishSahurBy') : t('maghribAt')} <TimeText ms={moment.time} size={15} weight={600} /></span>
            </span>
          ) : (
            <span class="season-count"><span class="caps">{t('tonight')}</span><span class="count small">{season.sightingTonight ? t('sightingForRaya') : t('tarawihAfterIsyak')}</span></span>
          )}
          <ChevronRight size={16} class="secondary" />
        </button>
        {season.sightingTonight && (
          <p class="season-note"><MoonStar size={14} /> {season.nextStart?.announced
            ? t('rayaAnnounced', { w: whenWords(today, season.nextStart.day, lang), a: authorityName(authority ?? '') })
            : t('rayaSighting', { a: authority ? authorityName(authority) : t('yourAuthority') })}</p>
        )}
        {!season.sightingTonight && season.hijri.day === 30 && <p class="season-note"><Sparkles size={14} /> {t('lastFast')}</p>}
        {season.lastTen && night && night <= 30 && (
          <p class="season-note"><Sparkles size={14} /> {season.oddNight ? t('oddNight', { n: night }) : t('lastTenNight', { n: night })}</p>
        )}
        {season.nuzulQuran && <p class="season-note"><BookOpen size={14} /> {t('nuzulQuran')}</p>}
        <div class="season-chips">
          <button class={`chip ${mark === 'fasted' ? 'on' : ''}`} aria-pressed={mark === 'fasted'}
            onClick={() => s.setFast(key, mark === 'fasted' ? null : 'fasted')}>
            {mark === 'fasted' ? <Check size={14} /> : <Utensils size={14} />}{mark && mark !== 'fasted' ? fastMarkLabel(lang, mark) : t('fastingToday')}
          </button>
          <button class={`chip ${tarawih ? 'on' : ''}`} aria-pressed={tarawih} onClick={() => s.toggleDay('tarawihLog', key)}>
            {tarawih ? <Check size={14} /> : <Moon size={14} />}{t('tarawih')}
          </button>
          {s.prefs.khatamPlan && season.ramadanDay && (
            <button class={`chip ${read ? 'on' : ''}`} aria-pressed={read} onClick={() => s.toggleDay('quranLog', key)}>
              {read ? <Check size={14} /> : <BookOpen size={14} />}{t('juz', { n: season.ramadanDay })}
            </button>
          )}
        </div>
        {previewTag}
      </div>
    )
  }

  // Raya and Syawal.
  const sum = s.fastSummary(season.hijri.year)
  const zakatPaid = s.prefs.zakatPaid.includes(season.hijri.year)
  const eid = s.eidPrayer
  return (
    <button class={`season-card glass ${season.phase === 'raya' ? 'raya' : ''}`} onClick={() => openSheet({ kind: 'ramadan' })}>
      {season.phase === 'raya' ? <Gift size={26} class="season-icon" /> : <MoonStar size={26} class="season-icon" />}
      <span class="season-text">
        {season.phase === 'raya' ? (
          <>
            <span class="season-title">{t('selamatHariRaya')}</span>
            <span class="season-sub">
              {eid ? t('rayaPrayerAt', { p: s.prefs.myMasjid?.name ?? t('yourMasjid'), t: eid }) : t('takbirUntilPrayer')}{' '}
              {!zakatPaid ? t('payZakatBefore') : t('maafZahirBatin')}
            </span>
          </>
        ) : (
          <>
            <span class="season-title">{t('syawalCardTitle', { d: season.syawalDay ?? '', n: Math.min(6, sum.syawal) })}</span>
            <span class="season-sub">{sum.owed > 0 ? `${t('fastsToReplace', { n: sum.owed })} ` : ''}{t('tapToMarkSyawal')}</span>
          </>
        )}
      </span>
      <ChevronRight size={16} class="secondary" />
      {previewTag}
    </button>
  )
}

// ---------- The Ramadan page ----------

export function RamadanSheet() {
  const s = useStore()
  const now = useNow(30_000)
  const season = s.season(now)
  const { t } = useWords()
  const title = season.phase === 'raya' || season.phase === 'syawal' ? t('syawal') : t('ramadan')
  const year = season.hijri.year
  return (
    <Sheet title={title} full>
      {s.isSeasonPreview && (
        <p class="preview-banner">{t('previewBanner')}</p>
      )}
      {(season.phase === 'raya' || season.phase === 'syawal') ? (
        <>
          <RayaToday now={now} />
          <SyawalFasts now={now} year={year} />
          <DoaList ids={['takbir', 'niatSyawal', 'niatQadha']} />
          <ZakatCard year={year} />
          <RayaShare />
          <RamadanMonth now={now} year={year} compact />
        </>
      ) : (
        <>
          <RamadanToday now={now} />
          <RamadanMonth now={now} year={season.phase === 'ramadan' ? year : year} />
          <LastTenNights now={now} year={year} />
          <DoaList ids={['niatPuasa', 'berbuka', 'berbukaHadith', 'qadr']} />
          <ZakatCard year={year} />
          <TravelFasting />
          <RamadanTools now={now} />
          <RamadanSettings />
        </>
      )}
      <p class="caption secondary" style={{ padding: '4px 20px 28px' }}>
        {t('footer', { a: s.communityAuthority ? authorityName(s.communityAuthority) : t('yourAuthorityLower') })}
      </p>
    </Sheet>
  )
}

function RamadanToday({ now }: { now: number }) {
  const s = useStore()
  const season = s.season(now)
  const today = s.day(now)
  const { lang, t } = useWords()
  if (!today) return null
  const inRamadan = season.phase === 'ramadan'
  // Before Ramadan, show the first day's times.
  const first = inRamadan ? null : s.monthDays(season.hijri.year, 9)[0]
  const shownDay = first ? s.dayOfCivil(first) : today
  if (!shownDay) return null
  const moment = s.fastingMoment(now)
  return (
    <>
    <div class="glass card ramadan-today" style={{ marginTop: '10px', marginBottom: '18px' }}>
      <div class="caps accent">{inRamadan ? t('ramadanDay', { n: season.ramadanDay ?? '' }) : first ? t('firstOfRamadan', { d: fmtCivil(first, undefined, lang) }) : t('ramadan')}</div>
      <div class="rt-times">
        <div><span class="caps secondary">{t('imsak')}</span><TimeText ms={s.imsak(shownDay)} size={34} weight={700} /><span class="caption secondary">{t('stopEating')}</span></div>
        <div><span class="caps secondary">{t('subuh')}</span><TimeText ms={shownDay.times.fajr} size={34} weight={700} /><span class="caption secondary">{t('fastBegins')}</span></div>
        <div class="gold"><span class="caps">{t('berbuka')}</span><TimeText ms={shownDay.times.maghrib} size={34} weight={700} /><span class="caption secondary">{t('maghrib')}</span></div>
      </div>
      {inRamadan && moment && <p class="rt-count mono">{t('countIn', { w: moment.kind === 'imsak' ? t('imsak') : t('berbuka'), l: short(moment.time - now) })}</p>}
      {inRamadan && <FastToday now={now} />}
    </div>
    {inRamadan && <Hadith id="iftar" tag={moment?.kind === 'berbuka' ? t('beforeBerbuka') : undefined} />}
    </>
  )
}

const MARK_ORDER: (FastMark | null)[] = [null, 'fasted', 'period', 'sick', 'travel', 'other']

function FastToday({ now }: { now: number }) {
  const s = useStore()
  const key = civilKey(s.civil(now))
  const mark = s.fastMark(key)
  const [open, setOpen] = useState(false)
  const { lang, t } = useWords()
  return (
    <div class="fast-today">
      <div class="season-chips">
        <button class={`chip ${mark === 'fasted' ? 'on' : ''}`} aria-pressed={mark === 'fasted'} onClick={() => s.setFast(key, mark === 'fasted' ? null : 'fasted')}>
          {mark === 'fasted' ? <Check size={14} /> : <Utensils size={14} />}{t('imFastingToday')}
        </button>
        <button class={`chip ${mark && MISSED.includes(mark) ? 'on missed' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
          {mark && MISSED.includes(mark) ? t('missedBecause', { r: fastMarkLabel(lang, mark) }) : t('notFastingToday')}<ChevronDown size={14} />
        </button>
      </div>
      {open && (
        <div class="season-chips">
          {MISSED.map((m) => (
            <button class={`chip small ${mark === m ? 'on missed' : ''}`} onClick={() => { s.setFast(key, mark === m ? null : m); setOpen(false) }}>{fastMarkLabel(lang, m)}</button>
          ))}
        </div>
      )}
      {mark === 'period' && <p class="caption secondary">{t('pauseTrackerToo')}</p>}
    </div>
  )
}

/** The month at a glance: tap a day to change how it went. */
function RamadanMonth({ now, year, compact }: { now: number; year: number; compact?: boolean }) {
  const s = useStore()
  const days = s.monthDays(year, 9)
  const todayKey = civilKey(s.civil(now))
  const sum = s.fastSummary(year)
  const { lang, t } = useWords()
  if (!days.length || civilKey(days[0]) > todayKey) return null
  const cycle = (k: string) => {
    const m = s.fastMark(k)
    const next = MARK_ORDER[(MARK_ORDER.indexOf(m) + 1) % MARK_ORDER.length]
    s.setFast(k, next)
  }
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>{compact ? t('ramadanYear', { y: year }) : t('yourFastsThisMonth')}</h3>
      <div class="glass card">
        <div class="fast-grid" role="grid">
          {days.map((d, i) => {
            const k = civilKey(d)
            const m = s.fastMark(k)
            const future = k > todayKey
            const kind = m === 'fasted' ? 'fasted' : m && MISSED.includes(m) ? 'missed' : ''
            return (
              <button class={`fast-day ${kind} ${k === todayKey ? 'is-today' : ''} ${ODD_NIGHTS.includes(i + 1) ? 'odd' : ''}`} disabled={future}
                aria-label={t('ramadanDayAria', { n: i + 1, d: fmtCivil(d, { day: 'numeric', month: 'short' }, lang), s: m ? fastMarkLabel(lang, m) : t('notMarked') })}
                onClick={() => cycle(k)}>
                <span class="mono">{i + 1}</span>
                {m && m !== 'fasted' && <span class="fast-reason" aria-hidden="true">{fastMarkLetter(lang, m)}</span>}
              </button>
            )
          })}
        </div>
        <p class="tracker-sum">
          <b class="mono">{sum.fasted}</b> {t('fastedCount')}{sum.missed > 0 && <> · <b class="mono">{sum.missed}</b> {t('missedCount')}</>}
          {sum.owed > 0 && <span class="secondary"> · {t('toReplace', { n: sum.owed })}</span>}
        </p>
        <p class="caption secondary" style={{ margin: 0 }}>{t('monthHelp')}</p>
      </div>
    </section>
  )
}

function LastTenNights({ now, year }: { now: number; year: number }) {
  const s = useStore()
  const days = s.monthDays(year, 9)
  const { lang, t } = useWords()
  if (days.length < 20) return null
  const today = s.civil(now)
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>{t('lastTenTitle')}</h3>
      <div class="glass card">
        <p class="subhead" style={{ marginTop: 0 }}>{t('lailatulQadr')}</p>
        <div class="odd-nights">
          {ODD_NIGHTS.map((n) => {
            // Night n begins at Maghrib on the day before n Ramadan.
            const eve = days[n - 2]
            if (!eve) return null
            const tonight = civilKey(eve) === civilKey(today)
            return (
              <div class={`odd-night ${tonight ? 'tonight' : ''}`}>
                <span class="mono big">{n}</span>
                <span class="caption">{tonight ? t('tonight') : fmtCivil(eve, { weekday: 'short', day: 'numeric', month: 'short' }, lang)}</span>
              </div>
            )
          })}
        </div>
        <p class="caption secondary">{t('eachNightBegins')}</p>
        <ToggleItem label={t('qiyamReminder')} sub={t('qiyamReminderSub')} on={s.prefs.qiyamAlert}
          onChange={(v) => s.update((p) => { p.qiyamAlert = v })} />
      </div>
    </section>
  )
}

export function DoaList({ ids }: { ids: DoaId[] }) {
  const s = useStore()
  const lang = lang3(s.naming)
  const t = wordsFor(lang)
  const [open, setOpen] = useState<DoaId | null>(null)
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>{t('doaAndNiat')}</h3>
      <div class="group">
        {DOA.filter((d) => ids.includes(d.id)).map((d) => (
          <div class="doa">
            <button class="item" aria-expanded={open === d.id} onClick={() => setOpen(open === d.id ? null : d.id)}>
              <HandHeart size={20} /><span class="label">{d.title[lang]}</span>
              <ChevronDown size={16} class="secondary" style={{ transform: open === d.id ? 'rotate(180deg)' : undefined }} />
            </button>
            {open === d.id && (
              <div class="doa-body">
                <p class="arabic" lang="ar" dir="rtl">{d.arabic}</p>
                <p class="rumi">{d.rumi}</p>
                <p>{d.meaning[lang]}</p>
                <p class="caption secondary">{d.note[lang]}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function ZakatCard({ year }: { year: number }) {
  const s = useStore()
  const lang = lang3(s.naming)
  const t = wordsFor(lang)
  const code = s.prefs.home?.countryCode ?? s.profile.code
  const bodies = ZAKAT[code] ?? []
  const paid = s.prefs.zakatPaid.includes(year)
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>{t('zakatFitrah')}</h3>
      <div class="group">
        <p class="item footnote" style={{ display: 'block', lineHeight: 1.4 }}>{ZAKAT_NOTE[lang]}</p>
        {bodies.map((b) => (
          <a class="item" href={b.url} target="_blank" rel="noopener noreferrer">
            <HandCoins size={20} /><span class="label">{b.name}<span class="sub">{t('zakatOfficial')}</span></span><ExternalLink size={15} class="secondary" />
          </a>
        ))}
        {!bodies.length && <p class="item footnote">{t('zakatThroughMasjid')}</p>}
        <ToggleItem label={t('zakatPaid', { y: year })} on={paid}
          onChange={(v) => s.update((p) => { p.zakatPaid = v ? [...new Set([...p.zakatPaid, year])] : p.zakatPaid.filter((y) => y !== year) })} />
      </div>
      <p class="group-foot">{t('zakatNoMoney')}</p>
    </section>
  )
}

function TravelFasting() {
  const s = useStore()
  const km = s.musafirRules.thresholdKm
  const { t } = useWords()
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>{t('travelTitle')}</h3>
      <div class="group">
        <p class="item footnote" style={{ display: 'block', lineHeight: 1.4 }}>
          {t('travelNote', { km })}
        </p>
        {s.prefs.musafirEnabled && (
          <button class="item" onClick={() => openSheet({ kind: 'journey' })}><Sunrise size={20} /><span class="label">{t('openJourney')}</span><ChevronRight size={16} class="secondary" /></button>
        )}
      </div>
    </section>
  )
}

function RamadanTools({ now }: { now: number }) {
  const s = useStore()
  const [busy, setBusy] = useState(false)
  const { t } = useWords()
  const share = async () => {
    setBusy(true)
    const c = weekCard(civilStartMs())
    if (c) await sharePicture(c, 'ramadan-times', t('shareWeekText', { p: s.activePlace?.name ?? '' }))
    setBusy(false)
  }
  /** Before Ramadan, the week shared is the first week. */
  function civilStartMs(): number {
    const first = s.monthDays(s.season(now).hijri.year, 9)[0]
    const day = first ? s.dayOfCivil(first) : null
    return day && day.times.dhuhr > now ? day.times.dhuhr : now
  }
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>{t('shareAndPrint')}</h3>
      <div class="group">
        <button class="item" disabled={busy} onClick={() => void share()}>
          <Share2 size={20} /><span class="label">{t('shareWeek')}<span class="sub">{t('shareWeekSub', { p: s.activePlace?.name ?? t('yourPlace') })}</span></span>
        </button>
        <a class="item" href="print/#sheet=ramadan">
          <Printer size={20} /><span class="label">{t('printTimetable')}</span><ChevronRight size={16} class="secondary" />
        </a>
        <a class="item" href="print/#sheet=fasting">
          <Printer size={20} /><span class="label">{t('printKidsChart')}</span><ChevronRight size={16} class="secondary" />
        </a>
      </div>
    </section>
  )
}

function RamadanSettings() {
  const s = useStore()
  const p = s.prefs
  const { t } = useWords()
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>{t('alertsTitle')}</h3>
      <div class="group">
        <ToggleItem label={t('imsakAlert')} sub={t('imsakAlertSub')} on={p.imsakAlert} onChange={(v) => s.update((x) => { x.imsakAlert = v })} />
        <ToggleItem label={t('berbukaAlert')} sub={t('berbukaAlertSub')} on={p.berbukaAlert} onChange={(v) => s.update((x) => { x.berbukaAlert = v })} />
        <ToggleItem label={t('juzADay')} sub={t('juzADaySub')} on={p.khatamPlan} onChange={(v) => s.update((x) => { x.khatamPlan = v })} />
        {p.khatamPlan && (
          <a class="item" href={juzLink(s.season(s.now()).ramadanDay ?? 1)} target="_blank" rel="noopener noreferrer">
            <BookOpen size={20} /><span class="label">{t('readTodaysJuz')}</span><ExternalLink size={15} class="secondary" />
          </a>
        )}
      </div>
      <p class="group-foot">{t('webAlertsNote')}</p>
    </section>
  )
}

// ---------- Raya and Syawal ----------

function RayaToday({ now }: { now: number }) {
  const s = useStore()
  const season = s.season(now)
  const eid = s.eidPrayer
  const day = s.day(now)
  const { t } = useWords()
  return (
    <div class="glass card raya-today" style={{ marginTop: '10px' }}>
      <div class="caps accent">{season.phase === 'raya' ? t('firstSyawal') : t('syawalDay', { n: season.syawalDay ?? '' })}</div>
      <h3 class="display" style={{ margin: '4px 0' }}>{season.phase === 'raya' ? t('selamatHariRaya') : t('syawal')}</h3>
      {season.phase === 'raya' && (
        <>
          {eid ? <p class="subhead">{t('rayaPrayerAtPlace', { p: s.prefs.myMasjid?.name ?? t('yourMasjid') })} <b class="mono">{eid}</b></p>
            : <p class="subhead">{day ? t('masjidSetsRayaTimeAfterSyuruk', { s: s.formatted(day.times.sunrise) }) : t('masjidSetsRayaTime')}</p>}
          <p class="caption secondary">{t('rayaSunnah')}</p>
        </>
      )}
    </div>
  )
}

function SyawalFasts({ now, year }: { now: number; year: number }) {
  const s = useStore()
  const days = s.monthDays(year, 10)
  const todayKey = civilKey(s.civil(now))
  const sum = s.fastSummary(year)
  const order: (FastMark | null)[] = [null, 'syawal', 'qadha']
  const tomorrow = s.civilAfter(now, 1)
  const { lang, t } = useWords()
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>{t('syawalFastsTitle')}</h3>
      <div class="glass card">
        <div class="syawal-count">
          <div><span class="mono big">{Math.min(6, sum.syawal)}</span><span class="caption secondary"> {t('ofSixSyawal')}</span></div>
          <div><span class="mono big">{sum.owed}</span><span class="caption secondary"> {t('ramadanFastsToReplace', { n: sum.owed })}</span></div>
        </div>
        <div class="fast-grid" role="grid">
          {days.map((d, i) => {
            const k = civilKey(d)
            const m = s.fastMark(k)
            const raya = i === 0
            return (
              <button class={`fast-day ${m === 'syawal' ? 'fasted' : m === 'qadha' ? 'qadha' : ''} ${k === todayKey ? 'is-today' : ''}`} disabled={raya || k > todayKey}
                aria-label={t('syawalDayAria', { n: i + 1, s: raya ? t('rayaNoFasting') : m ? fastMarkLabel(lang, m) : t('notMarked') })}
                onClick={() => s.setFast(k, order[(order.indexOf(m === 'syawal' || m === 'qadha' ? m : null) + 1) % order.length])}>
                <span class="mono">{i + 1}</span>{m === 'qadha' && <span class="fast-reason" aria-hidden="true">{fastMarkLetter(lang, 'qadha')}</span>}
              </button>
            )
          })}
        </div>
        <p class="caption secondary">{t('syawalHelp', { d: fmtCivil(tomorrow, { weekday: 'long', day: 'numeric', month: 'short' }, lang) })}</p>
        {sum.owed > 0 && s.season(now).phase !== 'raya' && (
          <button class="pill-btn" onClick={() => s.setFast(todayKey, s.fastMark(todayKey) === 'qadha' ? null : 'qadha')}>
            <Check size={16} />{s.fastMark(todayKey) === 'qadha' ? t('replacedToday') : t('iReplacedToday')}
          </button>
        )}
      </div>
      <p class="group-foot">{t('replaceRule')}</p>
    </section>
  )
}

function RayaShare() {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const { t } = useWords()
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>{t('sendRayaCard')}</h3>
      <div class="group">
        <label class="item"><span class="label">{t('from')}</span><input class="inline-input" value={name} placeholder={t('yourNameOrFamily')} onInput={(e) => setName((e.target as HTMLInputElement).value)} /></label>
        <button class="item" disabled={busy} onClick={async () => { setBusy(true); await sharePicture(rayaCard(name), 'selamat-hari-raya', t('rayaShareText')); setBusy(false) }}>
          <Share2 size={20} /><span class="label">{t('shareTheCard')}</span>
        </button>
      </div>
    </section>
  )
}

/** Days from today until the next 1 Ramadan, for Settings. */
export function daysToRamadan(now: number): number | null {
  const h = store.hijriOf(now)
  const year = h.month > 9 ? h.year + 1 : h.year
  const first = store.monthDays(year, 9)[0]
  return first ? daysApart(store.civil(now), first) : null
}

export { addDays }
