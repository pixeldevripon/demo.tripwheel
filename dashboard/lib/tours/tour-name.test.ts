import { describe, it, expect } from 'vitest'
import {
  TITLE_MAX,
  TITLE_MIN,
  titleLengthState,
  tourH1Prefix,
  tourPageH1,
} from '@/lib/tours/tour-name'

describe('tourPageH1 (LD15)', () => {
  it('composes "{prefix}: {title}"', () => {
    expect(tourPageH1('Curacao', 'Sunset Catamaran Cruise')).toBe(
      'Curacao: Sunset Catamaran Cruise',
    )
  })

  it('renders the duplication the preview exists to catch', () => {
    // The client's own example: the island is already in the stored title, so
    // the render-time prefix says it twice.
    expect(
      tourPageH1('Klein Curacao', 'Full day jetski tour to Klein Curacao'),
    ).toBe('Klein Curacao: Full day jetski tour to Klein Curacao')
  })
})

describe('tourH1Prefix', () => {
  it('prefers the hub over the destination', () => {
    expect(tourH1Prefix('Klein Curacao', 'Curacao')).toBe('Klein Curacao')
  })

  it('falls back to the destination when there is no hub', () => {
    expect(tourH1Prefix(null, 'Curacao')).toBe('Curacao')
    expect(tourH1Prefix(undefined, 'Curacao')).toBe('Curacao')
  })

  it('is null when neither is known, so nothing renders', () => {
    expect(tourH1Prefix(null, null)).toBeNull()
    expect(tourH1Prefix(undefined, undefined)).toBeNull()
  })

  it('treats an empty name as absent rather than composing ": title"', () => {
    expect(tourH1Prefix('', 'Curacao')).toBe('Curacao')
    expect(tourH1Prefix('', '')).toBeNull()
  })
})

describe('titleLengthState', () => {
  const of = (n: number) => 'x'.repeat(n)

  it('is quiet on an empty field', () => {
    expect(titleLengthState('')).toBe('empty')
    expect(titleLengthState('   ')).toBe('empty')
  })

  it('marks the two ends of the agreed range', () => {
    expect(titleLengthState(of(TITLE_MIN - 1))).toBe('short')
    expect(titleLengthState(of(TITLE_MAX + 1))).toBe('long')
  })

  it('the boundaries themselves are in range', () => {
    expect(titleLengthState(of(TITLE_MIN))).toBe('ok')
    expect(titleLengthState(of(TITLE_MAX))).toBe('ok')
  })

  it('measures the trimmed title', () => {
    expect(titleLengthState(`  ${of(TITLE_MIN)}  `)).toBe('ok')
  })

  it('the agreed range is 35-60', () => {
    expect([TITLE_MIN, TITLE_MAX]).toEqual([35, 60])
  })
})
