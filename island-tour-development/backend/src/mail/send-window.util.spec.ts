/**
 * Unit tests for the lifecycle send window (plan §2.8): Tue–Thu 09:00–11:00
 * America/Curacao. Curaçao is FIXED UTC-4 with no DST — asserted below so an
 * ICU/tzdata change that broke that assumption fails here first, not in a
 * mis-timed operator email. All boundary instants are therefore written as
 * their exact UTC equivalents (09:00 local = 13:00Z).
 */
import { timeZoneOffsetMs } from '@/common/utils/timezone.util';
import {
  DEFAULT_LIFECYCLE_WINDOW,
  LIFECYCLE_WINDOW_TZ,
  isLifecycleWindowOpen,
  isMarketingMorningWindowOpen,
  nextLifecycleWindow,
  parseWindowWeekdays,
} from './send-window.util';

/** 2026-08-11 is a Tuesday. */
const TUE = '2026-08-11';
const WED = '2026-08-12';
const THU = '2026-08-13';
const FRI = '2026-08-14';
const MON = '2026-08-10';

/** A Curaçao wall-clock instant as the real UTC moment (fixed UTC-4). */
const curacao = (day: string, hhmm: string) =>
  new Date(`${day}T${hhmm}:00.000-04:00`);

describe('send-window.util', () => {
  it('Curaçao is fixed UTC-4 in both hemispheres of the year (no DST)', () => {
    const jan = timeZoneOffsetMs(
      LIFECYCLE_WINDOW_TZ,
      new Date('2026-01-15T12:00:00.000Z'),
    );
    const jul = timeZoneOffsetMs(
      LIFECYCLE_WINDOW_TZ,
      new Date('2026-07-15T12:00:00.000Z'),
    );
    expect(jan).toBe(-4 * 3_600_000);
    expect(jul).toBe(-4 * 3_600_000);
  });

  describe('isLifecycleWindowOpen', () => {
    it('boundary minutes: 08:59 closed · 09:00 open · 10:59 open · 11:00 closed', () => {
      expect(isLifecycleWindowOpen(curacao(TUE, '08:59'))).toBe(false);
      expect(isLifecycleWindowOpen(curacao(TUE, '09:00'))).toBe(true);
      expect(isLifecycleWindowOpen(curacao(TUE, '10:59'))).toBe(true);
      expect(isLifecycleWindowOpen(curacao(TUE, '11:00'))).toBe(false);
    });

    it('opens Tue, Wed and Thu only', () => {
      expect(isLifecycleWindowOpen(curacao(TUE, '10:00'))).toBe(true);
      expect(isLifecycleWindowOpen(curacao(WED, '10:00'))).toBe(true);
      expect(isLifecycleWindowOpen(curacao(THU, '10:00'))).toBe(true);
      expect(isLifecycleWindowOpen(curacao(MON, '10:00'))).toBe(false);
      expect(isLifecycleWindowOpen(curacao(FRI, '10:00'))).toBe(false);
      expect(isLifecycleWindowOpen(curacao('2026-08-15', '10:00'))).toBe(false); // Sat
      expect(isLifecycleWindowOpen(curacao('2026-08-16', '10:00'))).toBe(false); // Sun
    });

    it('is decided in Curaçao local time, not the server clock: 10:00 UTC on a Tuesday is 06:00 on the island - closed', () => {
      expect(isLifecycleWindowOpen(new Date(`${TUE}T10:00:00.000Z`))).toBe(
        false,
      );
      // 14:30 UTC = 10:30 local - open.
      expect(isLifecycleWindowOpen(new Date(`${TUE}T14:30:00.000Z`))).toBe(
        true,
      );
    });
  });

  describe('isMarketingMorningWindowOpen (WP-G, MK-1)', () => {
    it('shares the 09:00–11:00 boundary minutes with the lifecycle window', () => {
      expect(isMarketingMorningWindowOpen(curacao(TUE, '08:59'))).toBe(false);
      expect(isMarketingMorningWindowOpen(curacao(TUE, '09:00'))).toBe(true);
      expect(isMarketingMorningWindowOpen(curacao(TUE, '10:59'))).toBe(true);
      expect(isMarketingMorningWindowOpen(curacao(TUE, '11:00'))).toBe(false);
    });

    it('opens EVERY day - the 72h trigger must not slide across a weekend', () => {
      for (const day of [
        MON,
        TUE,
        WED,
        THU,
        FRI,
        '2026-08-15', // Sat
        '2026-08-16', // Sun
      ]) {
        expect(isMarketingMorningWindowOpen(curacao(day, '10:00'))).toBe(true);
      }
    });

    it('diverges from the lifecycle window exactly on the weekday rule', () => {
      // Monday 10:00 local: marketing open, lifecycle closed.
      expect(isMarketingMorningWindowOpen(curacao(MON, '10:00'))).toBe(true);
      expect(isLifecycleWindowOpen(curacao(MON, '10:00'))).toBe(false);
    });

    it('is decided in Curaçao local time, not the server clock', () => {
      // 10:00 UTC = 06:00 on the island - closed, any day.
      expect(
        isMarketingMorningWindowOpen(new Date(`${MON}T10:00:00.000Z`)),
      ).toBe(false);
      // 14:00 UTC = 10:00 on the island - open, even on a Sunday.
      expect(
        isMarketingMorningWindowOpen(new Date('2026-08-16T14:00:00.000Z')),
      ).toBe(true);
    });
  });

  describe('nextLifecycleWindow', () => {
    it('returns `now` itself while the window is open', () => {
      const now = curacao(WED, '09:30');
      expect(nextLifecycleWindow(now)).toEqual(now);
    });

    it('before the window on an open weekday -> the same day 09:00', () => {
      expect(nextLifecycleWindow(curacao(TUE, '07:15'))).toEqual(
        curacao(TUE, '09:00'),
      );
    });

    it('after the window on Tuesday -> Wednesday 09:00', () => {
      expect(nextLifecycleWindow(curacao(TUE, '11:00'))).toEqual(
        curacao(WED, '09:00'),
      );
    });

    it('Friday -> next Tuesday 09:00 (the weekend + Monday rollover)', () => {
      expect(nextLifecycleWindow(curacao(FRI, '10:00'))).toEqual(
        curacao('2026-08-18', '09:00'),
      );
    });

    it('Thursday after close -> next Tuesday 09:00', () => {
      expect(nextLifecycleWindow(curacao(THU, '15:00'))).toEqual(
        curacao('2026-08-18', '09:00'),
      );
    });

    it('Monday -> Tuesday 09:00', () => {
      expect(nextLifecycleWindow(curacao(MON, '12:00'))).toEqual(
        curacao(TUE, '09:00'),
      );
    });
  });

  // ── WP-H: dashboard-configured windows (H-03) ───────────────────────────────

  describe('config parameter (WP-H)', () => {
    it('parseWindowWeekdays maps csv day names to JS day numbers', () => {
      expect([...parseWindowWeekdays('tue,wed,thu')].sort()).toEqual([2, 3, 4]);
      expect([...parseWindowWeekdays(' MON , fri ')].sort()).toEqual([1, 5]);
      expect([...parseWindowWeekdays('sun')]).toEqual([0]);
    });

    it('parseWindowWeekdays never yields an empty set (falls back to built-in)', () => {
      // An empty window would silently stop every nudge forever — the DTO
      // rejects it upstream; this is the belt to that suspender.
      expect([...parseWindowWeekdays('')].sort()).toEqual([2, 3, 4]);
      expect([...parseWindowWeekdays('nonsense,junk')].sort()).toEqual([
        2, 3, 4,
      ]);
    });

    it('a configured weekday set opens days the default closes', () => {
      const cfg = {
        weekdays: parseWindowWeekdays('mon,fri'),
        startHour: 9,
        endHour: 11,
      };
      expect(isLifecycleWindowOpen(curacao(MON, '10:00'), cfg)).toBe(true);
      expect(isLifecycleWindowOpen(curacao(FRI, '10:00'), cfg)).toBe(true);
      expect(isLifecycleWindowOpen(curacao(TUE, '10:00'), cfg)).toBe(false);
    });

    it('configured hours move both boundaries (start inclusive, end exclusive)', () => {
      const cfg = {
        weekdays: parseWindowWeekdays('tue'),
        startHour: 14,
        endHour: 16,
      };
      expect(isLifecycleWindowOpen(curacao(TUE, '13:59'), cfg)).toBe(false);
      expect(isLifecycleWindowOpen(curacao(TUE, '14:00'), cfg)).toBe(true);
      expect(isLifecycleWindowOpen(curacao(TUE, '15:59'), cfg)).toBe(true);
      expect(isLifecycleWindowOpen(curacao(TUE, '16:00'), cfg)).toBe(false);
    });

    it('marketing window takes the hour pair only — any weekday', () => {
      const hours = { startHour: 14, endHour: 16 };
      expect(isMarketingMorningWindowOpen(curacao(MON, '15:00'), hours)).toBe(
        true,
      );
      expect(isMarketingMorningWindowOpen(curacao(MON, '10:00'), hours)).toBe(
        false,
      );
    });

    it('omitting the config is byte-identical to pre-WP-H behaviour', () => {
      expect(
        isLifecycleWindowOpen(curacao(TUE, '10:00'), DEFAULT_LIFECYCLE_WINDOW),
      ).toBe(isLifecycleWindowOpen(curacao(TUE, '10:00')));
    });

    it('nextLifecycleWindow honours a configured window', () => {
      const cfg = {
        weekdays: parseWindowWeekdays('fri'),
        startHour: 14,
        endHour: 16,
      };
      expect(nextLifecycleWindow(curacao(TUE, '10:00'), cfg)).toEqual(
        curacao(FRI, '14:00'),
      );
    });
  });
});
