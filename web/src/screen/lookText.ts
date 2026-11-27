import type { ScreenLanguage, ScreenLook } from './config'

/**
 * The look names and short lines on the setup page, in the screen language the committee picked.
 * The names match the app (Android words): Malay and Indonesian each have their own. Needs a native speaker read.
 */
export interface LookText { name: string; hint: string }

export const LOOK_TEXT: Record<ScreenLanguage, Record<ScreenLook, LookText>> = {
  en: {
    dial: { name: 'Centre Dial', hint: 'The whole day as a ring on the sky, like the app' },
    sunpath: { name: 'Sun Path', hint: 'The sun moving across the day, like the app' },
    bands: { name: 'Colour Bands', hint: 'Each prayer in its own colour, like the app' },
    simple: { name: 'Big and Simple', hint: 'Plain, big and calm, with no moving sky' },
    surau: { name: 'Calm Gold', hint: 'Navy and gold with a faint pattern, calm and clear' },
  },
  ms: {
    dial: { name: 'Dail Tengah', hint: 'Seluruh hari sebagai cincin di langit, seperti dalam aplikasi' },
    sunpath: { name: 'Laluan Matahari', hint: 'Matahari bergerak sepanjang hari, seperti dalam aplikasi' },
    bands: { name: 'Jalur Warna', hint: 'Setiap waktu solat dengan warnanya sendiri, seperti dalam aplikasi' },
    simple: { name: 'Besar dan Mudah', hint: 'Ringkas, besar dan tenang, tanpa langit yang bergerak' },
    surau: { name: 'Emas Tenang', hint: 'Biru tua dan emas dengan corak halus, tenang dan jelas' },
  },
  id: {
    dial: { name: 'Dial Tengah', hint: 'Seluruh hari sebagai lingkaran di langit, seperti di aplikasi' },
    sunpath: { name: 'Lintasan Matahari', hint: 'Matahari bergerak sepanjang hari, seperti di aplikasi' },
    bands: { name: 'Pita Warna', hint: 'Setiap waktu salat dengan warnanya sendiri, seperti di aplikasi' },
    simple: { name: 'Besar dan Sederhana', hint: 'Sederhana, besar dan tenang, tanpa langit yang bergerak' },
    surau: { name: 'Emas Tenang', hint: 'Biru tua dan emas dengan corak halus, tenang dan jelas' },
  },
}

/** Words around the look choices, in each screen language. */
export const LOOK_WORDS: Record<ScreenLanguage, { heading: string; fitsAll: string; dark: string; light: string; modeHint: string }> = {
  en: { heading: 'Choose the look', fitsAll: 'Every look fits every layout.', dark: 'Dark', light: 'Light', modeHint: 'Dark suits a dim prayer hall. Light suits a bright hall or the foyer.' },
  ms: { heading: 'Pilih rupa', fitsAll: 'Setiap rupa sesuai dengan setiap susun atur.', dark: 'Gelap', light: 'Cerah', modeHint: 'Gelap sesuai untuk dewan solat yang malap. Cerah sesuai untuk dewan yang terang atau ruang masuk.' },
  id: { heading: 'Pilih tampilan', fitsAll: 'Setiap tampilan cocok dengan setiap tata letak.', dark: 'Gelap', light: 'Terang', modeHint: 'Gelap cocok untuk ruang salat yang redup. Terang cocok untuk ruang yang terang atau serambi.' },
}
