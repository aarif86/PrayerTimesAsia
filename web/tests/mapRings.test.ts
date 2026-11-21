import { describe, expect, it } from 'vitest'
import { ringDistance, ringsFor } from '../src/core/mapRings'

describe('map rings follow the zoom', () => {
  it('matches iPhone and Android', () => {
    expect(ringsFor(2.25, 1.5)).toEqual([0.5, 1, 2])
    expect(ringsFor(8.25, 5.5)).toEqual([1, 2, 5])
    expect(ringsFor(30, 20)).toEqual([5, 10, 20])
    expect(ringsFor(0.3, 0.2)).toEqual([0.25, 0.5, 1])
    expect(ringDistance(0.5)).toBe('500 m')
    expect(ringDistance(2)).toBe('2 km')
  })
})
