import {
  dateKey,
  localNow,
  localWallTime,
  parseHhMm,
  timeZoneOffsetMs,
} from './timezone.util';

describe('timezone.util (local-time model)', () => {
  describe('localWallTime', () => {
    it('stores the wall-clock verbatim as a Z-labelled instant', () => {
      expect(localWallTime(2026, 7, 1, 9, 0).toISOString()).toBe(
        '2026-07-01T09:00:00.000Z',
      );
      expect(localWallTime(2026, 12, 31).toISOString()).toBe(
        '2026-12-31T00:00:00.000Z',
      );
    });
  });

  describe('timeZoneOffsetMs', () => {
    it('is -4h for AST (Curaçao has no DST)', () => {
      const instant = new Date('2026-07-01T12:00:00.000Z');
      expect(timeZoneOffsetMs('America/Curacao', instant)).toBe(-4 * 3_600_000);
    });
    it('is 0 for UTC', () => {
      expect(timeZoneOffsetMs('UTC', new Date('2026-07-01T00:00:00Z'))).toBe(0);
    });
  });

  describe('localNow', () => {
    it('shifts a UTC instant into the destination wall-clock', () => {
      // 13:00 UTC == 09:00 in AST
      const now = localNow(
        'America/Curacao',
        new Date('2026-07-01T13:00:00.000Z'),
      );
      expect(now.toISOString()).toBe('2026-07-01T09:00:00.000Z');
    });
  });

  describe('parseHhMm', () => {
    it('parses valid times', () => {
      expect(parseHhMm('09:30')).toEqual({ hour: 9, minute: 30 });
      expect(parseHhMm('23:59')).toEqual({ hour: 23, minute: 59 });
    });
    it('throws on malformed/out-of-range input', () => {
      expect(() => parseHhMm('9:30')).toThrow();
      expect(() => parseHhMm('24:00')).toThrow();
      expect(() => parseHhMm('garbage')).toThrow();
    });
  });

  describe('dateKey', () => {
    it('returns the YYYY-MM-DD prefix', () => {
      expect(dateKey(new Date('2026-07-04T09:00:00.000Z'))).toBe('2026-07-04');
    });
  });
});
