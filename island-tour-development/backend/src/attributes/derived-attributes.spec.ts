import { OVERNIGHT_MIN_MINUTES } from '@/tours/overnight';

import {
  buildDerivedAttributeWhere,
  deriveTourAttributeMap,
  type DerivedAttributeTour,
} from './derived-attributes';

/**
 * `sleep_aboard` surfaces the overnight VERDICT (flag OR >=16h), never the raw
 * column: the dashboard hides the toggle above the 16h auto-line, so a
 * multi-day charter's filter/chip must not depend on the operator having
 * touched it.
 */
describe('sleep_aboard derived attribute', () => {
  const tour = (over: Partial<DerivedAttributeTour>): DerivedAttributeTour => ({
    cancellationHours: 48,
    durationMinutesFrom: 480,
    sleepAboard: false,
    pickupModel: 'NONE',
    instantConfirmation: true,
    bookingType: null,
    minAgeYears: null,
    maxPartySize: 10,
    departureCity: null,
    wheelchairAccessible: true,
    familyFriendly: false,
    suitableForBeginners: false,
    languages: [],
    ...over,
  });

  it('is true for a multi-day charter even when the operator never set the flag', () => {
    expect(
      deriveTourAttributeMap(
        tour({ durationMinutesFrom: 2880, sleepAboard: false }),
      ).get('sleep_aboard'),
    ).toBe('true');
  });

  it('is true for a short sleep trip via the flag alone', () => {
    expect(
      deriveTourAttributeMap(
        tour({ durationMinutesFrom: 840, sleepAboard: true }),
      ).get('sleep_aboard'),
    ).toBe('true');
  });

  it('is false for a plain day charter', () => {
    expect(
      deriveTourAttributeMap(
        tour({ durationMinutesFrom: 480, sleepAboard: false }),
      ).get('sleep_aboard'),
    ).toBe('false');
  });

  it('filters true as flag OR duration floor', () => {
    expect(buildDerivedAttributeWhere('sleep_aboard', ['true'])).toEqual({
      OR: [
        { sleepAboard: true },
        { durationMinutesFrom: { gte: OVERNIGHT_MIN_MINUTES } },
      ],
    });
  });

  it('filters false as neither flag nor duration floor', () => {
    expect(buildDerivedAttributeWhere('sleep_aboard', ['false'])).toEqual({
      sleepAboard: false,
      OR: [
        { durationMinutesFrom: null },
        { durationMinutesFrom: { lt: OVERNIGHT_MIN_MINUTES } },
      ],
    });
  });

  it('yields no constraint when both or neither value is requested', () => {
    expect(
      buildDerivedAttributeWhere('sleep_aboard', ['true', 'false']),
    ).toBeNull();
    expect(buildDerivedAttributeWhere('sleep_aboard', [])).toBeNull();
  });
});
