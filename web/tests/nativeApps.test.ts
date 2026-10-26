import { describe, expect, it } from 'vitest'
import { appOffer, NATIVE_APPS, phonePlatform, safariShowsAppleBanner, type NativeApps } from '../src/core/nativeApps'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

const withApps = (change: (a: NativeApps) => void): NativeApps => { const a = structuredClone(NATIVE_APPS); change(a); return a }

describe('phone apps on offer', () => {
  it('tells iPhone, iPad and Android apart from computers', () => {
    expect(phonePlatform(IPHONE)).toBe('ios')
    expect(phonePlatform(IPAD_DESKTOP, 'MacIntel', 5)).toBe('ios')
    expect(phonePlatform(IPAD_DESKTOP, 'MacIntel', 0)).toBeNull()
    expect(phonePlatform(ANDROID)).toBe('android')
    expect(phonePlatform(WINDOWS, 'Win32')).toBeNull()
  })

  it('offers nothing on a computer', () => {
    expect(appOffer(null)).toBeNull()
  })

  it('asks for an invite or a heads-up while there are no store links', () => {
    const apps = withApps((a) => { a.ios = { appStoreId: '', testFlightUrl: '' }; a.android = { onGooglePlay: false, apkUrl: '' } })
    expect(appOffer('ios', apps)).toMatchObject({ kind: 'ask', href: expect.stringMatching(/^mailto:salam@prayertimes\.asia\?subject=TestFlight/) })
    expect(appOffer('android', apps)).toMatchObject({ kind: 'ask', href: expect.stringMatching(/^mailto:salam@prayertimes\.asia/) })
  })

  it('prefers the store, then the test version', () => {
    const beta = withApps((a) => { a.ios.testFlightUrl = 'https://testflight.apple.com/join/abc'; a.android.apkUrl = 'https://example.org/app.apk' })
    expect(appOffer('ios', beta)).toMatchObject({ kind: 'beta', href: 'https://testflight.apple.com/join/abc' })
    expect(appOffer('android', beta)).toMatchObject({ kind: 'beta', href: 'https://example.org/app.apk' })
    const live = withApps((a) => { a.ios.appStoreId = '123'; a.ios.testFlightUrl = 'x'; a.android.onGooglePlay = true; a.android.apkUrl = 'x' })
    expect(appOffer('ios', live)).toMatchObject({ kind: 'store', href: 'https://apps.apple.com/app/id123' })
    expect(appOffer('android', live)).toMatchObject({ kind: 'store', href: 'https://play.google.com/store/apps/details?id=com.prayertimesasia.app' })
  })

  it("steps aside for Safari's own banner, but not in Chrome on iPhone", () => {
    const live = withApps((a) => { a.ios.appStoreId = '123' })
    expect(safariShowsAppleBanner(IPHONE, live)).toBe(true)
    expect(safariShowsAppleBanner(IPHONE_CHROME, live)).toBe(false)
    expect(safariShowsAppleBanner(IPHONE, withApps((a) => { a.ios.appStoreId = '' }))).toBe(false)
  })
})
