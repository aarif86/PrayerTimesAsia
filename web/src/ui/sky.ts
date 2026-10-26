import type { PrayerDay } from '../core/engine'

/**
 * The signature of the app: the background is the sky outside, right now.
 * Keyframes pinned to the day's real prayer times (port of LivingSky.swift).
 */
export interface RGB { r: number; g: number; b: number }
export interface SkyColors { top: RGB; bottom: RGB; glow: RGB }

export const hex = (h: number): RGB => ({ r: ((h >> 16) & 255) / 255, g: ((h >> 8) & 255) / 255, b: (h & 255) / 255 })
export const mixRGB = (a: RGB, b: RGB, t: number): RGB => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t })
export const css = (c: RGB, alpha = 1) =>
  `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${alpha})`

const S = (top: number, bottom: number, glow: number): SkyColors => ({ top: hex(top), bottom: hex(bottom), glow: hex(glow) })

export const SKY = {
  night: S(0x060A1C, 0x1A1E48, 0x9AA6FF),
  preDawn: S(0x0C1A3A, 0x3D4E80, 0x8FB4FF),
  dawn: S(0x2F5E99, 0xF0A07E, 0xFFC59A),
  morning: S(0x2D7FC4, 0x9CD2EE, 0xFFE7A6),
  noon: S(0x166FC2, 0x6FBDE8, 0xFFF1B8),
  afternoon: S(0x3D78B8, 0xE9C27A, 0xFFD27A),
  goldenHour: S(0x5E4A93, 0xF2955A, 0xFFB36B),
  dusk: S(0x2E2260, 0xD9573F, 0xFF8A65),
  evening: S(0x10153A, 0x302C6E, 0xB4A6FF),
}

export const mixSky = (a: SkyColors, b: SkyColors, t: number): SkyColors =>
  ({ top: mixRGB(a.top, b.top, t), bottom: mixRGB(a.bottom, b.bottom, t), glow: mixRGB(a.glow, b.glow, t) })

/** Light appearance: the same sky, washed bright so dark text reads on it. */
export const daylight = (s: SkyColors): SkyColors =>
  ({ top: mixRGB(s.top, hex(0xFFFFFF), 0.62), bottom: mixRGB(s.bottom, hex(0xFFFFFF), 0.8), glow: s.glow })

/** Automatic appearance after dark: the night sky lifted halfway towards twilight. */
export const softNight = (s: SkyColors): SkyColors =>
  ({ top: mixRGB(s.top, hex(0x5C6190), 0.42), bottom: mixRGB(s.bottom, hex(0x8483B0), 0.4), glow: s.glow })

/** 0 in daylight → 1 in full night, from how dark the top of the sky is. */
export function darkness(s: SkyColors): number {
  const l = 0.2126 * s.top.r + 0.7152 * s.top.g + 0.0722 * s.top.b
  return Math.min(1, Math.max(0, (0.22 - l) / 0.16))
}

export function skyAt(now: number, day: PrayerDay): SkyColors {
  const t = day.times
  const frames: [number, SkyColors][] = [
    [t.fajr - 3 * 3_600_000, SKY.night],
    [t.fajr, SKY.preDawn],
    [t.sunrise, SKY.dawn],
    [t.sunrise + 5_400_000, SKY.morning],
    [t.dhuhr, SKY.noon],
    [t.asr, SKY.afternoon],
    [t.maghrib - 2_400_000, SKY.goldenHour],
    [t.maghrib, SKY.dusk],
    [t.isha, SKY.evening],
    [t.isha + 3 * 3_600_000, SKY.night],
  ]
  if (now <= frames[0][0] || now >= frames[frames.length - 1][0]) return SKY.night
  for (let i = 0; i < frames.length - 1; i++) {
    if (now >= frames[i][0] && now < frames[i + 1][0]) {
      const span = frames[i + 1][0] - frames[i][0]
      const f = span > 0 ? (now - frames[i][0]) / span : 0
      const eased = f * f * (3 - 2 * f)
      return mixSky(frames[i][1], frames[i + 1][1], eased)
    }
  }
  return SKY.night
}
