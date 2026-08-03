import { describe, it, expect } from 'vitest'
import { numOrNull, numOrUndef, strOrNull, findEnglish } from '@/lib/trips/forms'

describe('numOrNull (code-review M13, behaviour preserved)', () => {
  it('empty/whitespace/undefined → null', () => {
    expect(numOrNull(undefined)).toBeNull()
    expect(numOrNull('')).toBeNull()
    expect(numOrNull('   ')).toBeNull()
  })
  it('numeric string → number, preserving 0', () => {
    expect(numOrNull('0')).toBe(0)
    expect(numOrNull('12.5')).toBe(12.5)
    expect(numOrNull('-3')).toBe(-3)
  })
  it('non-numeric → NaN (unchanged legacy behaviour)', () => {
    expect(Number.isNaN(numOrNull('abc') as number)).toBe(true)
  })
})

describe('numOrUndef', () => {
  it('empty → undefined, numeric → number', () => {
    expect(numOrUndef('')).toBeUndefined()
    expect(numOrUndef(undefined)).toBeUndefined()
    expect(numOrUndef('7')).toBe(7)
  })
})

describe('strOrNull', () => {
  it('empty/whitespace/undefined → null', () => {
    expect(strOrNull('')).toBeNull()
    expect(strOrNull('  ')).toBeNull()
    expect(strOrNull(undefined)).toBeNull()
  })
  it('non-empty → the value as-is (untrimmed)', () => {
    expect(strOrNull('hi')).toBe('hi')
    expect(strOrNull('  padded  ')).toBe('  padded  ')
  })
})

describe('findEnglish (code-review M5)', () => {
  it('returns the en row', () => {
    const rows = [{ locale: 'nl', title: 'NL' }, { locale: 'en', title: 'EN' }]
    expect(findEnglish(rows)?.title).toBe('EN')
  })
  it('undefined when no en row / empty / nullish', () => {
    expect(findEnglish([{ locale: 'nl' }])).toBeUndefined()
    expect(findEnglish([])).toBeUndefined()
    expect(findEnglish(undefined)).toBeUndefined()
    expect(findEnglish(null)).toBeUndefined()
  })
})
