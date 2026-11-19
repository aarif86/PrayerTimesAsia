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
    expect(p![1]).toMatchObject({ name: 'Musollah', isMusollah: true })
    expect(parseTile({})).toBeNull()
  })
})
