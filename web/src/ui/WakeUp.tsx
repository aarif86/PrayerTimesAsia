import { AlarmClock, AlarmClockCheck, Bell, BellOff, BellRing, Check, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Download, Play, Smartphone } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import { alertMode, allFiveNotify, notifyAllFive, fridayMode, modesFor, notifies, setAlertMode, setFridayMode, setNotify, type AlertMode } from '../core/alertMode'
import type { PrayerDay } from '../core/engine'
import { inSingapore } from '../core/friday'
import { JUMUAH_LEAVE_CHOICES, leaveChoiceLabel, SECOND_SESSION_FROM, type JumuahSession } from '../core/jumuahLeave'
import { PRAYERS, prayerName, type Prayer } from '../core/prayer'
import { noonDaysAfter } from '../core/tz'
import {
  ALARM_KEY, ALARM_PRAYERS, ALARM_SOUNDS, alarmSoundLabel, prayerAlarmChoices, prayerAlarmLabel, prayerAlarmTime,
  sahurDayLabel, SAHUR_DAYS, SAHUR_TIMINGS, sahurLabel, sahurTime, WAKE_UP_TIMINGS, wakeUpLabel, wakeUpTime,
  type AlarmPrayer, type AlarmSound, type PrayerAlarmTiming, type SahurTiming, type WakeUpTiming,
} from '../core/wakeup'
import { previewAlarm, stopAlarm } from '../services/alarmSound'
import { azanAvailable } from '../services/azan'
import { alertSupport, anyAlarm, downloadWakeICS, nextJumuahLeave, nextWakeUp, permission, requestPermission, testAlert } from '../services/notifications'
import { REMINDER_CHOICES, type Preferences } from '../services/prefs'
import { AWAY_CHOICES, AWAY_PRAYERS, isAway } from '../core/away'
import { HomeQuestion } from './Sheets'
import { store, useNow, useStore } from '../services/store'
import { openSheet, Sheet, ToggleItem } from './common'
import { appLocale, tr, type AppWordKey } from '../core/appWords'
import { Hadith } from './Hadith'
import { phoneAppOffer } from './pwa'

/** The alarm clock on the Prayer screen: shows the next alarm's time when one is set. */
export function WakeChip({ now, open }: { now: number; open: () => void }) {
  const next = nextWakeUp(now)
  if (!next) {
    return (
      <button class="round-btn" onClick={open} aria-label={tr('alerts.title')}>
        <AlarmClock size={18} />
      </button>
    )
  }
  return (
    <button class="streak-chip wake-chip" onClick={open} aria-label={tr('alerts.chipNext', { time: store.formatted(next.at) })}>
      <AlarmClockCheck size={16} />
      <span class="mono">{store.formatted(next.at).replace(/ ?[AP]M$/i, '')}</span>
    </button>
  )
}

/** The bell beside a prayer on the Prayer screen: shows Off, Notify or Alarm. */
export function ModeIcon({ mode, size = 16 }: { mode: AlertMode; size?: number }) {
  if (mode === 'alarm') return <AlarmClock size={size} />
  if (mode === 'notify') return <Bell size={size} fill="currentColor" />
  return <BellOff size={size} style={{ opacity: 0.4 }} />
}

const MODE_KEY: Record<AlertMode, AppWordKey> = { off: 'alerts.modeOff', notify: 'alerts.modeNotify', alarm: 'alerts.modeAlarm' }
/** Off, Notify or Alarm, in the app's language. */
export const modeWord = (m: AlertMode): string => tr(MODE_KEY[m])

/** Ask the browser once, the first time anything is turned on. */
async function ask(): Promise<void> {
  if (alertSupport() !== 'supported') return
  if (!(await requestPermission())) openSheet({ kind: 'alerts-help' })
}

/** One prayer to its next choice, from the bell. Says what changed, for screen readers too. */
export function cycleAlert(prayer: Prayer): string {
  const modes = modesFor(prayer)
  const next = modes[(modes.indexOf(alertMode(store.prefs, prayer)) + 1) % modes.length]
  store.update((x) => setAlertMode(x, prayer, next))
  if (next === 'off') stopAlarm()
  else void ask()
  const name = store.name(prayer)
  return tr(next === 'off' ? 'alerts.nowOff' : next === 'notify' ? 'alerts.nowNotify' : 'alerts.nowAlarm', { name })
}

/** When this choice would next ring: today if it is still ahead, else tomorrow. */
function soon(now: number, at: (d: PrayerDay) => number): string | null {
  const t = soonAt(now, at)
  return t === null ? null : store.formatted(t)
}

/** The same, as a time. */
function soonAt(now: number, at: (d: PrayerDay) => number): number | null {
  for (let offset = 0; offset < 2; offset++) {
    const day = store.day(noonDaysAfter(now, offset, store.timeZone))
    if (!day) continue
    const t = at(day)
    if (t > now) return t
  }
  return null
}

