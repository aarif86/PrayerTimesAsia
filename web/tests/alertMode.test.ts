import { describe, expect, it } from 'vitest'
import { alertMode, allFiveNotify, applyToAllFive, notifyAllFive, fridayMode, nextAlertMode, notifies, setAlertMode, setFridayMode, setNotify, unifyAlerts, type AlertPrefs } from '../src/core/alertMode'
import { DEFAULT_PREFS, decodePreferences } from '../src/services/prefs'

/** A person who has not turned alerts on (before the new-install default). */
const fresh = (): AlertPrefs => ({ ...structuredClone(DEFAULT_PREFS), notificationsEnabled: false })

describe('New installs and the all five button', () => {
  it('a new install is on Notify for the five prayers and Off for Sunrise', () => {
    const p: AlertPrefs = structuredClone(DEFAULT_PREFS)
    for (const x of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) expect(alertMode(p, x)).toBe('notify')
    expect(alertMode(p, 'sunrise')).toBe('off')
    expect(allFiveNotify(p)).toBe(true)
  })

  it('saved settings keep their choice, including Off on purpose and a missing choice', () => {
    expect(decodePreferences({ notificationsEnabled: false }).notificationsEnabled).toBe(false)
    expect(decodePreferences({ lang: 'en' }).notificationsEnabled).toBe(false)
    expect(decodePreferences({ notificationsEnabled: true }).notificationsEnabled).toBe(true)
  })

  it('the button turns Off prayers to Notify, leaves Alarm and Sunrise alone', () => {
    const p = fresh()
    setAlertMode(p, 'fajr', 'alarm')
    notifyAllFive(p)
    expect(alertMode(p, 'fajr')).toBe('alarm')
    expect(p.wakeUp).toBe('atFajr')
    for (const x of ['dhuhr', 'asr', 'maghrib', 'isha'] as const) expect(alertMode(p, x)).toBe('notify')
    expect(alertMode(p, 'sunrise')).toBe('off')
    expect(allFiveNotify(p)).toBe(false)
  })

  it('the button drops an old leftover list, so Sunrise stays off', () => {
    const p = fresh()
    p.notifyPrayers = ['sunrise', 'asr']
    notifyAllFive(p)
    expect(alertMode(p, 'sunrise')).toBe('off')
    expect(allFiveNotify(p)).toBe(true)
  })

  it('a prayer set Off after the button can be switched back individually', () => {
    const p = fresh()
    notifyAllFive(p)
    expect(allFiveNotify(p)).toBe(true)
    setAlertMode(p, 'asr', 'off')
    expect(alertMode(p, 'asr')).toBe('off')
    expect(allFiveNotify(p)).toBe(false)
  })
})

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

describe('Set for all prayers', () => {
  const five = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const

  it('Notification turns all five on and the azan sound off', () => {
    const p = fresh()
    p.azanSound = true
    applyToAllFive(p, 'notify', null)
    for (const x of five) expect(alertMode(p, x)).toBe('notify')
    expect(p.azanSound).toBe(false)
    expect(alertMode(p, 'sunrise')).toBe('off')
  })

  it('Short azan is a notification with the azan sound on', () => {
    const p = fresh()
    applyToAllFive(p, 'azan', null)
    for (const x of five) expect(alertMode(p, x)).toBe('notify')
    expect(p.azanSound).toBe(true)
  })

  it('Alarm puts an alarm on all five and Off clears them', () => {
    const p = fresh()
    applyToAllFive(p, 'alarm', null)
    for (const x of five) expect(alertMode(p, x)).toBe('alarm')
    applyToAllFive(p, 'off', null)
    for (const x of five) expect(alertMode(p, x)).toBe('off')
    expect(p.wakeUp).toBeNull()
  })

  it('leaves Fajr and its alarm time alone when not included', () => {
    const p = fresh()
    p.wakeUp = 'fajrMinus30'
    applyToAllFive(p, 'notify', null, false)
    expect(p.wakeUp).toBe('fajrMinus30')
    expect(alertMode(p, 'dhuhr')).toBe('notify')
  })

  it('sets the early reminder only when asked, and 0 turns it off', () => {
    const p = fresh()
    p.reminderMinutesBefore = 20
    applyToAllFive(p, 'notify', null)
    expect(p.reminderMinutesBefore).toBe(20)
    applyToAllFive(p, 'notify', 30)
    expect(p.reminderMinutesBefore).toBe(30)
    applyToAllFive(p, 'notify', 0)
    expect(p.reminderMinutesBefore).toBe(0)
  })
})
