import { describe, it, expect } from 'vitest'
import { viewWindow, stepAnchor, rangeLabel } from '@/components/calendar/calendar-utils'

// 2026-08-13 is a Thursday - the exact case from the client review: a
// Monday-anchored week would have opened on Aug 10 and burned four of seven
// columns on days that can no longer be changed.
const THURSDAY = '2026-08-13'
const MONDAY = '2026-08-10'
const SUNDAY = '2026-08-16'

describe('viewWindow', () => {
  it('week starts ON the anchor, whatever weekday that is', () => {
    expect(viewWindow('week', THURSDAY)).toEqual({ from: THURSDAY, days: 7 })
    expect(viewWindow('week', MONDAY)).toEqual({ from: MONDAY, days: 7 })
    expect(viewWindow('week', SUNDAY)).toEqual({ from: SUNDAY, days: 7 })
  })

  it('week never reaches back before the anchor', () => {
    for (const d of ['2026-08-11', '2026-08-12', THURSDAY, '2026-08-14', SUNDAY]) {
      expect(viewWindow('week', d).from).toBe(d)
    }
  })

  it('day is the anchor alone', () => {
    expect(viewWindow('day', THURSDAY)).toEqual({ from: THURSDAY, days: 1 })
  })

  it('month is unchanged: six Mon-Sun weeks covering the anchor month', () => {
    // Aug 2026 starts on a Saturday, so the grid opens on Mon 27 Jul.
    expect(viewWindow('month', THURSDAY)).toEqual({ from: '2026-07-27', days: 42 })
    // Anchor day within the month must not move the grid.
    expect(viewWindow('month', '2026-08-01')).toEqual(viewWindow('month', '2026-08-31'))
  })
})

describe('stepAnchor', () => {
  it('week pages a whole week, so windows tile with no gap or overlap', () => {
    const next = stepAnchor('week', THURSDAY, 1)
    expect(next).toBe('2026-08-20')
    // The next window opens the day after this one ends (Aug 13 + 6 = Aug 19).
    expect(viewWindow('week', next).from).toBe('2026-08-20')
    expect(stepAnchor('week', THURSDAY, -1)).toBe('2026-08-06')
  })

  it('week paging keeps the first column on the same weekday', () => {
    expect(stepAnchor('week', stepAnchor('week', THURSDAY, 1), -1)).toBe(THURSDAY)
  })

  it('month still anchors on the 1st', () => {
    expect(stepAnchor('month', '2026-01-31', 1)).toBe('2026-02-01')
  })
})

describe('rangeLabel', () => {
  it('week names the rolling window, not the ISO week it falls in', () => {
    expect(rangeLabel('week', THURSDAY)).toBe('Aug 13 - 19, 2026')
  })

  it('week spells both months when the window crosses one', () => {
    expect(rangeLabel('week', '2026-08-30')).toBe('Aug 30 - Sep 5, 2026')
  })

  it('day and month labels are untouched', () => {
    expect(rangeLabel('day', THURSDAY)).toBe('Thu, 13 Aug 2026')
    expect(rangeLabel('month', THURSDAY)).toBe('August 2026')
  })
})