/** "A notification at Maghrib. About 7:18 PM here." when the app knows the time. */
function withAbout(text: string, time: string | null): string {
  return time ? `${text} ${tr('alerts.aboutHere', { time })}` : text
}

/** When a prayer's alert next comes: the alarm's own time, or the prayer's start for Notify. */
function alertNext(now: number, prayer: Prayer): number | null {
  const p = store.prefs
  const mode = alertMode(p, prayer)
  if (mode === 'off') return null
  if (mode === 'notify') return soonAt(now, (d) => d.times[prayer])
  if (prayer === 'fajr') return p.wakeUp ? soonAt(now, (d) => wakeUpTime(p.wakeUp!, d)) : null
  const t = p[ALARM_KEY[prayer as AlarmPrayer]]
  if (!t) return null
  return soonAt(now, (d) => {
    const end = { dhuhr: d.times.asr, asr: d.times.maghrib, maghrib: d.times.isha, isha: d.times.isha }[prayer as AlarmPrayer]
    return prayerAlarmTime(t, d.times[prayer as AlarmPrayer], end)
  })
}

/** The bar under a prayer that is on: "Alarm 6:20 AM" in bold, then what it is. */
function chipWords(now: number, prayer: Prayer): [string, string] {
  const p = store.prefs
  const mode = alertMode(p, prayer)
  const at = alertNext(now, prayer)
  const time = at === null ? '' : store.formatted(at)
  if (mode === 'off') return [modeWord('off'), '']
  if (mode === 'notify') {
    const lead = time ? tr('alerts.chipNotify', { time }) : modeWord('notify')
    if (prayer === 'sunrise') return [lead, tr('alerts.whenEnds', { name: store.name('fajr') })]
    const parts: string[] = []
    if (azanAvailable() && p.azanSound) parts.push(tr('alerts.withAzan'))
    if (p.reminderMinutesBefore > 0) parts.push(tr('alerts.earlyN', { n: p.reminderMinutesBefore }))
    return [lead, parts.length ? parts.join(', ') : tr('alerts.whenBegins')]
  }
  const timing = prayer === 'fajr' ? wakeUpLabel(p.wakeUp!, store.naming) : prayerAlarmLabel(p[ALARM_KEY[prayer as AlarmPrayer]]!)
  const atStart = prayer === 'fajr' ? p.wakeUp === 'atFajr' : p[ALARM_KEY[prayer as AlarmPrayer]] === 'atStart'
  let rest = timing.charAt(0).toLocaleLowerCase(appLocale()) + timing.slice(1)
  if (notifies(p, prayer) && !atStart) rest += `, ${tr('alerts.notifAtTime')}`
  return [time ? tr('alerts.chipAlarm', { time }) : modeWord('alarm'), rest]
}

/** One prayer in the list: its name and Off, Notify, Alarm, then a bar with the time and Change when it is on. */
function ModeBlock({ name, mode, modes, words, open, pick }: { name: string; mode: AlertMode; modes: AlertMode[]; words: [string, string]; open: () => void; pick: (m: AlertMode) => void }) {
  return (
    <div class="item mode-block">
      <div class="mode-row">
        <span class="label mode-row-name">{name}{mode === 'off' && <span class="sub">{modeWord('off')}</span>}</span>
        <ModeSwitch name={name} modes={modes} value={mode} pick={pick} />
      </div>
      {mode !== 'off' && (
        <button class={`mode-chip mode-chip-${mode}`} onClick={open} aria-label={tr('alerts.changeAria', { name, summary: words.filter(Boolean).join(', ') })}>
          <ModeIcon mode={mode} size={15} />
          <span class="mode-chip-text"><b>{words[0]}</b>{words[1] && `, ${words[1]}`}</span>
          <span class="mode-chip-go">{tr('alerts.change')}<ChevronRight size={14} /></span>
        </button>
      )}
    </div>
  )
}

function whenText(now: number, at: number): string {
  const tz = store.timeZone
  const key = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: tz })
  if (key(at) === key(now)) return tr('alerts.today')
  if (key(at) === key(noonDaysAfter(now, 1, tz))) return tr('alerts.tomorrow')
  return new Date(at).toLocaleDateString(appLocale(), { weekday: 'long', timeZone: tz })
}


/** Off, Notify, Alarm in a row. */
function ModeSwitch({ name, modes, value, pick }: { name: string; modes: AlertMode[]; value: AlertMode; pick: (m: AlertMode) => void }) {
  return (
    <div class="segmented mode-switch" role="group" aria-label={name}>
      {modes.map((m) => (
        <button type="button" aria-pressed={value === m} class={`mode-${m}`} onClick={(e) => { e.stopPropagation(); pick(m) }}>{modeWord(m)}</button>
      ))}
    </div>
  )
}

function Choice({ label, detail, on, pick }: { label: string; detail?: string | null; on: boolean; pick: () => void }) {
  return (
    <button class="item choice" onClick={pick} aria-pressed={on}>
      <span class="label">{label}</span>
      {detail && <span class="value mono">{detail}</span>}
      <Check size={18} class="choice-tick" style={{ opacity: on ? 1 : 0 }} />
    </button>
  )
}

