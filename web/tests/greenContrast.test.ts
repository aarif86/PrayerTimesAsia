import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const lum = (c: number[]) => {
  const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

describe('white text on the green fill', () => {
  const css = readFileSync(new URL('../src/ui/app.css', import.meta.url), 'utf8')
  const m = /--green-solid:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(css)

  it('meets WCAG AA (4.5 to 1)', () => {
    expect(m).not.toBeNull()
    const ratio = 1.05 / (lum(m!.slice(1, 4).map(Number)) + 0.05)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('is used wherever white text sits on green', () => {
    const screens = readFileSync(new URL('../src/ui/screens.css', import.meta.url), 'utf8')
    expect(screens).not.toMatch(/var\(--green\)[^;]*;\s*color:\s*#fff/)
  })
})
