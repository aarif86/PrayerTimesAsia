import { describe, expect, it } from 'vitest'
import { luminance, readable, SKY, softNight, type RGB } from '../src/ui/sky'

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
const over = (fg: RGB, alpha: number, bg: RGB): RGB =>
  ({ r: bg.r + (fg.r - bg.r) * alpha, g: bg.g + (fg.g - bg.g) * alpha, b: bg.b + (fg.b - bg.b) * alpha })
const grey: RGB = { r: 235 / 255, g: 235 / 255, b: 245 / 255 }

describe('readable sky (dark looks)', () => {
  for (const [name, sky] of Object.entries(SKY)) {
    for (const [look, s] of [['dark', readable(sky)], ['soft night', readable(softNight(sky))]] as const) {
      it(`${name} (${look}): white text 7:1, grey notes 4.5:1`, () => {
        for (const c of [s.top, s.bottom]) {
          expect(contrast(1, luminance(c))).toBeGreaterThanOrEqual(7)
          expect(contrast(luminance(over(grey, 0.82, c)), luminance(c))).toBeGreaterThanOrEqual(4.5)
        }
      })
    }
  }

  it('leaves the night sky exactly as it was', () => {
    expect(readable(SKY.night)).toEqual(SKY.night)
  })

  it('keeps the colour: sunrise stays warm', () => {
    const b = readable(SKY.dawn).bottom
    expect(b.r).toBeGreaterThan(b.b)
  })
})