/** What a choice means, written on the big cards of a prayer's page. */
const MODE_HELP: Record<AlertMode, AppWordKey> = { off: 'alerts.helpOff', notify: 'alerts.helpNotify', alarm: 'alerts.helpAlarm' }

function ModeCards({ modes, value, pick, alarmHelp = tr(MODE_HELP.alarm) }: { modes: AlertMode[]; value: AlertMode; pick: (m: AlertMode) => void; alarmHelp?: string }) {
  return (
    <div class="mode-cards">
      {modes.map((m) => (
        <button type="button" class={`mode-card ${value === m ? 'on' : ''}`} aria-pressed={value === m} onClick={() => pick(m)}>
          <span class="mode-card-head"><ModeIcon mode={m} size={18} /><b>{modeWord(m)}</b>{value === m && <Check size={18} class="mode-card-tick" />}</span>
          <span class="sub">{m === 'alarm' ? alarmHelp : tr(MODE_HELP[m])}</span>
        </button>
      ))}
    </div>
  )
}

type View = { kind: 'main' } | { kind: 'prayer'; prayer: Prayer } | { kind: 'friday' } | { kind: 'check' } | { kind: 'early' }

/**
 * Alerts and alarms: one screen for every sound the app makes. Each prayer is
 * Off, Notify or Alarm, then the extras, then how it all sounds.
 * Opened from Settings, the alarm clock on the Prayer screen, and by holding a bell.
 */
export function WakeUpSheet({ start, view: startView }: { start?: Prayer | 'friday'; view?: 'check' }) {
  const [view, setView] = useState<View>(
    startView === 'check' ? { kind: 'check' } : start === 'friday' ? { kind: 'friday' } : start ? { kind: 'prayer', prayer: start } : { kind: 'main' })
  const back = () => setView({ kind: 'main' })
  if (view.kind === 'prayer') return <PrayerPage prayer={view.prayer} back={back} />
  if (view.kind === 'friday') return <FridayPage back={back} />
  if (view.kind === 'check') return <CheckPage back={back} />
  if (view.kind === 'early') return <EarlyPage back={back} />
  return <MainPage open={setView} />
}

function BackBar({ back }: { back: () => void }) {
  return (
    <button class="item sheet-back" onClick={back}>
      <ChevronLeft size={18} /><span class="label">{tr('alerts.title')}</span>
    </button>
  )
}

/** Things on this device that keep a sound from reaching you. */
function problems(): string[] {
  const out: string[] = []
  const support = alertSupport()
  if (support === 'needs-install') out.push(tr('alerts.needsInstall'))
  else if (support === 'unsupported') out.push(tr('alertsHelp.cant'))
  else if (permission() === 'denied') out.push(tr('alertsHelp.blocked'))
  return out
}

