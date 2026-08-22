import { isValidIanaTimeZone } from './is-iana-timezone.validator';

describe('isValidIanaTimeZone', () => {
  it('accepts every launch-destination IANA zone', () => {
    for (const tz of [
      'America/Curacao',
      'America/Aruba',
      'America/Lower_Princes',
      'America/St_Lucia',
      'America/Nassau',
      'UTC',
    ]) {
      expect(isValidIanaTimeZone(tz)).toBe(true);
    }
  });

  it('rejects offset labels and human names', () => {
    for (const bad of [
      '+4',
      '-4',
      'UTC-4',
      'UTC+06:00',
      'AST',
      'Curacao',
      'Curaçao time',
    ]) {
      expect(isValidIanaTimeZone(bad)).toBe(false);
    }
  });

  it('rejects empty, whitespace-padded, and non-string values', () => {
    expect(isValidIanaTimeZone('')).toBe(false);
    expect(isValidIanaTimeZone(' America/Curacao')).toBe(false);
    expect(isValidIanaTimeZone('America/Curacao ')).toBe(false);
    expect(isValidIanaTimeZone(null)).toBe(false);
    expect(isValidIanaTimeZone(undefined)).toBe(false);
    expect(isValidIanaTimeZone(4)).toBe(false);
  });
});
