import { isValidLocalDate } from './is-local-date.validator';

describe('isValidLocalDate', () => {
  it('accepts strict YYYY-MM-DD calendar dates', () => {
    for (const d of ['2026-07-01', '2026-02-28', '2024-02-29', '2026-12-31']) {
      expect(isValidLocalDate(d)).toBe(true);
    }
  });

  it('rejects full ISO timestamps (the @IsDateString() footgun)', () => {
    expect(isValidLocalDate('2026-07-01T00:00:00.000Z')).toBe(false);
    expect(isValidLocalDate('2026-07-01T09:00')).toBe(false);
  });

  it('rejects impossible and malformed dates', () => {
    for (const bad of [
      '2026-13-01', // month 13
      '2026-00-10', // month 0
      '2026-02-30', // Feb 30
      '2025-02-29', // not a leap year
      '2026-7-1', // not zero-padded
      '26-07-01', // 2-digit year
      '2026/07/01', // wrong separator
      '',
      ' 2026-07-01',
    ]) {
      expect(isValidLocalDate(bad)).toBe(false);
    }
  });

  it('rejects non-string values', () => {
    expect(isValidLocalDate(null)).toBe(false);
    expect(isValidLocalDate(undefined)).toBe(false);
    expect(isValidLocalDate(20260701)).toBe(false);
  });
});