function MainPage({ open }: { open: (v: View) => void }) {
  const s = useStore()
  const now = useNow(30_000)
  const p = s.prefs
  const next = nextWakeUp(now)
  const app = phoneAppOffer()
  const friday = prayerName('dhuhr', s.naming, true)
  const issues = problems()
  
  const setSahur = (t: SahurTiming | null) => { store.update((x) => { x.sahurAlarm = t }); if (t) void ask(); else stopAlarm() }
  const [justSet, setJustSet] = useState<Prayer | null>(null)
  useEffect(() => {
    if (!justSet) return
    const t = setTimeout(() => setJustSet(null), 6000)
    return () => clearTimeout(t)
  }, [justSet])
  const pick = (prayer: Prayer, m: AlertMode) => {
    const was = alertMode(store.prefs, prayer)
    store.update((x) => setAlertMode(x, prayer, m))
    if (m === 'off') stopAlarm(); else void ask()
    setJustSet(m === 'alarm' && was !== 'alarm' ? prayer : null)
  }
  const justAt = justSet ? alertNext(now, justSet) : null
  const pickFriday = (m: AlertMode) => { store.update((x) => setFridayMode(x, m)); if (m === 'off') stopAlarm(); else void ask() }
  const turnOffAll = () => {
    store.update((x) => {
      x.wakeUp = null
      x.sahurAlarm = null
      for (const prayer of ALARM_PRAYERS) x[ALARM_KEY[prayer]] = null
      x.jumuahLeaveAlarm = false
    })
    stopAlarm()
  }
  const setSound = (sound: AlarmSound) => { store.update((x) => { x.alarmSound = sound }); previewAlarm(sound) }
  const ramadanSwitch = (label: string, sub: string, key: 'imsakAlert' | 'berbukaAlert' | 'qiyamAlert') => (
    <ToggleItem label={label} sub={sub} on={p[key]} onChange={(v) => { store.update((x) => { x[key] = v }); if (v) void ask() }} />
  )

  return (
    <Sheet title={tr('alerts.title')} full>
      {justSet && justAt !== null && (
        <div class="alarm-set-toast" role="status">
          <AlarmClock size={18} />
          <span>{tr('alerts.alarmSet', { name: s.name(justSet), time: s.formatted(justAt) })}</span>
          <button onClick={() => { const pr = justSet; setJustSet(null); open({ kind: 'prayer', prayer: pr }) }}>{tr('alerts.changeTime')}</button>
        </div>
      )}
      <button class={`glass card check-card ${issues.length ? 'warn' : ''}`} onClick={() => open({ kind: 'check' })}>
        <span class="check-card-head">
          {issues.length ? <CircleAlert size={18} /> : <CircleCheck size={18} />}
          <b>{issues.length ? issues[0] : tr('alerts.webOpen')}</b>
        </span>
        <span class="sub">{issues.length ? tr('alerts.tapFix') : tr('alerts.usePhoneApp')}</span>
        <span class="check-card-btn">{tr('alerts.checkPhone')}</span>
      </button>

      <section>
        <h2 class="group-title">{tr('alerts.eachPrayer')}</h2>
        <div class="group">
          <button class="item all-five-btn" disabled={allFiveNotify(p)}
            onClick={() => { store.update((x) => notifyAllFive(x)); void ask() }}>
            {allFiveNotify(p) ? <CircleCheck size={20} /> : <BellRing size={20} />}
            <span class="label">{allFiveNotify(p) ? tr('alerts.allFiveOn') : tr('alerts.allFive')}<span class="sub">{tr('alerts.allFiveSub')}</span></span>
          </button>
          {PRAYERS.map((prayer) => (
            <ModeBlock name={s.name(prayer)} mode={alertMode(p, prayer)} modes={modesFor(prayer)} words={chipWords(now, prayer)}
              open={() => open({ kind: 'prayer', prayer })} pick={(m) => pick(prayer, m)} />
          ))}
          <ModeBlock name={tr('alerts.fridayLeave', { friday })} mode={fridayMode(p)} modes={['off', 'notify', 'alarm']}
            words={[modeWord(fridayMode(p)), tr('alerts.fridayStarts', { when: leaveChoiceLabel(p.jumuahReminderMinutes).toLocaleLowerCase(appLocale()) })]}
            open={() => open({ kind: 'friday' })} pick={pickFriday} />
          <button class="item" onClick={() => open({ kind: 'early' })}>
            <span class="label">{tr('early.row')}<span class="sub">{earlySummary(p)}</span></span>
            <ChevronRight size={18} />
          </button>
        </div>
        <p class="group-foot">{tr('alerts.eachFoot')}</p>
      </section>

      <section>
        <div class="group">
          <p class="item">
            <span class="label">{next ? (next.sahur ? tr('alerts.nextAlarmSahur', { when: whenText(now, next.at), time: s.formatted(next.at) })
              : next.prayer ? tr('alerts.nextAlarmFor', { when: whenText(now, next.at), time: s.formatted(next.at), name: s.name(next.prayer, next.at) })
              : tr('alerts.nextAlarm', { when: whenText(now, next.at), time: s.formatted(next.at) })) : <span class="secondary">{tr('wake.noneOn')}</span>}</span>
          </p>
          {anyAlarm(p) && (
            <button class="item" onClick={turnOffAll}><span class="label">{tr('wake.allOff')}</span></button>
          )}
        </div>
      </section>

      <section>
        <h2 class="group-title" id="demo-extras">{tr('alerts.fasting')}</h2>
        <div class="group">
          <ToggleItem label={tr('wake.sahur')} sub={tr('wake.sahurSub', { name: s.name('fajr') })} on={!!p.sahurAlarm} onChange={(v) => setSahur(v ? SAHUR_TIMINGS[0] : null)} />
          {p.sahurAlarm && SAHUR_TIMINGS.map((t) => (
            <Choice label={sahurLabel(t, s.naming)} detail={soon(now, (d) => sahurTime(t, d))} on={p.sahurAlarm === t} pick={() => setSahur(t)} />
          ))}
        </div>
      </section>
      {p.sahurAlarm && (
        <section>
          <h2 class="group-title">{tr('wake.sahurOn')}</h2>
          <div class="group">
            {SAHUR_DAYS.map((d) => {
              const everyDay = p.sahurDays.includes('everyDay') && d !== 'everyDay'
              return (
                <ToggleItem label={sahurDayLabel(d)} on={p.sahurDays.includes(d) || everyDay}
                  onChange={(v) => {
                    if (everyDay) return
                    store.update((x) => {
                      const days = v ? [...x.sahurDays, d] : x.sahurDays.filter((y) => y !== d)
                      x.sahurDays = days.length ? SAHUR_DAYS.filter((y) => days.includes(y)) : ['everyDay']
                    })
                  }} />
              )
            })}
          </div>
          <p class="group-foot">{tr('wake.hijriNote')}</p>
        </section>
      )}
      <section>
        <h2 class="group-title">{tr('alerts.ramadanOnly')}</h2>
        <div class="group">
          {ramadanSwitch(tr('settings.imsakAlert'), withAbout(tr('settings.imsakAlertSub'), soon(now, (d) => store.imsak(d) - 10 * 60_000)), 'imsakAlert')}
          {ramadanSwitch(tr('settings.berbukaAlert'), withAbout(tr('settings.berbukaAlertSub', { name: s.name('maghrib') }), soon(now, (d) => d.times.maghrib)), 'berbukaAlert')}
          {ramadanSwitch(tr('settings.qiyam'), withAbout(tr('settings.qiyamSub'), soon(now, (d) => store.blessed(d).find(([b]) => b === 'lastThird')?.[1] ?? 0)), 'qiyamAlert')}
        </div>
        <p class="group-foot">{tr('alerts.ramadanFoot')}</p>
      </section>
      {p.trackerEnabled && (
        <section>
          <div class="group">
            <ToggleItem label={tr('settings.nudge')} on={p.windowNudge} onChange={(v) => store.update((x) => { x.windowNudge = v })}
              sub={tr('alerts.nudgeSub', { name: s.name('isha') })} />
          </div>
        </section>
      )}

      <section>
        <h2 class="group-title" id="demo-sound">{tr('alerts.sound')}</h2>
        <div class="group">
          {azanAvailable() && <ToggleItem label={tr('settings.azan')} sub={tr('alerts.azanSub', { name: s.name('fajr') })} on={p.azanSound} onChange={(v) => store.update((x) => { x.azanSound = v })} />}
          <ToggleItem label={tr('settings.buzzOnly')} sub={tr('alerts.buzzSub')} on={p.buzzOnly} onChange={(v) => store.update((x) => { x.buzzOnly = v })} />
          <ToggleItem label={tr('settings.quietHours')} sub={tr('alerts.quietSub', { name: s.name('fajr') })} on={p.quietHours} onChange={(v) => store.update((x) => { x.quietHours = v })} />
          {p.quietHours && (
            <>
              <label class="item"><span class="label">{tr('settings.from')}</span>
                <select class="inline-select" value={String(p.quietFrom)} onChange={(e) => { const v = parseInt((e.target as HTMLSelectElement).value, 10); store.update((x) => { x.quietFrom = v }) }}>
                  {HALF_HOURS.map((m) => <option value={String(m)}>{s.clock(m)}</option>)}
                </select>
              </label>
              <label class="item"><span class="label">{tr('settings.until')}</span>
                <select class="inline-select" value={String(p.quietTo)} onChange={(e) => { const v = parseInt((e.target as HTMLSelectElement).value, 10); store.update((x) => { x.quietTo = v }) }}>
                  {HALF_HOURS.map((m) => <option value={String(m)}>{s.clock(m)}</option>)}
                </select>
              </label>
            </>
          )}
        </div>
        <p class="group-foot">{tr('alerts.soundFoot')}</p>
      </section>

      <section>
        <h2 class="group-title">{tr('wake.sound')}</h2>
        <div class="group">
          {ALARM_SOUNDS.filter((x) => x !== 'phone').map((sound) => {
            const on = (p.alarmSound === 'phone' ? 'classic' : p.alarmSound) === sound
            return (
              <button class="item choice" onClick={() => setSound(sound)} aria-pressed={on} aria-label={tr('wake.soundTap', { name: alarmSoundLabel(sound) })}>
                <Play size={14} class="secondary" />
                <span class="label">{alarmSoundLabel(sound)}</span>
                <Check size={18} class="choice-tick" style={{ opacity: on ? 1 : 0 }} />
              </button>
            )
          })}
        </div>
        <p class="group-foot">{tr('alerts.alarmSoundFoot')}</p>
      </section>

      <section>
        <div class="group">
          <button class="item" onClick={testAlert}><BellRing size={20} /><span class="label">{tr('settings.testAlert')}</span></button>
          {anyAlarm(p) && (
            <button class="item" onClick={downloadWakeICS}>
              <Download size={20} /><span class="label">{tr('alerts.add30')}<span class="sub">{tr('wake.calendarRings')}</span></span>
            </button>
          )}
          {app && (
            <a class="item" href={app.href} target="_blank" rel="noopener">
              <Smartphone size={20} /><span class="label">{app.title}<span class="sub">{tr('wake.silent')}</span></span>
            </a>
          )}
        </div>
      </section>

      <div class="glass card wake-hadith">
        <p class="arabic" dir="rtl" lang="ar">اللَّهُمَّ بَارِكْ لِأُمَّتِي فِي بُكُورِهَا</p>
        <p class="quote">“{tr('alerts.morningsHadith')}”</p>
        <p class="caption secondary">{tr('alerts.morningsSource')}</p>
      </div>
      {p.sahurAlarm && (
        <div class="hadith-after-group">
          <Hadith id="monThu" variant="line" />
          <Hadith id="whiteDays" variant="line" />
        </div>
      )}
    </Sheet>
  )
}

