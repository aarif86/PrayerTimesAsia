import { describe, expect, it } from 'vitest'
import { METHODS } from '../src/core/methods'
import { awayFromMethodCountry, methodCountry, timeKind } from '../src/core/timeKind'

describe('time kind', () => {
  it('names the three plain kinds and the masjid one', () => {
    expect(timeKind('A', true, METHODS.muis)).toBe('published')
    expect(timeKind('A', false, METHODS.ummalqura)).toBe('formula')
    expect(timeKind('D', false, METHODS.jakim)).toBe('formula')
    expect(timeKind('D', false, METHODS.mwl)).toBe('calculated')
    expect(timeKind('B', false, METHODS.mwl)).toBe('masjid')
  })
  it('knows which country a method belongs to', () => {
    expect(methodCountry(METHODS.jakim)?.code).toBe('MY')
    expect(methodCountry(METHODS.muis)?.code).toBe('SG')
    expect(methodCountry(METHODS.mwl)).toBeNull()
  })
  it('only warns for a pinned method used in another country', () => {
    expect(awayFromMethodCountry(true, METHODS.jakim, 'SG')?.code).toBe('MY')
    expect(awayFromMethodCountry(true, METHODS.jakim, 'MY')).toBeNull()
    expect(awayFromMethodCountry(false, METHODS.jakim, 'SG')).toBeNull()
    expect(awayFromMethodCountry(true, METHODS.mwl, 'SG')).toBeNull()
    expect(awayFromMethodCountry(true, METHODS.jakim, undefined)).toBeNull()
  })
})
