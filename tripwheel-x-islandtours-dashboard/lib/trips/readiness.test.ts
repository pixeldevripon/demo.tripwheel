import { describe, it, expect } from 'vitest'
import { getPublishChecks, getListingChecks } from '@/lib/trips/readiness'
import type { TripListItem } from '@/types/trip'

type PublishTrip = Parameters<typeof getPublishChecks>[0]

// Prices are `string | null` and heroImage is a `TripHeroImage | null` on TripListItem.
const heroImage = { id: 'h1', url: 'hero.jpg', altText: null }

const passingNonUnit: PublishTrip = {
  imageCount: 5,
  highlightCount: 3,
  heroImage,
  priceFrom: '120',
  basePrice: null,
  pricingModel: 'PER_PERSON',
  wholeUnitType: null,
}

const passed = (checks: ReturnType<typeof getPublishChecks>, key: string) =>
  checks.find((c) => c.key === key)!.passed

describe('getPublishChecks', () => {
  it('all green for a complete non-unit tour with an English overview', () => {
    const checks = getPublishChecks(passingNonUnit, true)
    expect(checks.every((c) => c.passed)).toBe(true)
  })

  it('images check needs >= 5', () => {
    expect(passed(getPublishChecks({ ...passingNonUnit, imageCount: 4 }, true), 'images')).toBe(false)
    expect(passed(getPublishChecks({ ...passingNonUnit, imageCount: 5 }, true), 'images')).toBe(true)
  })

  it('highlights check needs >= 3', () => {
    expect(passed(getPublishChecks({ ...passingNonUnit, highlightCount: 2 }, true), 'highlights')).toBe(false)
  })

  it('hero check needs a hero image', () => {
    expect(passed(getPublishChecks({ ...passingNonUnit, heroImage: null }, true), 'hero')).toBe(false)
  })

  it('overview check reflects the hasEnOverview arg', () => {
    expect(passed(getPublishChecks(passingNonUnit, false), 'overview')).toBe(false)
    expect(passed(getPublishChecks(passingNonUnit, true), 'overview')).toBe(true)
  })

  it('non-unit price passes on EITHER priceFrom or basePrice', () => {
    expect(passed(getPublishChecks({ ...passingNonUnit, priceFrom: null, basePrice: '90' }, true), 'price')).toBe(true)
    expect(passed(getPublishChecks({ ...passingNonUnit, priceFrom: null, basePrice: null }, true), 'price')).toBe(false)
  })

  it('UNIT price requires BOTH basePrice and wholeUnitType (strict-subset of backend)', () => {
    const unit: PublishTrip = { ...passingNonUnit, pricingModel: 'UNIT' }
    // priceFrom alone must NOT satisfy a unit tour (the drift bug the code guards against)
    expect(passed(getPublishChecks({ ...unit, priceFrom: '100', basePrice: null, wholeUnitType: null }, true), 'price')).toBe(false)
    expect(passed(getPublishChecks({ ...unit, basePrice: '100', wholeUnitType: null }, true), 'price')).toBe(false)
    expect(passed(getPublishChecks({ ...unit, basePrice: '100', wholeUnitType: 'BOAT' }, true), 'price')).toBe(true)
  })

  it('treats missing counts as 0 (sad path, no throw)', () => {
    const checks = getPublishChecks(
      { priceFrom: null, basePrice: null, heroImage: null, pricingModel: 'PER_PERSON', wholeUnitType: null },
      false,
    )
    expect(passed(checks, 'images')).toBe(false)
    expect(passed(checks, 'highlights')).toBe(false)
  })
})

describe('getListingChecks', () => {
  it('single bookable check reflects isBookable', () => {
    expect(getListingChecks({ isBookable: true } as TripListItem)[0].passed).toBe(true)
    expect(getListingChecks({ isBookable: false } as TripListItem)[0].passed).toBe(false)
  })
})
