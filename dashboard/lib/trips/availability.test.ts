import { describe, it, expect } from 'vitest'
import {
  AGENDA_HORIZON_DAYS,
  AGENDA_WINDOW_DAYS,
  shiftDateKey,
  stepAgendaWeek,
} from '@/lib/trips/availability'

const TODAY = '2026-10-16' // a Friday - the client's screenshot week

describe('shiftDateKey', () => {
  it('steps whole days without drifting off the local calendar', () => {
    expect(shiftDateKey(TODAY, 6)).toBe('2026-10-22')
    expect(shiftDateKey(TODAY, -6)).toBe('2026-10-10')
    expect(shiftDateKey(TODAY, 0)).toBe(TODAY)
  })

  it('crosses month and year ends', () => {
    expect(shiftDateKey('2026-10-31', 1)).toBe('2026-11-01')
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDateKey('2028-02-28', 1)).toBe('2028-02-29') // leap year
  })
})

describe('stepAgendaWeek', () => {
  it('steps a whole week forward and back', () => {
    expect(stepAgendaWeek(TODAY, 1, TODAY)).toBe('2026-10-23')
    expect(stepAgendaWeek('2026-10-30', -1, TODAY)).toBe('2026-10-23')
  })

  it('windows tile: the next one opens the day after this one ends', () => {
    const next = stepAgendaWeek(TODAY, 1, TODAY)
    expect(next).toBe(shiftDateKey(TODAY, AGENDA_WINDOW_DAYS))
    // This window covers TODAY..TODAY+6, so the next starts on TODAY+7.
    expect(shiftDateKey(TODAY, AGENDA_WINDOW_DAYS - 1)).toBe('2026-10-22')
  })

  it('clamps back to today rather than dead-ending short of it', () => {
    // From three days out, Back reaches today - not today-4, which the date
    // picker refuses anyway.
    expect(stepAgendaWeek('2026-10-19', -1, TODAY)).toBe(TODAY)
    expect(stepAgendaWeek(TODAY, -1, TODAY)).toBe(TODAY)
  })

  it('clamps forward to the picker horizon (today+364)', () => {
    const ceiling = shiftDateKey(TODAY, AGENDA_HORIZON_DAYS)
    expect(stepAgendaWeek(ceiling, 1, TODAY)).toBe(ceiling)
    expect(stepAgendaWeek(shiftDateKey(TODAY, 360), 1, TODAY)).toBe(ceiling)
  })

  it('is reversible in the middle of the range', () => {
    const there = stepAgendaWeek('2026-11-20', 1, TODAY)
    expect(stepAgendaWeek(there, -1, TODAY)).toBe('2026-11-20')
  })
})
