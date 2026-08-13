import { isOvernightCharter, OVERNIGHT_MIN_MINUTES } from './overnight';

/**
 * The classification's whole point is the two blind spots the inputs cover for
 * each other: the flag decides the <16h sleep trips no threshold can, the
 * duration floor catches 16h+ charters whose operator forgot the flag. Start
 * time is deliberately not an input - a 6h night cruise is a day charter.
 */
describe('isOvernightCharter', () => {
  it('classifies a short day charter as day', () => {
    expect(
      isOvernightCharter({ sleepAboard: false, durationMinutesFrom: 480 }),
    ).toBe(false);
  });

  it('keeps a 6h night cruise (20:00-02:00) a day charter - crossing midnight is not sleeping aboard', () => {
    expect(
      isOvernightCharter({ sleepAboard: false, durationMinutesFrom: 360 }),
    ).toBe(false);
  });

  it('keeps a 14h dawn-to-dusk marathon a day charter when guests do not sleep aboard', () => {
    expect(
      isOvernightCharter({ sleepAboard: false, durationMinutesFrom: 840 }),
    ).toBe(false);
  });

  it('classifies a 14h sunset-to-sunrise trip as overnight via the operator flag', () => {
    expect(
      isOvernightCharter({ sleepAboard: true, durationMinutesFrom: 840 }),
    ).toBe(true);
  });

  it('classifies 16h+ as overnight even when the operator forgot the flag', () => {
    expect(
      isOvernightCharter({
        sleepAboard: false,
        durationMinutesFrom: OVERNIGHT_MIN_MINUTES,
      }),
    ).toBe(true);
    expect(
      isOvernightCharter({ sleepAboard: false, durationMinutesFrom: 2880 }),
    ).toBe(true);
  });

  it('stops one minute short of the duration floor', () => {
    expect(
      isOvernightCharter({
        sleepAboard: false,
        durationMinutesFrom: OVERNIGHT_MIN_MINUTES - 1,
      }),
    ).toBe(false);
  });

  it('trusts the flag when duration is missing, and defaults to day when it is null', () => {
    expect(
      isOvernightCharter({ sleepAboard: true, durationMinutesFrom: null }),
    ).toBe(true);
    expect(
      isOvernightCharter({ sleepAboard: false, durationMinutesFrom: null }),
    ).toBe(false);
  });
});
