import { AlarmClock, AlarmClockCheck, Check, Download, Smartphone } from 'lucide-preact'
import type { PrayerDay } from '../core/engine'
import {
  SAHUR_DAY_LABEL, SAHUR_DAYS, SAHUR_TIMINGS, sahurLabel, sahurTime, WAKE_PARTS, WAKE_UP_TIMINGS, wakePart, wakeUpLabel, wakeUpTime,
  type SahurTiming, type WakeUpTiming,
} from '../core/wakeup'
import { alertSupport, downloadWakeICS, nextWakeUp, requestPermission } from '../services/notifications'
import { store, useNow, useStore } from '../services/store'
import { Sheet, ToggleItem } from './common'
import { phoneAppOffer } from './pwa'

/** The alarm clock on the Prayer screen: shows the next alarm's time when one is set. */
export function WakeChip({ now, open }: { now: number; open: () => void }) {
  const next = nextWakeUp(now)
  const fajr = store.name('fajr')
  if (!next) {
    return (
      <button class="round-btn" onClick={open} aria-label={`Wake up for ${fajr}: set an alarm`}>
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
 * Wake up for Subuh: the Subuh alarm and the earlier sahur alarm.
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

  const Choice = ({ label, detail, on, pick }: { label: string; detail?: string | null; on: boolean; pick: () => void }) => (
    <button class="item choice" onClick={pick} aria-pressed={on}>
      <span class="label">{label}</span>
      {detail && <span class="value mono">{detail}</span>}
      <Check size={18} class="choice-tick" style={{ opacity: on ? 1 : 0 }} />
    </button>
  )

  return (
    <Sheet title={`Wake up for ${fajr}`} full>
      <div class="glass card wake-hadith">
        <p class="arabic" dir="rtl" lang="ar">اللَّهُمَّ بَارِكْ لِأُمَّتِي فِي بُكُورِهَا</p>
        <p class="quote">“O Allah, bless my ummah in their early mornings.”</p>
        <p class="caption secondary">The Prophet ﷺ, narrated by Abu Dawud and Tirmidhi</p>
        {next && <p class="next">Next alarm {whenText(now, next.at)} {s.formatted(next.at)}{next.sahur ? ' for sahur' : ''}</p>}
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

      {(p.wakeUp || p.sahurAlarm) && (
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
