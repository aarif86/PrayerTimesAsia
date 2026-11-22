import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseTile, tilesAround } from '../src/services/masjidList'

describe('ready-made masjid list on the web', () => {
  it('finds the one-degree squares around Pasir Ris', () => {
    expect(tilesAround({ latitude: 1.37, longitude: 103.95 })).toEqual(['1_103', '1_104'])
  })
  it('finds four squares near a corner and wraps at 180 degrees', () => {
    expect(tilesAround({ latitude: -0.01, longitude: 179.99 }).sort()).toEqual(['-1_-180', '-1_179', '0_-180', '0_179'])
  })
  it('reads a square file the same way the phone apps do', () => {
    const p = parseTile({ places: [['n1', 1.3, 103.9, 'Masjid Al-Istighfar', 'Pasir Ris', 0], ['n2', 1.31, 103.91, '', '', 1], ['bad']] })
    expect(p).toHaveLength(2)
    expect(p![0]).toMatchObject({ id: 'n1', name: 'Masjid Al-Istighfar', isMusollah: false })
    expect(p![1]).toMatchObject({ name: 'Prayer room', isMusollah: true })
    expect(parseTile({})).toBeNull()
  })

  it('loads the curated Singapore prayer rooms from the published square', () => {
    // Copy of the Singapore part of square 1_103 on the masjids branch (built 21 Nov 2026).
    const rows = JSON.parse(readFileSync(new URL('./fixtures/sg-tile.json', import.meta.url), 'utf8')) as { places: unknown[] }
    const places = parseTile(rows)!
    const curated = places.filter((p) => p.id.startsWith('m') && p.isMusollah)
    expect(curated.length).toBeGreaterThanOrEqual(100)
    expect(places.filter((p) => p.isMusollah).length).toBeGreaterThanOrEqual(140)
  })
})
