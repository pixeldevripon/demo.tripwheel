import { subtractBusinessDays } from './business-days.util';

/**
 * INT1R threshold math (checklist D-18). Curaçao is fixed UTC-4 with no DST,
 * so local wall-clock = UTC-4h year-round; every expectation below is
 * written as an absolute UTC instant. 2026-08-11 is a Tuesday.
 */
describe('subtractBusinessDays', () => {
  // Tue 2026-08-11 15:00 local = 19:00Z.
  const tue = new Date('2026-08-11T19:00:00.000Z');

  it('walks plain weekdays one for one (Wed - 2bd = Mon)', () => {
    const wed = new Date('2026-08-12T19:00:00.000Z');
    expect(subtractBusinessDays(wed, 2).toISOString()).toBe(
      '2026-08-10T19:00:00.000Z', // Monday, same wall-clock time
    );
  });

  it('skips the weekend (Tue - 2bd = Fri, not Sun)', () => {
    expect(subtractBusinessDays(tue, 2).toISOString()).toBe(
      '2026-08-07T19:00:00.000Z', // Friday
    );
  });

  it('skips the weekend from Monday too (Mon - 2bd = Thu)', () => {
    const mon = new Date('2026-08-10T13:00:00.000Z'); // Mon 09:00 local
    expect(subtractBusinessDays(mon, 2).toISOString()).toBe(
      '2026-08-06T13:00:00.000Z', // Thursday 09:00 local
    );
  });

  it('a weekend "now" contributes nothing itself (Sun - 2bd = Thu)', () => {
    const sun = new Date('2026-08-09T16:00:00.000Z'); // Sun 12:00 local
    expect(subtractBusinessDays(sun, 2).toISOString()).toBe(
      '2026-08-06T16:00:00.000Z', // Thursday 12:00 local
    );
  });

  it('preserves the wall-clock time of day across the walk', () => {
    const result = subtractBusinessDays(
      new Date('2026-08-11T12:34:56.000Z'),
      1,
    );
    expect(result.toISOString()).toBe('2026-08-10T12:34:56.000Z');
  });

  it('resolves the day boundary in Curaçao local time, not UTC', () => {
    // 02:00Z Tuesday is still MONDAY 22:00 in Curaçao - one business day
    // back must land on Friday 22:00 local (Sat 02:00Z), not Sunday.
    const lateMondayLocal = new Date('2026-08-11T02:00:00.000Z');
    expect(subtractBusinessDays(lateMondayLocal, 1).toISOString()).toBe(
      '2026-08-08T02:00:00.000Z', // Fri 22:00 local
    );
  });

  it('the sweep equivalence holds: created-at ≤ cutoff ⟺ 2 business days elapsed', () => {
    // Created Thursday 14:00 local; due exactly from Monday 14:00 local on.
    const createdAt = new Date('2026-08-06T18:00:00.000Z');
    const justBefore = new Date('2026-08-10T17:59:00.000Z'); // Mon 13:59 local
    const justAfter = new Date('2026-08-10T18:01:00.000Z'); // Mon 14:01 local
    expect(subtractBusinessDays(justBefore, 2).getTime()).toBeLessThan(
      createdAt.getTime(),
    );
    expect(subtractBusinessDays(justAfter, 2).getTime()).toBeGreaterThan(
      createdAt.getTime(),
    );
  });
});
