import { describe, expect, it } from 'vitest'
import { alertMode, fridayMode, nextAlertMode, notifies, setAlertMode, setFridayMode, setNotify, unifyAlerts, type AlertPrefs } from '../src/core/alertMode'
import { DEFAULT_PREFS, decodePreferences } from '../src/services/prefs'

const fresh = (): AlertPrefs => structuredClone(DEFAULT_PREFS)

describe('Alerts and alarms, one choice per prayer', () => {
  it('starts with every prayer Off, even though the old list held all five', () => {
    const p = fresh()
    for (const prayer of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) expect(alertMode(p, prayer)).toBe('off')
  })

  it('Notify on one prayer turns on only that prayer the first time', () => {
    const p = fresh()
    setAlertMode(p, 'dhuhr', 'notify')
    expect(p.notificationsEnabled).toBe(true)
    expect(p.notifyPrayers).toEqual(['dhuhr'])
    expect(alertMode(p, 'asr')).toBe('off')
  })

  it('Alarm keeps a notification the prayer already had, Notify clears the alarm, Off clears both', () => {
    const p = fresh()
    setAlertMode(p, 'fajr', 'notify')
    setAlertMode(p, 'fajr', 'alarm')
    expect(p.wakeUp).toBe('atFajr')
    expect(alertMode(p, 'fajr')).toBe('alarm')
    expect(notifies(p, 'fajr')).toBe(true)
    setAlertMode(p, 'fajr', 'notify')
    expect(p.wakeUp).toBeNull()
    setAlertMode(p, 'fajr', 'off')
    expect(notifies(p, 'fajr')).toBe(false)
  })

  it('keeps the alarm time already chosen', () => {
    const p = fresh()
    p.asrAlarm = 'endMinus30'
    setAlertMode(p, 'asr', 'notify')
    setAlertMode(p, 'asr', 'alarm')
    expect(p.asrAlarm).toBe('atStart')
    p.asrAlarm = 'plus15'
    setAlertMode(p, 'asr', 'alarm')
    expect(p.asrAlarm).toBe('plus15')
  })

  it('the bell goes Off, Notify, Alarm, Off, and Syuruk has no alarm', () => {
    const p = fresh()
    const seen: string[] = []
    for (let i = 0; i < 4; i++) { const m = nextAlertMode(p, 'maghrib'); setAlertMode(p, 'maghrib', m); seen.push(m) }
    expect(seen).toEqual(['notify', 'alarm', 'off', 'notify'])
    const q = fresh()
    setAlertMode(q, 'sunrise', nextAlertMode(q, 'sunrise'))
    expect(alertMode(q, 'sunrise')).toBe('notify')
    expect(nextAlertMode(q, 'sunrise')).toBe('off')
  })

  it('Notification too turns on alongside an alarm without touching the other prayers', () => {
    const p = fresh()
    setAlertMode(p, 'isha', 'alarm')
    setNotify(p, 'isha', true)
    expect(p.notifyPrayers).toEqual(['isha'])
    expect(alertMode(p, 'isha')).toBe('alarm')
  })

  it('Friday is Off, Notify or Alarm, 30 min before unless already set', () => {
    const p = fresh()
    expect(fridayMode(p)).toBe('off')
    setFridayMode(p, 'alarm')
    expect(p.jumuahReminderMinutes).toBe(30)
    expect(p.jumuahLeaveAlarm).toBe(true)
    p.jumuahReminderMinutes = 60
    setFridayMode(p, 'notify')
    expect(p.jumuahReminderMinutes).toBe(60)
    expect(fridayMode(p)).toBe('notify')
    setFridayMode(p, 'off')
    expect(p.jumuahReminderMinutes).toBe(0)
    expect(p.jumuahLeaveAlarm).toBe(false)
  })

  it('people with only Reminder before prayer on now see those prayers as Notify', () => {
    const p = fresh()
    p.reminderMinutesBefore = 15
    unifyAlerts(p)
    expect(p.notificationsEnabled).toBe(true)
    expect(alertMode(p, 'asr')).toBe('notify')
    const saved = decodePreferences({ notificationsEnabled: false, reminderMinutesBefore: 10, notifyPrayers: ['asr'] })
    expect(alertMode(saved, 'asr')).toBe('notify')
    expect(alertMode(saved, 'dhuhr')).toBe('off')
    const untouched = decodePreferences({ notificationsEnabled: false, reminderMinutesBefore: 0 })
    expect(untouched.notificationsEnabled).toBe(false)
  })
})
