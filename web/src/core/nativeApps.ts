/**
 * The iPhone and Android apps, and how the web app offers them.
 *
 * To switch a store on, fill in its line below and merge: the web app starts
 * pointing there on the next deploy. Until then iPhone visitors can ask for a
 * TestFlight invite and Android visitors can ask to hear when it is out.
 */
export const NATIVE_APPS = {
  ios: {
    /** The number in the App Store link (apps.apple.com/app/id1234567890). Also turns on Safari's own App Store banner. */
    appStoreId: '',
    /** A public TestFlight link (testflight.apple.com/join/...), used until the App Store listing exists. */
    testFlightUrl: '',
  },
  android: {
    /** Set to true once the app is live on Google Play. */
    onGooglePlay: false,
    /** A direct download of a test build, used until Google Play is live. Leave empty to ask instead. */
    apkUrl: '',
  },
  packageName: 'com.prayertimesasia.app',
  contactEmail: 'salam@prayertimes.asia',
}

export type NativeApps = typeof NATIVE_APPS
export type PhonePlatform = 'ios' | 'android'

export interface AppOffer {
  platform: PhonePlatform
  /** store: App Store or Google Play; beta: TestFlight or a test download; ask: an email to us. */
  kind: 'store' | 'beta' | 'ask'
  href: string
  title: string
  detail: string
  action: string
}

/** iPhone, iPad or Android, from the browser's own description of itself. */
export function phonePlatform(userAgent: string, platform = '', maxTouchPoints = 0): PhonePlatform | null {
  if (/Android/i.test(userAgent)) return 'android'
  if (/iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)) return 'ios'
  return null
}

const WHY = 'Alerts ring even when it\'s closed, plus Home Screen widgets.'

function mail(to: string, subject: string, body: string): string {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/** What to offer on this phone, or null when there is nothing to offer. */
export function appOffer(p: PhonePlatform | null, apps: NativeApps = NATIVE_APPS): AppOffer | null {
  if (p === 'ios') {
    const ios = apps.ios
    if (ios.appStoreId) return { platform: p, kind: 'store', href: `https://apps.apple.com/app/id${ios.appStoreId}`, title: 'Get the iPhone app', detail: WHY, action: 'Get' }
    if (ios.testFlightUrl) return { platform: p, kind: 'beta', href: ios.testFlightUrl, title: 'Try the iPhone app', detail: `Free test version through Apple's TestFlight. ${WHY}`, action: 'Try' }
    return {
      platform: p, kind: 'ask', title: 'Try the iPhone app', action: 'Ask',
      detail: `It's in testing through Apple's TestFlight. Email us for an invite. ${WHY}`,
      href: mail(apps.contactEmail, 'TestFlight invite: Prayer Times Asia for iPhone', 'Salam, please send me a TestFlight invite for the Prayer Times Asia iPhone app.\n\nThe email for my Apple ID: '),
    }
  }
  if (p === 'android') {
    const android = apps.android
    if (android.onGooglePlay) return { platform: p, kind: 'store', href: `https://play.google.com/store/apps/details?id=${apps.packageName}`, title: 'Get the Android app', detail: WHY, action: 'Get' }
    if (android.apkUrl) return { platform: p, kind: 'beta', href: android.apkUrl, title: 'Try the Android app', detail: `Free test version. ${WHY}`, action: 'Try' }
    return {
      platform: p, kind: 'ask', title: 'Android app coming soon', action: 'Tell me',
      detail: `Email us and we'll let you know when it's on Google Play. ${WHY}`,
      href: mail(apps.contactEmail, 'Prayer Times Asia for Android', 'Salam, please let me know when the Prayer Times Asia Android app is out.'),
    }
  }
  return null
}

/**
 * Safari on iPhone shows Apple's own App Store banner once appStoreId is set
 * (see the apple-itunes-app tag in vite.config.ts), so ours stays out of its way.
 */
export function safariShowsAppleBanner(userAgent: string, apps: NativeApps = NATIVE_APPS): boolean {
  return !!apps.ios.appStoreId && /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent)
}
