import { describe, it, expect, vi, afterEach } from 'vitest'
import { deriveTourBadge } from '@/lib/tours/derive-badge'

describe('deriveTourBadge', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null for a plain organic tour with no signals', () => {
    expect(deriveTourBadge({})).toBeNull()
  })

  it('prioritizes likelyToSellOut above everything (override true)', () => {
    expect(
      deriveTourBadge({
        likelyToSellOutOverride: true,
        aggregateReviewCount: 50,
        aggregateRating: 5,
        isSponsored: true,
      }),
    ).toBe('likelyToSellOut')
  })

  it('override=false suppresses the base likelyToSellOut signal and falls through to null', () => {
    expect(
      deriveTourBadge({ likelyToSellOut: true, likelyToSellOutOverride: false }),
    ).toBeNull()
  })

  it('mostPopular requires >=10 reviews AND rating >=4.5', () => {
    expect(deriveTourBadge({ aggregateReviewCount: 10, aggregateRating: 4.5 })).toBe('mostPopular')
    expect(deriveTourBadge({ aggregateReviewCount: 9, aggregateRating: 5 })).not.toBe('mostPopular')
    expect(deriveTourBadge({ aggregateReviewCount: 20, aggregateRating: 4.4 })).not.toBe('mostPopular')
  })

  it("'new' only within 30d of publish AND zero reviews", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-02T00:00:00Z'))
    expect(deriveTourBadge({ aggregateReviewCount: 0, publishedAt: '2026-07-20T00:00:00Z' })).toBe('new')
    // outside window -> not new
    expect(deriveTourBadge({ aggregateReviewCount: 0, publishedAt: '2026-06-01T00:00:00Z' })).toBeNull()
    // has reviews -> not new even if recent
    expect(deriveTourBadge({ aggregateReviewCount: 1, publishedAt: '2026-07-30T00:00:00Z' })).toBeNull()
  })

  it("invalid publishedAt does not throw and is not 'new'", () => {
    expect(deriveTourBadge({ aggregateReviewCount: 0, publishedAt: 'not-a-date' })).toBeNull()
  })

  it("'sponsored' is the fallback for a paid tier (rank <= 3) or explicit sponsor flag", () => {
    expect(deriveTourBadge({ tierRank: 1 })).toBe('sponsored')
    expect(deriveTourBadge({ tierRank: 3 })).toBe('sponsored')
    expect(deriveTourBadge({ tierRank: 4 })).toBeNull()
    expect(deriveTourBadge({ isSponsored: true })).toBe('sponsored')
  })
})
