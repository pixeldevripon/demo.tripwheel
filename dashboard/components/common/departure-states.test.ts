import { describe, it, expect } from 'vitest'
import {
  DEPARTURE_CHIP_CLASS,
  DEPARTURE_STATE_LABEL,
  departureState,
  unitNoun,
} from '@/components/common/departure-states'

describe('departureState (MCK-16 change 9 - the shared vocabulary)', () => {
  it('cancelled is its own state, never folded into departed or closed', () => {
    expect(departureState({ status: 'CANCELLED' })).toBe('cancelled')
    expect(departureState({ status: 'CANCELLED', cutoffPassed: true })).toBe('cancelled')
  })

  it('a stop-sold departure is closed; a bare CLOSED past cutoff just departed', () => {
    expect(departureState({ status: 'CLOSED', hasClosure: true })).toBe('closed')
    expect(
      departureState({ status: 'CLOSED', hasClosure: true, cutoffPassed: true }),
    ).toBe('closed')
    expect(departureState({ status: 'CLOSED', cutoffPassed: true })).toBe('past')
    expect(departureState({ status: 'CLOSED' })).toBe('closed')
  })

  it('open follows the cutoff', () => {
    expect(departureState({ status: 'OPEN' })).toBe('open')
    expect(departureState({ status: 'OPEN', cutoffPassed: true })).toBe('past')
    expect(departureState({ status: 'SOLD_OUT' })).toBe('soldOut')
  })

  it('a routine closure never wears red - red is reserved for cancellation', () => {
    expect(DEPARTURE_CHIP_CLASS.closed).not.toMatch(/danger|destructive/)
    expect(DEPARTURE_CHIP_CLASS.cancelled).toMatch(/danger/)
    // The decided colours: teal open, violet sold out, struck closed.
    expect(DEPARTURE_CHIP_CLASS.open).toMatch(/cal-open/)
    expect(DEPARTURE_CHIP_CLASS.soldOut).toMatch(/cal-sold/)
    expect(DEPARTURE_CHIP_CLASS.closed).toMatch(/line-through/)
  })

  it('labels: plain "Closed" (no "by you"), departed and cancelled distinct', () => {
    expect(DEPARTURE_STATE_LABEL.closed).toBe('Closed')
    expect(DEPARTURE_STATE_LABEL.past).toBe('Departed')
    expect(DEPARTURE_STATE_LABEL.cancelled).toBe('Cancelled')
  })
})

describe('unitNoun (MCK-16 change 11)', () => {
  it('names what one booking takes whole, with a safe fallback', () => {
    expect(unitNoun('BOAT')).toBe('boat')
    expect(unitNoun('VEHICLE')).toBe('vehicle')
    expect(unitNoun('AIRCRAFT')).toBe('aircraft')
    expect(unitNoun('GROUP')).toBe('group')
    expect(unitNoun('PACKAGE')).toBe('package')
    expect(unitNoun(null)).toBe('unit')
    expect(unitNoun(undefined)).toBe('unit')
  })
})
