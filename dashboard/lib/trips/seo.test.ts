import { describe, it, expect } from 'vitest'
import { truncateMeta } from '@/lib/trips/seo'

describe('truncateMeta (code-review M11)', () => {
  it('returns text unchanged when within max', () => {
    expect(truncateMeta('short', 70)).toBe('short')
    expect(truncateMeta('exactly-ten', 11)).toBe('exactly-ten')
  })

  it('NEVER exceeds max, even with no word boundary (the M11 bug)', () => {
    // A single long token with no spaces: the old impl produced max+2 chars.
    const oneLongWord = 'x'.repeat(200)
    const out = truncateMeta(oneLongWord, 70)
    expect(out.length).toBeLessThanOrEqual(70)
    expect(out.endsWith('...')).toBe(true)
  })

  it('stays within max across a range of limits and inputs', () => {
    const inputs = ['a'.repeat(300), 'word '.repeat(60), 'The quick brown fox '.repeat(20)]
    for (const max of [10, 20, 55, 70, 170]) {
      for (const text of inputs) {
        expect(truncateMeta(text, max).length).toBeLessThanOrEqual(max)
      }
    }
  })

  it('cuts at a word boundary when a good one exists', () => {
    const out = truncateMeta('Sunset catamaran cruise along the coast', 20)
    expect(out.length).toBeLessThanOrEqual(20)
    expect(out.endsWith('...')).toBe(true)
    expect(out).not.toMatch(/\s\.\.\.$/) // no trailing space before ellipsis
  })

  it('handles tiny max without throwing', () => {
    expect(() => truncateMeta('anything at all', 1)).not.toThrow()
    expect(truncateMeta('anything at all', 1).length).toBeLessThanOrEqual(1 + 3)
  })
})
