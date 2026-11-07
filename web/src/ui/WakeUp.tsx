import { AlarmClock, AlarmClockCheck, Check, Download, Play, Smartphone } from 'lucide-preact'
import type { PrayerDay } from '../core/engine'
import {
  ALARM_KEY, ALARM_PRAYERS, ALARM_SOUND_LABEL, ALARM_SOUNDS, prayerAlarmChoices, prayerAlarmLabel, prayerAlarmTime,
  SAHUR_DAY_LABEL, SAHUR_DAYS, SAHUR_TIMINGS, sahurLabel, sahurTime, WAKE_PARTS, WAKE_UP_TIMINGS, wakePart, wakeUpLabel, wakeUpTime,
  type AlarmPrayer, type AlarmSound, type PrayerAlarmTiming, type SahurTiming, type WakeUpTiming,
} from '../core/wakeup'
import { previewAlarm } from '../services/alarmSound'
import { alertSupport, anyAlarm, downloadWakeICS, nextWakeUp, requestPermission } from '../services/notifications'
import { store, useNow, useStore } from '../services/store'
import { Sheet, ToggleItem } from './common'
import { phoneAppOffer } from './pwa'

/** The alarm clock on the Prayer screen: shows the next alarm's time when one is set. */
export function WakeChip({ now, open }: { now: number; open: () => void }) {
  const next = nextWakeUp(now)
  const fajr = store.name('fajr')
  if (!next) {
    return (
      <button class="round-btn" onClick={open} aria-label={`Prayer alarms, wake up for ${fajr}: set an alarm`}>
        <AlarmClock size={18} />
      </button>
    )
  }
  return (
    <button class="streak-chip wake-chip" onClick={open} aria-label={`Wake up alarm at ${store.formatted(next.at)}`}>
      <AlarmClockCheck size={16} />
      <span class="mono">{store.formatted(next.at).replace(/ ?[AP]M$/i, '')}</span>
    </button>
  )
}

/** When this choice would next ring: this morning if it is still ahead, else tomorrow. */
function soon(now: number, at: (d: PrayerDay) => number): string | null {
  for (let offset = 0; offset < 2; offset++) {
    const day = store.day(now + offset * 86_400_000)
    if (!day) continue
    const t = at(day)
    if (t > now) return store.formatted(t)
  }
  return null
}

function whenText(now: number, at: number): string {
  const tz = store.timeZone
  const key = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: tz })
  if (key(at) === key(now)) return 'today'
  if (key(at) === key(now + 86_400_000)) return 'tomorrow'
  return new Date(at).toLocaleDateString('en-GB', { weekday: 'long', timeZone: tz })
}

/**
 * Prayer alarms: Subuh first (with the earlier sahur alarm), then the other
 * four prayers, and the sound they all play.
 * "Allahumma barik li ummati fi bukuriha" (Abu Dawud, Tirmidhi).
 */
