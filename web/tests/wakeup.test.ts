import { describe, expect, it } from 'vitest'
import { compute } from '../src/core/engine'
import { gregorianFromHijri } from '../src/core/hijri'
import { methodWithId } from '../src/core/methods'
import { prayerAlarmChoices, prayerAlarmLabel, prayerAlarmTime, sahurLabel, sahurRings, sahurTime, wakeUpLabel, wakeUpTime } from '../src/core/wakeup'
import { applyMoved, decodeMove, encodeMove, movedFrom } from '../src/services/move'
import { decodePreferences, DEFAULT_PREFS } from '../src/services/prefs'

const singapore = { latitude: 1.3521, longitude: 103.8198 }
const tz = 'Asia/Singapore'
const day = (y: number, m: number, d: number) => compute(y, m, d, singapore, methodWithId('muis')!, 'standard')
const hijri = (y: number, m: number, d: number) => { const g = gregorianFromHijri(y, m, d)!; return day(g.year, g.month, g.day) }

describe('Wake up for Subuh', () => {
  it('tahajjud and sahur times count back from Subuh', () => {
    const d = day(2026, 10, 21)
    expect(wakeUpTime('fajrMinus30', d)).toBe(d.times.fajr - 30 * 60_000)
    expect(wakeUpTime('sunriseMinus15', d)).toBe(d.times.sunrise - 15 * 60_000)
    expect(sahurTime('fajrMinus90', d)).toBe(d.times.fajr - 90 * 60_000)
    expect(wakeUpLabel('fajrMinus30', 'malay')).toBe('30 min before Subuh for tahajjud')
    expect(wakeUpTime('fajrPlus5', d)).toBe(d.times.fajr + 5 * 60_000)
    expect(wakeUpLabel('fajrPlus5', 'malay')).toBe('5 min after Subuh begins')
    expect(wakeUpLabel('sunriseMinus60', 'malay')).toBe('1 hour before Syuruk')
    expect(wakeUpTime('sunriseMinus45', d)).toBe(d.times.sunrise - 45 * 60_000)
    // Never before Subuh, even where Subuh to Syuruk is short.
    expect(wakeUpTime('sunriseMinus60', { ...d, times: { ...d.times, sunrise: d.times.fajr + 40 * 60_000 } })).toBe(d.times.fajr)
    expect(sahurLabel('fajrMinus120', 'malay')).toBe('2 hours before Subuh')
  })

  it('the sahur alarm rings on the chosen fasting days', () => {
    expect(sahurRings(day(2026, 11, 9), ['monThu'], tz, 0)).toBe(true) // Monday
    expect(sahurRings(day(2026, 11, 12), ['monThu'], tz, 0)).toBe(true) // Thursday
    expect(sahurRings(day(2026, 11, 10), ['monThu'], tz, 0)).toBe(false) // Tuesday
    expect(sahurRings(day(2026, 11, 10), ['everyDay'], tz, 0)).toBe(true)
    expect(sahurRings(hijri(1448, 9, 10), ['ramadan'], tz, 0)).toBe(true)
    expect(sahurRings(hijri(1448, 8, 20), ['ramadan'], tz, 0)).toBe(false)
    expect(sahurRings(hijri(1448, 6, 14), ['whiteDays'], tz, 0)).toBe(true)
    expect(sahurRings(hijri(1448, 6, 16), ['whiteDays'], tz, 0)).toBe(false)
    // 13 Zulhijjah is a day of Tashreeq: no fast, no alarm.
    expect(sahurRings(hijri(1448, 12, 13), ['whiteDays'], tz, 0)).toBe(false)
    expect(sahurRings(hijri(1448, 12, 14), ['whiteDays'], tz, 0)).toBe(true)
  })

  it('keeps the alarms in saved settings and moves them to another phone', async () => {
    const p = decodePreferences({ wakeUp: 'fajrMinus30', sahurAlarm: 'fajrMinus90', sahurDays: ['whiteDays', 'monThu', 'nonsense'] })
    expect(p.wakeUp).toBe('fajrMinus30')
    expect(p.sahurAlarm).toBe('fajrMinus90')
    expect(p.sahurDays).toEqual(['monThu', 'whiteDays'])
    expect(decodePreferences({ wakeUp: 'teatime' }).wakeUp).toBeNull()
    expect(DEFAULT_PREFS.sahurDays).toEqual(['ramadan', 'monThu'])
    const m = movedFrom(p)
    expect(m).toMatchObject({ wakeUp: 'fajrMinus30', sahurAlarm: 'fajrMinus90', sahurDays: ['monThu', 'whiteDays'] })
    const back = applyMoved(structuredClone(DEFAULT_PREFS), (await decodeMove(await encodeMove(m)))!)
    expect(back.wakeUp).toBe('fajrMinus30')
    expect(back.sahurAlarm).toBe('fajrMinus90')
    expect(back.sahurDays).toEqual(['monThu', 'whiteDays'])
    // The default days stay out of the code.
    expect(movedFrom({ ...structuredClone(DEFAULT_PREFS), sahurAlarm: 'fajrMinus60' }).sahurDays).toBeUndefined()
  })

  it('alarms for the other prayers count from the start, or back from the end', () => {
    const d = day(2026, 10, 21)
    const t = d.times
    expect(prayerAlarmTime('atStart', t.asr, t.maghrib)).toBe(t.asr)
    expect(prayerAlarmTime('plus10', t.asr, t.maghrib)).toBe(t.asr + 10 * 60_000)
    expect(prayerAlarmTime('endMinus30', t.asr, t.maghrib)).toBe(t.maghrib - 30 * 60_000)
    // A very short window never rings before the prayer begins.
    expect(prayerAlarmTime('endMinus30', t.maghrib, t.maghrib + 20 * 60_000)).toBe(t.maghrib)
    expect(prayerAlarmLabel('plus5')).toBe('5 min after')
    expect(prayerAlarmLabel('endMinus30')).toBe('30 min before it ends')
    expect(prayerAlarmLabel('atStart')).toBe('On time')
    // Isyak is open until Subuh, so it has no "before it ends".
    expect(prayerAlarmChoices('isha')).not.toContain('endMinus30')
    expect(prayerAlarmChoices('asr')).toContain('endMinus30')
  })

  it('keeps the other prayer alarms and the sound, and moves them too', async () => {
    const p = decodePreferences({ asrAlarm: 'plus10', ishaAlarm: 'endMinus30', maghribAlarm: 'nope', alarmSound: 'bells' })
    expect(p.asrAlarm).toBe('plus10')
    expect(p.ishaAlarm).toBeNull()
    expect(p.maghribAlarm).toBeNull()
    expect(p.alarmSound).toBe('bells')
    expect(decodePreferences({ alarmSound: 'trumpet' }).alarmSound).toBe('classic')
    const back = applyMoved(structuredClone(DEFAULT_PREFS), (await decodeMove(await encodeMove(movedFrom(p))))!)
    expect(back.asrAlarm).toBe('plus10')
    expect(back.alarmSound).toBe('bells')
    expect(movedFrom(DEFAULT_PREFS).alarmSound).toBeUndefined()
  })
})
