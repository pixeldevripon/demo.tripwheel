import { describe, it, expect } from 'vitest'
import {
  blankToNull,
  numberOrNull,
  tripToUpdatePayload,
} from '@/lib/trips/update-payload'
import type { TripListItem } from '@/types/trip'

describe('blankToNull', () => {
  it('maps nullish to null', () => {
    expect(blankToNull(null)).toBeNull()
    expect(blankToNull(undefined)).toBeNull()
  })

  it('maps empty / whitespace-only strings to null (the "operator cleared it" case)', () => {
    expect(blankToNull('')).toBeNull()
    expect(blankToNull('   ')).toBeNull()
    expect(blankToNull('\t\n')).toBeNull()
  })

  it('trims and preserves non-empty strings', () => {
    expect(blankToNull('  hello  ')).toBe('hello')
  })

  it('accepts a number even though the field is typed as string (zod-coerced runtime value)', () => {
    // Documented contract: a numeric 0 stringifies to "0", which is NOT blank.
    expect(blankToNull(0)).toBe('0')
    expect(blankToNull(42)).toBe('42')
  })
})

describe('numberOrNull', () => {
  it('maps nullish and blank to null', () => {
    expect(numberOrNull(null)).toBeNull()
    expect(numberOrNull(undefined)).toBeNull()
    expect(numberOrNull('')).toBeNull()
    expect(numberOrNull('   ')).toBeNull()
  })

  it('parses numeric strings, preserving 0', () => {
    expect(numberOrNull('0')).toBe(0)
    expect(numberOrNull(' 12.5 ')).toBe(12.5)
    expect(numberOrNull('-3')).toBe(-3)
  })

  it('rejects non-numeric strings (sad path)', () => {
    expect(numberOrNull('abc')).toBeNull()
    expect(numberOrNull('12px')).toBeNull()
  })

  it('accepts a real number and rejects non-finite numbers', () => {
    expect(numberOrNull(7)).toBe(7)
    expect(numberOrNull(0)).toBe(0)
    expect(numberOrNull(Infinity)).toBeNull()
    expect(numberOrNull(-Infinity)).toBeNull()
    expect(numberOrNull(NaN)).toBeNull()
  })
})

describe('tripToUpdatePayload', () => {
  const base = {
    name: 'Sunset Sail',
    slug: 'sunset-sail',
    categoryIds: ['cat-a', 'cat-b'],
    primaryCategoryId: null,
    hubIds: [],
    pickupModel: 'NONE',
    pickupRequired: false,
    paymentModel: 'OPERATOR_LINK',
    onArrivalPayment: false,
    instantConfirmation: true,
    minPartySize: 1,
    maxPartySize: 10,
    bookingCutoffMinutes: 120,
    cancellationHours: 48,
    weatherDependent: false,
    wheelchairAccessible: false,
    familyFriendly: true,
    suitableForBeginners: true,
    reference: undefined,
    h1Override: undefined,
    breadcrumbLabel: undefined,
    availabilityType: 'START_TIME',
    redemptionMethod: 'MANIFEST',
    instantDelivery: true,
    availabilityRequired: true,
    allowFreesale: false,
    deliveryFormats: [],
    deliveryMethods: [],
    isActive: true,
  } as unknown as TripListItem

  it('falls back primaryCategoryId to the first category when unset', () => {
    expect(tripToUpdatePayload(base).primaryCategoryId).toBe('cat-a')
  })

  it('keeps an explicit primaryCategoryId', () => {
    const p = tripToUpdatePayload({ ...base, primaryCategoryId: 'cat-b' } as TripListItem)
    expect(p.primaryCategoryId).toBe('cat-b')
  })

  it('coerces cleared nullable strings to null (so the clear reaches the DB)', () => {
    const p = tripToUpdatePayload(base)
    expect(p.reference).toBeNull()
    expect(p.h1Override).toBeNull()
    expect(p.breadcrumbLabel).toBeNull()
  })

  it('passes maxPartySize through unconditionally (NOT NULL column)', () => {
    expect(tripToUpdatePayload(base).maxPartySize).toBe(10)
  })
})