/** Every half hour of the day, in minutes past midnight. */
const HALF_HOURS = Array.from({ length: 48 }, (_, i) => i * 30)

function PrayerPage({ prayer, back }: { prayer: Prayer; back: () => void }) {
  const s = useStore()
  const now = useNow(30_000)
  const p = s.prefs
  const name = s.name(prayer)
  const mode = alertMode(p, prayer)
  const pick = (m: AlertMode) => { store.update((x) => setAlertMode(x, prayer, m)); if (m === 'off') stopAlarm(); else void ask() }
  const setWake = (t: WakeUpTiming) => store.update((x) => { x.wakeUp = t })
  const setPrayerAlarm = (pr: AlarmPrayer, t: PrayerAlarmTiming) => store.update((x) => { x[ALARM_KEY[pr]] = t })
  const atStart = prayer === 'fajr' ? p.wakeUp === 'atFajr' : prayer !== 'sunrise' && p[ALARM_KEY[prayer as AlarmPrayer]] === 'atStart'
  const nextAt = alertNext(now, prayer)
  const bigLine = nextAt === null ? '' : tr(mode === 'alarm' ? 'alerts.bigAlarm' : 'alerts.bigNotify', { name, when: whenText(now, nextAt) })

  return (
    <Sheet title={name} full>
      <BackBar back={back} />
      {mode !== 'off' && nextAt !== null && (
        <div class="glass card alert-big">
          <ModeIcon mode={mode} size={28} />
          <span><b class="mono">{s.formatted(nextAt)}</b>
            <span class="sub">{bigLine}</span></span>
        </div>
      )}
      <h2 class="group-title">{tr('alerts.howReach', { name })}</h2>
      <ModeCards modes={modesFor(prayer)} value={mode} pick={pick}
        alarmHelp={prayer === 'fajr' ? tr('alerts.helpAlarmFajr', { name }) : undefined} />

      {mode === 'alarm' && prayer === 'fajr' && (
        <section>
          <h2 class="group-title">{tr('alerts.whenAlarm')}</h2>
          <div class="group">
            {WAKE_UP_TIMINGS.map((t) => (
              <Choice label={wakeUpLabel(t, s.naming)} detail={soon(now, (d) => wakeUpTime(t, d))} on={p.wakeUp === t} pick={() => setWake(t)} />
            ))}
          </div>
          <p class="group-foot">{tr('alerts.movesWith', { name })}</p>
        </section>
      )}
      {mode === 'alarm' && prayer !== 'fajr' && prayer !== 'sunrise' && (
        <section>
          <h2 class="group-title">{tr('alerts.whenAlarm')}</h2>
          <div class="group">
            {prayerAlarmChoices(prayer as AlarmPrayer).map((t) => (
              <Choice label={prayerAlarmLabel(t)} on={p[ALARM_KEY[prayer as AlarmPrayer]] === t} pick={() => setPrayerAlarm(prayer as AlarmPrayer, t)}
                detail={soon(now, (d) => {
                  const end = { dhuhr: d.times.asr, asr: d.times.maghrib, maghrib: d.times.isha, isha: d.times.isha }[prayer as AlarmPrayer]
                  return prayerAlarmTime(t, d.times[prayer as AlarmPrayer], end)
                })} />
            ))}
          </div>
        </section>
      )}
      {mode === 'alarm' && !atStart && (
        <section>
          <div class="group">
            <ToggleItem label={tr('alerts.notifyToo')} sub={tr('alerts.notifyTooSub', { name })} on={notifies(p, prayer)}
              onChange={(v) => store.update((x) => setNotify(x, prayer, v))} />
          </div>
        </section>
      )}
      {mode === 'notify' && prayer !== 'sunrise' && (
        <section>
          <div class="group">
            <label class="item">
              <span class="label">{tr('alerts.headsUp')}<span class="sub">{tr('alerts.headsUpSame')}</span></span>
              <select class="inline-select" value={String(p.reminderMinutesBefore)} aria-label={tr('alerts.headsUp')}
                onChange={(e) => { const v = parseInt((e.target as HTMLSelectElement).value, 10); store.update((x) => { x.reminderMinutesBefore = v }) }}>
                <option value="0">{tr('common.off')}</option>
                {REMINDER_CHOICES.map((m) => <option value={String(m)}>{tr('common.minBefore', { n: m })}</option>)}
              </select>
            </label>
          </div>
        </section>
      )}
      {prayer === 'fajr' && p.wakeUp === 'fajrMinus30' && <div class="hadith-after-group"><Hadith id="nightPrayer" variant="line" /></div>}
    </Sheet>
  )
}

