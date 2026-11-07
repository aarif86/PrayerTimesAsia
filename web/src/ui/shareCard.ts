import { store } from '../services/store'
import { addDays, type CivilDay } from '../core/season'

/**
 * Pictures people send to family and group chats: this week's Imsak and Berbuka
 * times for their city, and a Hari Raya card. Drawn on the phone; nothing is uploaded.
 */

const W = 1080

function base(h: number, top: string, bottom: string): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = h
  const g = canvas.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, top)
  grad.addColorStop(1, bottom)
  g.fillStyle = grad
  g.fillRect(0, 0, W, h)
  return { canvas, g }
}

function crescent(g: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string, bg: string) {
  g.fillStyle = colour
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
  g.fillStyle = bg
  g.beginPath(); g.arc(x + r * 0.42, y - r * 0.18, r * 0.86, 0, Math.PI * 2); g.fill()
}

function footer(g: CanvasRenderingContext2D, h: number) {
  g.fillStyle = 'rgba(255,255,255,0.7)'
  g.font = '500 30px Inter, system-ui, sans-serif'
  g.textAlign = 'center'
  g.fillText('Prayer Times Asia · prayertimes.asia', W / 2, h - 60)
}

const dayName = (d: CivilDay) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
  .format(new Date(Date.UTC(d.year, d.month - 1, d.day))).replace(',', '')

/** Seven days of Imsak and Berbuka from today (Ramadan days only). */
export function weekCard(now: number): HTMLCanvasElement | null {
  const today = store.civil(now)
  const rows: { label: string; hijri: number; imsak: string; berbuka: string }[] = []
  for (let i = 0; i < 7; i++) {
    const g = addDays(today, i)
    const h = store.hijriOfCivil(g)
    if (h.month !== 9) continue
    const day = store.dayOfCivil(g)
    if (!day) continue
    rows.push({ label: dayName(g), hijri: h.day, imsak: store.formatted(store.imsak(day)), berbuka: store.formatted(day.times.maghrib) })
  }
  if (!rows.length) return null
  const h = 520 + rows.length * 120
  const { canvas, g } = base(h, '#101a4a', '#3a1f5c')
  crescent(g, W - 150, 150, 70, '#f3c969', '#16204f')
  g.textAlign = 'left'
  g.fillStyle = '#f3c969'
  g.font = '700 44px Inter, system-ui, sans-serif'
  g.fillText('Ramadan Kareem', 80, 130)
  g.fillStyle = '#fff'
  g.font = '700 68px Inter, system-ui, sans-serif'
  g.fillText(store.activePlace?.name ?? '', 80, 220)
  g.fillStyle = 'rgba(255,255,255,0.75)'
  g.font = '500 34px Inter, system-ui, sans-serif'
  g.fillText('Imsak and Berbuka this week', 80, 280)
  g.font = '700 30px Inter, system-ui, sans-serif'
  g.fillStyle = 'rgba(255,255,255,0.6)'
  g.fillText('DAY', 80, 370)
  g.textAlign = 'right'
  g.fillText('IMSAK', 760, 370)
  g.fillText('BERBUKA', 1000, 370)
  rows.forEach((r, i) => {
    const y = 460 + i * 120
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.09)'
    g.fillRect(50, y - 75, W - 100, 108)
    g.textAlign = 'left'
    g.fillStyle = '#fff'
    g.font = '600 40px Inter, system-ui, sans-serif'
    g.fillText(r.label, 80, y)
    g.fillStyle = 'rgba(255,255,255,0.6)'
    g.font = '500 28px Inter, system-ui, sans-serif'
    g.fillText(`${r.hijri} Ramadan`, 80, y + 34 - 4)
    g.textAlign = 'right'
    g.fillStyle = '#fff'
    g.font = '600 46px Inter, system-ui, sans-serif'
    g.fillText(r.imsak, 760, y + 10)
    g.fillStyle = '#f3c969'
    g.fillText(r.berbuka, 1000, y + 10)
  })
  g.textAlign = 'center'
  g.fillStyle = 'rgba(255,255,255,0.6)'
  g.font = '500 26px Inter, system-ui, sans-serif'
  g.fillText('Follow your local religious authority for the start of Ramadan and Raya.', W / 2, h - 110)
  footer(g, h)
  return canvas
}

/** A simple Hari Raya card with the sender's own words. */
export function rayaCard(fromName: string): HTMLCanvasElement {
  const h = 1350
  const { canvas, g } = base(h, '#0f3d2e', '#1f6b4f')
  // Ketupat lattice in the corners.
  g.strokeStyle = 'rgba(243,201,105,0.35)'
  g.lineWidth = 6
  for (const [cx, cy] of [[140, 160], [W - 140, 160], [140, h - 260], [W - 140, h - 260]]) {
    g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4)
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 18, -45); g.lineTo(i * 18, 45); g.stroke(); g.beginPath(); g.moveTo(-45, i * 18); g.lineTo(45, i * 18); g.stroke() }
    g.restore()
  }
  crescent(g, W / 2, 330, 110, '#f3c969', '#145a42')
  g.textAlign = 'center'
  g.fillStyle = '#f3c969'
  g.font = '700 84px Inter, system-ui, sans-serif'
  g.fillText('Selamat Hari Raya', W / 2, 620)
  g.fillText('Aidilfitri', W / 2, 720)
  g.fillStyle = '#fff'
  g.font = '500 44px Inter, system-ui, sans-serif'
  g.fillText('Maaf zahir dan batin', W / 2, 820)
  g.font = '500 34px Inter, system-ui, sans-serif'
  g.fillStyle = 'rgba(255,255,255,0.8)'
  g.fillText('Taqabbalallahu minna wa minkum', W / 2, 890)
  if (fromName.trim()) {
    g.fillStyle = '#fff'
    g.font = '600 44px Inter, system-ui, sans-serif'
    g.fillText(`From ${fromName.trim().slice(0, 40)}`, W / 2, 1040)
  }
  footer(g, h)
  return canvas
}

/** Shares the picture where the browser can, otherwise saves it. */
export async function sharePicture(canvas: HTMLCanvasElement, name: string, text: string): Promise<void> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) return
  const file = new File([blob], `${name}.png`, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  try {
    if (nav.share && nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], text }); return }
  } catch { /* cancelled, or not allowed: save instead */ return }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
