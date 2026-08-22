import { describe, it, expect } from 'vitest'
import { countSummary, gateSummary, filledSummary } from '@/lib/trips/section-summary'

describe('countSummary', () => {
  it('says "Empty" for zero', () => {
    expect(countSummary(0, 'item')).toBe('Empty')
  })
  it('singular vs plural', () => {
    expect(countSummary(1, 'item')).toBe('1 item')
    expect(countSummary(4, 'item')).toBe('4 items')
  })
  it('honors an explicit plural noun', () => {
    expect(countSummary(3, 'entry', 'entries')).toBe('3 entries')
    expect(countSummary(1, 'entry', 'entries')).toBe('1 entry')
  })
})

describe('gateSummary', () => {
  it('shows "n of required" while under the gate', () => {
    expect(gateSummary(2, 3, 'highlight')).toBe('2 of 3')
    expect(gateSummary(0, 3, 'highlight')).toBe('0 of 3')
  })
  it('switches to a plain count once the gate is met or exceeded', () => {
    expect(gateSummary(3, 3, 'highlight')).toBe('3 highlights')
    expect(gateSummary(5, 3, 'highlight')).toBe('5 highlights')
  })
})

describe('filledSummary', () => {
  it('"Empty" when nothing is filled', () => {
    expect(filledSummary([null, undefined, '', '   '])).toBe('Empty')
  })
  it('"Set" when everything is filled', () => {
    expect(filledSummary(['a', 'b'])).toBe('Set')
  })
  it('partial ratio when some are filled', () => {
    expect(filledSummary(['a', '', 'c'])).toBe('2 of 3')
  })
  it('treats whitespace-only as empty', () => {
    expect(filledSummary(['  ', 'x'])).toBe('1 of 2')
  })
})