function FridayPage({ back }: { back: () => void }) {
  const s = useStore()
  const now = useNow(60_000)
  const p = s.prefs
  const place = s.activePlace
  const friday = prayerName('dhuhr', s.naming, true)
  const sg = !!place && inSingapore(place.coordinates, place.countryCode)
  const mode = fridayMode(p)
  const next = nextJumuahLeave(now)
  const [h, m] = SECOND_SESSION_FROM.split(':').map((x) => parseInt(x, 10))
  const twoPM = s.clock(h * 60 + m)
  const pick = (md: AlertMode) => { store.update((x) => setFridayMode(x, md)); if (md === 'off') stopAlarm(); else void ask() }
  const nextText = next ? tr(s.dayKey(next.leave) === s.dayKey(now) ? 'jumuah.nextToday' : 'jumuah.nextFriday', { leave: s.formatted(next.leave), friday, start: s.formatted(next.start) }) : null
  const firstFrom = sg && p.jumuahSession === 'second' ? twoPM : s.myMasjidHere?.jumuah ? tr('jumuah.ownTime', { friday }) : tr('jumuah.startOf', { dhuhr: s.name('dhuhr') })

  return (
    <Sheet title={tr('jumuah.leaveFor', { friday })} full>
      <BackBar back={back} />
      <h2 class="group-title">{tr('alerts.howReminder')}</h2>
      <ModeCards modes={['off', 'notify', 'alarm']} value={mode} pick={pick} />
      {mode !== 'off' && (
        <section>
          <div class="group">
            <label class="item">
              <span class="label">{tr('alerts.when')}{nextText && <span class="sub mono">{nextText}</span>}</span>
              <select class="inline-select" value={String(p.jumuahReminderMinutes)} aria-label={tr('alerts.whenLeave', { friday })}
                onChange={(e) => { const v = parseInt((e.target as HTMLSelectElement).value, 10); store.update((x) => { x.jumuahReminderMinutes = v }) }}>
                {JUMUAH_LEAVE_CHOICES.filter((v) => v > 0).map((v) => <option value={String(v)}>{leaveChoiceLabel(v)}</option>)}
              </select>
            </label>
            {sg && (
              <label class="item">
                <span class="label">{tr('jumuah.session')}<span class="sub">{tr('jumuah.sessionSub', { dhuhr: s.name('dhuhr'), time: twoPM })}</span></span>
                <select class="inline-select" value={p.jumuahSession} aria-label={tr('jumuah.sessionAria', { friday })}
                  onChange={(e) => { const v = (e.target as HTMLSelectElement).value as JumuahSession; store.update((x) => { x.jumuahSession = v }) }}>
                  <option value="first">{tr('jumuah.first')}</option>
                  <option value="second">{tr('jumuah.second')}</option>
                </select>
              </label>
            )}
          </div>
        </section>
      )}
      <p class="group-foot">
        {tr('jumuah.foot', { from: firstFrom })}
        {sg && ` ${tr('jumuah.footSg')}`}
        {` ${tr('jumuah.footWho', { friday, dhuhr: s.name('dhuhr') })}`}
      </p>
    </Sheet>
  )
}

