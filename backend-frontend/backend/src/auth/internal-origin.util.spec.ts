import type { ExecutionContext } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { THROTTLER_LIMIT } from '@nestjs/throttler/dist/throttler.constants';
import {
  hasOwnThrottleOverride,
  INTERNAL_API_KEY_HEADER,
  isTrustedInternalHeaders,
  isTrustedInternalOrigin,
  THROTTLER_LIMIT_METADATA_PREFIX,
} from './internal-origin.util';

/** Minimal ExecutionContext double - only the bits these helpers touch. */
function ctxFor(
  headers: Record<string, string | string[] | undefined>,
  handler: object = () => undefined,
  cls: object = class {},
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    getHandler: () => handler,
    getClass: () => cls,
  } as unknown as ExecutionContext;
}

describe('internal-origin.util', () => {
  const ORIGINAL = process.env.INTERNAL_API_SECRET;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.INTERNAL_API_SECRET;
    else process.env.INTERNAL_API_SECRET = ORIGINAL;
  });

  describe('THROTTLER_LIMIT_METADATA_PREFIX', () => {
    // The bypass scoping is built on this prefix. If @nestjs/throttler ever
    // renames it, `hasOwnThrottleOverride` would silently stop matching and the
    // bypass would widen back to EVERY route - including the mail-senders and
    // credential paths. Fail here instead.
    it('still matches the library constant', () => {
      expect(THROTTLER_LIMIT_METADATA_PREFIX).toBe(THROTTLER_LIMIT);
    });
  });

  describe('isTrustedInternalHeaders', () => {
    it('is false when no secret is configured, even if a header is sent', () => {
      delete process.env.INTERNAL_API_SECRET;
      expect(
        isTrustedInternalHeaders({ [INTERNAL_API_KEY_HEADER]: 'anything' }),
      ).toBe(false);
    });

    it('is false without the header', () => {
      process.env.INTERNAL_API_SECRET = 's3cret-value';
      expect(isTrustedInternalHeaders({})).toBe(false);
    });

    it('is false on a wrong secret', () => {
      process.env.INTERNAL_API_SECRET = 's3cret-value';
      expect(
        isTrustedInternalHeaders({ [INTERNAL_API_KEY_HEADER]: 'nope' }),
      ).toBe(false);
    });

    it('is true on an exact match', () => {
      process.env.INTERNAL_API_SECRET = 's3cret-value';
      expect(
        isTrustedInternalHeaders({
          [INTERNAL_API_KEY_HEADER]: 's3cret-value',
        }),
      ).toBe(true);
    });

    it('ignores an array-valued header (never a legitimate shape here)', () => {
      process.env.INTERNAL_API_SECRET = 's3cret-value';
      expect(
        isTrustedInternalHeaders({
          [INTERNAL_API_KEY_HEADER]: ['s3cret-value'],
        }),
      ).toBe(false);
    });
  });

  describe('hasOwnThrottleOverride', () => {
    class Plain {
      plain(): void {}

      @Throttle({ short: { limit: 3, ttl: 10_000 } })
      tightened(): void {}
    }

    @Throttle({ medium: { limit: 5, ttl: 60_000 } })
    class TightenedController {
      inherited(): void {}
    }

    it('is false for a handler with no @Throttle', () => {
      const proto = Plain.prototype as unknown as Record<string, object>;
      expect(hasOwnThrottleOverride(ctxFor({}, proto.plain, Plain))).toBe(
        false,
      );
    });

    it('is true for a handler carrying its own @Throttle', () => {
      const proto = Plain.prototype as unknown as Record<string, object>;
      expect(hasOwnThrottleOverride(ctxFor({}, proto.tightened, Plain))).toBe(
        true,
      );
    });

    it('is true when the CONTROLLER carries @Throttle', () => {
      const proto = TightenedController.prototype as unknown as Record<
        string,
        object
      >;
      expect(
        hasOwnThrottleOverride(
          ctxFor({}, proto.inherited, TightenedController),
        ),
      ).toBe(true);
    });
  });

  describe('the composed skipIf rule', () => {
    // Mirrors AuthModule's `skipIf`. This is the security-critical composition:
    // trusted origin AND no tight per-route limit of its own.
    const skipIf = (context: ExecutionContext) =>
      isTrustedInternalOrigin(context) && !hasOwnThrottleOverride(context);

    class Routes {
      contentRead(): void {}

      @Throttle({ short: { limit: 1, ttl: 10_000 } })
      resendConfirmationEmail(): void {}
    }

    const proto = Routes.prototype as unknown as Record<string, object>;
    const trusted = { [INTERNAL_API_KEY_HEADER]: 's3cret-value' };

    beforeEach(() => {
      process.env.INTERNAL_API_SECRET = 's3cret-value';
    });

    it('skips throttling for a trusted origin on an ordinary route (prerender fan-out)', () => {
      expect(skipIf(ctxFor(trusted, proto.contentRead, Routes))).toBe(true);
    });

    it('does NOT skip for a trusted origin on a route with its own tight limit', () => {
      // The whole point: a leaked INTERNAL_API_SECRET must not dissolve the
      // mail-sender / credential / settle limits.
      expect(
        skipIf(ctxFor(trusted, proto.resendConfirmationEmail, Routes)),
      ).toBe(false);
    });

    it('never skips for an anonymous caller', () => {
      expect(skipIf(ctxFor({}, proto.contentRead, Routes))).toBe(false);
      expect(skipIf(ctxFor({}, proto.resendConfirmationEmail, Routes))).toBe(
        false,
      );
    });
  });
});
