import { describe, expect, it } from 'vitest'
import { timeZoneForLocated, timeZoneForPlace } from '../src/core/regions'
import { ZONE_ANCHORS } from '../src/core/zoneAnchors'
import { isValidTimeZone, offsetMinutes } from '../src/core/tz'

/**
 * A searched or GPS place gets its time zone from its country and position.
 * A wrong zone moves every time on screen by an hour or more, so these are
 * places where "nearest listed city by longitude" picked the wrong one.
 */
describe('Time zone of a searched place', () => {
  const at = (cc: string, lat: number, lng: number) => timeZoneForPlace(cc, lng, lat)
  const summer = Date.UTC(2026, 6, 1, 12)
  const offsetAt = (cc: string, lat: number, lng: number) => offsetMinutes(summer, at(cc, lat, lng)!)

  it('keeps the old answers without a latitude', () => {
    expect(timeZoneForPlace('US', -118.2)).toBe('America/Los_Angeles')
    expect(timeZoneForPlace('US', -74)).toBe('America/New_York')
    expect(timeZoneForPlace('ID', 106.8)).toBe('Asia/Jakarta')
    expect(timeZoneForPlace('ID', 119.4)).toBe('Asia/Makassar')
    expect(timeZoneForPlace('MY', 110.3)).toBe('Asia/Kuching')
  })

  it('every zone point is a zone the browser knows', () => {
    for (const [cc, , , tz] of ZONE_ANCHORS) expect(isValidTimeZone(tz), `${cc} ${tz}`).toBe(true)
  })

  it('United States: Eastern Indiana, Mountain Utah, Pacific Nevada, Alaska, Hawaii', () => {
    expect(offsetAt('US', 39.77, -86.16)).toBe(-240) // Indianapolis, EDT
    expect(offsetAt('US', 40.76, -111.89)).toBe(-360) // Salt Lake City, MDT (not Phoenix)
    expect(offsetAt('US', 36.17, -115.14)).toBe(-420) // Las Vegas, PDT
    expect(offsetAt('US', 33.45, -112.07)).toBe(-420) // Phoenix, no summer time
    expect(offsetAt('US', 61.22, -149.9)).toBe(-480) // Anchorage
    expect(offsetAt('US', 21.31, -157.86)).toBe(-600) // Honolulu
    expect(offsetAt('US', 40.71, -74.0)).toBe(-240) // New York
    expect(offsetAt('US', 41.88, -87.63)).toBe(-300) // Chicago
  })

  it('Canada, Russia, Brazil, Spain, Mongolia', () => {
    expect(offsetAt('CA', 44.65, -63.57)).toBe(-180) // Halifax
    expect(offsetAt('CA', 50.45, -104.62)).toBe(-360) // Regina, no summer time
    expect(offsetAt('RU', 55.03, 82.93)).toBe(420) // Novosibirsk, not Ufa's +5
    expect(offsetAt('RU', 55.8, 49.11)).toBe(180) // Kazan
    expect(offsetAt('RU', 54.74, 55.97)).toBe(300) // Ufa
    expect(offsetAt('BR', -3.12, -60.02)).toBe(-240) // Manaus
    expect(offsetAt('BR', -23.55, -46.63)).toBe(-180) // São Paulo
    expect(offsetAt('ES', 28.12, -15.43)).toBe(60) // Las Palmas, Canary Islands
    expect(offsetAt('ES', 40.42, -3.7)).toBe(120) // Madrid
    expect(offsetAt('MN', 48.97, 89.96)).toBe(420) // Ölgii
  })

  it('Indonesia: Central Kalimantan keeps WIB, South Kalimantan and Bali are WITA, Sula is WIT', () => {
    expect(at('ID', -0.955, 114.894)).toBe('Asia/Jakarta') // Muara Teweh
    expect(at('ID', -2.118, 115.17)).toBe('Asia/Jakarta') // Tamiang Layang
    expect(at('ID', -2.21, 113.92)).toBe('Asia/Jakarta') // Palangka Raya
    expect(at('ID', -3.32, 114.59)).toBe('Asia/Makassar') // Banjarmasin
    expect(at('ID', -2.42, 115.25)).toBe('Asia/Makassar') // Amuntai
    expect(at('ID', -8.65, 115.22)).toBe('Asia/Makassar') // Denpasar
    expect(at('ID', -8.22, 114.37)).toBe('Asia/Jakarta') // Banyuwangi
    expect(at('ID', -6.21, 106.85)).toBe('Asia/Jakarta') // Jakarta
    expect(at('ID', -2.06, 125.98)).toBe('Asia/Jayapura') // Sanana, Sula Islands
    expect(at('ID', -0.95, 122.79)).toBe('Asia/Makassar') // Luwuk
    expect(at('ID', 1.47, 124.84)).toBe('Asia/Makassar') // Manado
    expect(at('ID', -3.7, 128.18)).toBe('Asia/Jayapura') // Ambon
  })

  it('single-zone and fixed countries are unchanged', () => {
    expect(at('SG', 1.35, 103.82)).toBe('Asia/Singapore')
    expect(at('MY', 3.14, 101.69)).toBe('Asia/Kuala_Lumpur')
    expect(at('MY', 1.55, 110.34)).toBe('Asia/Kuching')
    expect(at('BN', 4.89, 114.94)).toBe('Asia/Brunei')
    expect(at('GB', 51.5, -0.12)).toBe('Europe/London')
  })
})

describe('Time zone of a GPS place', () => {
  it("uses the device's zone when the device is in that country", () => {
    expect(timeZoneForLocated('US', 39.77, -86.16, 'America/New_York')).toBe('America/New_York')
    expect(timeZoneForLocated('AU', -27.47, 153.03, 'Australia/Brisbane')).toBe('Australia/Brisbane')
  })

  it("works it out from the place when the device's zone is another country's", () => {
    expect(timeZoneForLocated('SG', 1.35, 103.82, 'Europe/London')).toBe('Asia/Singapore')
    expect(timeZoneForLocated('US', 40.76, -111.89, 'Asia/Singapore')).toBe('America/Denver')
    expect(timeZoneForLocated('ID', -0.955, 114.894, 'UTC')).toBe('Asia/Jakarta')
  })
})