/** Check my phone, on the web: what the browser allows, and what only the phone app can do. */
function CheckPage({ back }: { back: () => void }) {
  const s = useStore()
  const [, refresh] = useState(0)
  const support = alertSupport()
  const perm = permission()
  const app = phoneAppOffer()
  const notifyFriday = fridayMode(s.prefs) === 'notify'
  const Row = ({ ok, title, sub, children }: { ok: boolean; title: string; sub?: string; children?: preact.ComponentChildren }) => (
    <div class="item check-row">
      <span class={`check-dot ${ok ? 'ok' : 'warn'}`} aria-hidden="true">{ok ? <Check size={13} /> : '!'}</span>
      <span class="label">{title}{sub && <span class="sub">{sub}</span>}{children}</span>
    </div>
  )
  return (
    <Sheet title={tr('alerts.checkTitle')} full>
      <BackBar back={back} />
      <section>
        <div class="group">
          {support === 'supported' && perm === 'granted' && <Row ok title={tr('alerts.allowed')} />}
          {support === 'supported' && perm !== 'granted' && (
            <Row ok={false} title={perm === 'denied' ? tr('alerts.blockedShort') : tr('alerts.notAllowedYet')}
              sub={perm === 'denied' ? tr('alerts.allowHow') : undefined}>
              {perm !== 'denied' && <button class="pill-btn check-fix" onClick={() => void requestPermission().then(() => refresh((x) => x + 1))}>{tr('alerts.allowButton')}</button>}
            </Row>
          )}
          {support === 'needs-install' && (
            <Row ok={false} title={tr('alerts.addHome')} sub={tr('alerts.addHomeSub')}>
              <button class="pill-btn check-fix" onClick={() => openSheet({ kind: 'install' })}>{tr('alerts.showMe')}</button>
            </Row>
          )}
          {support === 'unsupported' && <Row ok={false} title={tr('alertsHelp.cant')} />}
          <Row ok={false} title={tr('alerts.stayOpen')} sub={tr('alerts.stayOpenSub')} />
          <Row ok={false} title={tr('alerts.silent')} sub={tr('alerts.silentSub')} />
          {notifyFriday && (
            <Row ok={false} title={tr('alerts.fridayIsNotify', { friday: prayerName('dhuhr', s.naming, true) })} sub={tr('alerts.makeAlarmSub')}>
              <button class="pill-btn check-fix" onClick={() => store.update((x) => setFridayMode(x, 'alarm'))}>{tr('alerts.makeAlarm')}</button>
            </Row>
          )}
        </div>
      </section>
      {app && (
        <section>
          <div class="group">
            <a class="item" href={app.href} target="_blank" rel="noopener">
              <Smartphone size={20} /><span class="label">{app.title}<span class="sub">{tr('alerts.appSub')}</span></span><ChevronRight size={16} class="secondary" />
            </a>
          </div>
        </section>
      )}
    </Sheet>
  )
}

