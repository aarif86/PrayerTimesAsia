import type { AlertMode } from './alertMode'

/**
 * The Show more times that can ring like a prayer: Dhuha, the middle of the night
 * and the last third. Off, Notify or Alarm, rung at the time itself.
 * Imsak keeps its own switch in Ramadan.
 */
export type ExtraTime = 'dhuha' | 'midnight' | 'lastThird'
export const EXTRA_TIMES: readonly ExtraTime[] = ['dhuha', 'midnight', 'lastThird']
export const isExtra = (b: string): b is ExtraTime => (EXTRA_TIMES as readonly string[]).includes(b)

export type ExtraAlerts = Partial<Record<ExtraTime, AlertMode>>

export function extraMode(p: { extraAlerts?: ExtraAlerts }, b: ExtraTime): AlertMode {
  const m = p.extraAlerts?.[b]
  return m === 'notify' || m === 'alarm' ? m : 'off'
}

/** The bell on the row: Off, then Notify, then Alarm, then Off again. */
export function nextExtraMode(p: { extraAlerts?: ExtraAlerts }, b: ExtraTime): AlertMode {
  const order: AlertMode[] = ['off', 'notify', 'alarm']
  return order[(order.indexOf(extraMode(p, b)) + 1) % order.length]
}