export function WakeUpSheet() {
  const s = useStore()
  const now = useNow(30_000)
  const p = s.prefs
  const fajr = s.name('fajr')
  const next = nextWakeUp(now)
  const app = phoneAppOffer()

  const ask = async () => { if (alertSupport() === 'supported') await requestPermission() }
  const setWake = (t: WakeUpTiming | null) => { store.update((x) => { x.wakeUp = t }); if (t) void ask() }
  const setSahur = (t: SahurTiming | null) => { store.update((x) => { x.sahurAlarm = t }); if (t) void ask() }
  const setPrayer = (prayer: AlarmPrayer, t: PrayerAlarmTiming | null) => { store.update((x) => { x[ALARM_KEY[prayer]] = t }); if (t) void ask() }
  const setSound = (sound: AlarmSound) => { store.update((x) => { x.alarmSound = sound }); previewAlarm(sound) }
  /** When a prayer's alarm would next ring. */
  const prayerSoon = (prayer: AlarmPrayer, t: PrayerAlarmTiming) => soon(now, (d) => {
    const end = { dhuhr: d.times.asr, asr: d.times.maghrib, maghrib: d.times.isha, isha: d.times.isha }[prayer]
    return prayerAlarmTime(t, d.times[prayer], end)
  })
  const nextFor = next ? (next.sahur ? ' for sahur' : next.prayer ? ` for ${s.name(next.prayer, next.at)}` : '') : ''

  const Choice = ({ label, detail, on, pick }: { label: string; detail?: string | null; on: boolean; pick: () => void }) => (
    <button class="item choice" onClick={pick} aria-pressed={on}>
      <span class="label">{label}</span>
      {detail && <span class="value mono">{detail}</span>}
      <Check size={18} class="choice-tick" style={{ opacity: on ? 1 : 0 }} />
    </button>
  )

  return (
    <Sheet title="Prayer alarms" full>
      <div class="glass card wake-hadith">
        <p class="arabic" dir="rtl" lang="ar">اللَّهُمَّ بَارِكْ لِأُمَّتِي فِي بُكُورِهَا</p>
        <p class="quote">“O Allah, bless my ummah in their early mornings.”</p>
        <p class="caption secondary">The Prophet ﷺ, narrated by Abu Dawud and Tirmidhi</p>
        {next && <p class="next">Next alarm {whenText(now, next.at)} {s.formatted(next.at)}{nextFor}</p>}
      </div>

      {WAKE_PARTS.map((part) => (
        <section>
          <h2 class="group-title">{part === 'beforeFajr' ? `${fajr} alarm` : part === 'fromFajr' ? `From ${fajr}` : `Before ${s.name('sunrise')}`}</h2>
          <div class="group">
            {part === 'beforeFajr' && <Choice label="Off" on={!p.wakeUp} pick={() => setWake(null)} />}
            {WAKE_UP_TIMINGS.filter((t) => wakePart(t) === part).map((t) => (
              <Choice label={wakeUpLabel(t, s.naming)} detail={soon(now, (d) => wakeUpTime(t, d))} on={p.wakeUp === t} pick={() => setWake(t)} />
            ))}
          </div>
          {part === 'beforeSunrise' && <p class="group-foot">Rings every morning and moves with {fajr} wherever you are.</p>}
        </section>
      ))}

      <section>
        <h2 class="group-title">Sahur alarm</h2>
        <div class="group">
          <Choice label="Off" on={!p.sahurAlarm} pick={() => setSahur(null)} />
          {SAHUR_TIMINGS.map((t) => (
            <Choice label={sahurLabel(t, s.naming)} detail={soon(now, (d) => sahurTime(t, d))} on={p.sahurAlarm === t} pick={() => setSahur(t)} />
          ))}
        </div>
        <p class="group-foot">An earlier alarm to eat sahur before a fast, or for a longer night prayer.</p>
      </section>

      {p.sahurAlarm && (
        <section>
          <h2 class="group-title">Sahur alarm rings on</h2>
          <div class="group">
            {SAHUR_DAYS.map((d) => {
              const everyDay = p.sahurDays.includes('everyDay') && d !== 'everyDay'
              return (
                <ToggleItem label={SAHUR_DAY_LABEL[d]} on={p.sahurDays.includes(d) || everyDay}
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
          <p class="group-foot">Ramadan and the white days follow the Hijri date in the app. Please follow your local religious authority for the start of Ramadan.</p>
        </section>
      )}

      <section>
        <h2 class="group-title">Other prayers</h2>
        <div class="group">
          {ALARM_PRAYERS.map((prayer) => {
            const name = s.name(prayer)
            const value = p[ALARM_KEY[prayer]]
            return (
              <label class="item">
                <span class="label">{name}{value && <span class="sub mono">{prayerSoon(prayer, value)}</span>}</span>
                <select class="inline-select" value={value ?? 'off'} aria-label={`${name} alarm`}
                  onChange={(e) => { const v = (e.target as HTMLSelectElement).value; setPrayer(prayer, v === 'off' ? null : (v as PrayerAlarmTiming)) }}>
                  <option value="off">Off</option>
                  {prayerAlarmChoices(prayer).map((t) => <option value={t}>{prayerAlarmLabel(t)}</option>)}
                </select>
              </label>
            )
          })}
        </div>
        <p class="group-foot">An alarm rings loudly until you stop it. If it rings at the very start of a prayer, it takes the place of that prayer's alert.</p>
      </section>

      <section>
        <h2 class="group-title">Alarm sound</h2>
        <div class="group">
          {ALARM_SOUNDS.filter((x) => x !== 'phone').map((sound) => {
            const on = (p.alarmSound === 'phone' ? 'classic' : p.alarmSound) === sound
            return (
              <button class="item choice" onClick={() => setSound(sound)} aria-pressed={on} aria-label={`${ALARM_SOUND_LABEL[sound]}, tap to hear it`}>
                <Play size={14} class="secondary" />
                <span class="label">{ALARM_SOUND_LABEL[sound]}</span>
                <Check size={18} class="choice-tick" style={{ opacity: on ? 1 : 0 }} />
              </button>
            )
          })}
        </div>
        <p class="group-foot">Tap a sound to hear it. Every alarm plays this sound. The azan will join the list once the recordings are ready.</p>
      </section>

      {anyAlarm(p) && (
        <section>
          <div class="group">
            <button class="item" onClick={downloadWakeICS}>
              <Download size={20} /><span class="label">Add the next 30 days to a calendar<span class="sub">Your phone's calendar rings each alarm, even with this page closed</span></span>
            </button>
            {app && (
              <a class="item" href={app.href} target="_blank" rel="noopener">
                <Smartphone size={20} /><span class="label">{app.title}<span class="sub">For an alarm that rings even on silent</span></span>
              </a>
            )}
          </div>
        </section>
      )}
      <p class="group-foot">On the web an alarm can ring only while Prayer Times Asia is open. For every morning, add it to your calendar or use the iPhone or Android app.</p>
    </Sheet>
  )
}