function awayWord(n: number): string {
  return n === 60 ? tr('early.hour') : tr('early.min', { n })
}

/** One line under "Remind me earlier" on the main page. */
function earlySummary(p: Preferences): string {
  const parts: string[] = []
  const mins = AWAY_PRAYERS.map((x) => p.awayMinutes[x] ?? 0).filter((m) => m > 0)
  if (p.awayReminder && mins.length) parts.push(tr('early.rowAway', { when: awayWord(Math.max(...mins)) }))
  if (p.reminderMinutesBefore > 0) parts.push(tr('alerts.headsUpN', { n: p.reminderMinutesBefore }))
  return parts.length ? parts.join(' · ') : tr('early.rowOff')
}

/** Early reminders: how early each prayer reminds you when you are away from home, and at home. */
function EarlyPage({ back }: { back: () => void }) {
  const s = useStore()
  const p = s.prefs
  const away = isAway(p.home, p.homeConfirmed, s.activePlace)
  const on = p.awayReminder || p.reminderMinutesBefore > 0
  const num = (e: Event) => parseInt((e.target as HTMLSelectElement).value, 10)
  return (
    <Sheet title={tr('early.title')} full>
      <BackBar back={back} />
      <section>
        <div class="group">
          <ToggleItem label={tr('early.master')} sub={tr('early.masterSub')} on={on}
            onChange={(v) => { store.update((x) => { x.awayReminder = v; if (!v) x.reminderMinutesBefore = 0 }); if (v) void ask() }} />
        </div>
      </section>
      {on && (
        <>
          <h2 class="group-title">{tr('early.awayHead')}</h2>
          <section>
            <div class="group">
              <ToggleItem label={tr('early.awaySwitch')} sub={tr('early.awaySwitchSub')} on={p.awayReminder}
                onChange={(v) => { store.update((x) => { x.awayReminder = v }); if (v) void ask() }} />
              {p.home && p.homeConfirmed && (
                <button class="item" onClick={() => openSheet({ kind: 'places', forHome: true })}>
                  <span class="label">{tr('early.home')}<span class="sub">{p.home.name}</span></span>
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
            {!p.home && <p class="group-foot">{tr('early.noHome')}</p>}
            <HomeQuestion />
            {p.awayReminder && p.homeConfirmed && <p class="group-foot">{away ? tr('early.openAway') : tr('early.openHome')}</p>}
          </section>
          {p.awayReminder && (
            <>
              <h2 class="group-title">{tr('early.howEarly')}</h2>
              <section>
                <div class="group">
                  {AWAY_PRAYERS.map((prayer) => (
                    <label class="item">
                      <span class="label">{s.name(prayer)}</span>
                      <select class="inline-select" value={String(p.awayMinutes[prayer] ?? 0)} aria-label={s.name(prayer)}
                        onChange={(e) => { const v = num(e); store.update((x) => { x.awayMinutes = { ...x.awayMinutes, [prayer]: v } }) }}>
                        <option value="0">{tr('common.off')}</option>
                        {AWAY_CHOICES.map((m) => <option value={String(m)}>{awayWord(m)}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                <p class="group-foot">{tr('early.howEarlyFoot')}</p>
              </section>
            </>
          )}
          <h2 class="group-title">{tr('early.atHomeHead')}</h2>
          <section>
            <div class="group">
              <label class="item">
                <span class="label">{tr('alerts.headsUp')}<span class="sub">{tr('early.atHomeSub')}</span></span>
                <select class="inline-select" value={String(p.reminderMinutesBefore)} aria-label={tr('alerts.headsUp')}
                  onChange={(e) => { const v = num(e); store.update((x) => { x.reminderMinutesBefore = v }); if (v > 0) void ask() }}>
                  <option value="0">{tr('common.off')}</option>
                  {REMINDER_CHOICES.map((m) => <option value={String(m)}>{tr('common.minBefore', { n: m })}</option>)}
                </select>
              </label>
            </div>
          </section>
        </>
      )}
      <p class="group-foot">{tr('early.privacy')}</p>
    </Sheet>
  )
}
