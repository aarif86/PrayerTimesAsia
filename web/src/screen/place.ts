import { deviceTimeZone, offsetMinutes } from '../core/tz'
import { CITIES } from '../services/cities'
import { EXAMPLE_PLACE, type ScreenConfig, type ScreenPlace } from './config'

/**
 * When the committee leaves "Where is it" empty, the screen uses a place from the device's own time zone:
 * the first built-in city in that zone, else one with the same clock offset, else the example place.
 * Good for a first look. Picking the real town gives exact times.
 */
export function fallbackPlace(tz: string = deviceTimeZone(), at: number = Date.now()): ScreenPlace {
  const same = CITIES.find((p) => p.timeZoneID === tz)
  const near = same ?? (() => {
    try {
      const off = offsetMinutes(at, tz)
      return CITIES.find((p) => offsetMinutes(at, p.timeZoneID) === off)
    } catch { return undefined }
  })()
  if (!near) return { ...EXAMPLE_PLACE, tz }
  return { name: near.name, lat: near.coordinates.latitude, lng: near.coordinates.longitude, tz: near.timeZoneID, cc: near.countryCode ?? null, district: near.district ?? null }
}

/** The config with a place filled in, so the screen always has somewhere to count times for. */
export function withPlace(c: ScreenConfig): ScreenConfig {
  return c.place ? c : { ...c, place: fallbackPlace() }
}
