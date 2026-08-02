import { describe, it, expect } from 'vitest'
import { tourPerfSummary } from '@/lib/tours/signals'

describe('tourPerfSummary', () => {
  it('shows rating + count when there are reviews', () => {
    const s = tourPerfSummary({
      aggregateRating: 4.8,
      aggregateReviewCount: 1738,
      bookingCount: 42,
      priceFrom: 120,
      defaultCurrency: 'USD',
    })
    expect(s).toContain('★ 4.8 (1,738)')
    expect(s).toContain('42 booked')
    expect(s).toContain('From')
  })

  it('shows "No reviews yet" when review count is 0 or missing', () => {
    expect(tourPerfSummary({ aggregateReviewCount: 0 })).toContain('No reviews yet')
    expect(tourPerfSummary({})).toContain('No reviews yet')
  })

  it('defaults booked to 0', () => {
    expect(tourPerfSummary({})).toContain('0 booked')
  })

  it('falls back priceFrom -> basePrice and omits price when non-positive', () => {
    expect(tourPerfSummary({ priceFrom: null, basePrice: 99, defaultCurrency: 'EUR' })).toContain('From')
    const noPrice = tourPerfSummary({ priceFrom: 0, basePrice: 0 })
    expect(noPrice).not.toContain('From')
  })

  it('accepts string prices and ignores non-numeric ones (sad path)', () => {
    expect(tourPerfSummary({ priceFrom: '150', defaultCurrency: 'USD' })).toContain('From')
    expect(tourPerfSummary({ priceFrom: 'abc' })).not.toContain('From')
  })

  it('falls back to EUR when currency is unknown/invalid', () => {
    // Should not throw and should still render a price line.
    expect(tourPerfSummary({ priceFrom: 50, defaultCurrency: 'XYZ' })).toContain('From')
    expect(tourPerfSummary({ priceFrom: 50, defaultCurrency: null })).toContain('From')
  })
})
