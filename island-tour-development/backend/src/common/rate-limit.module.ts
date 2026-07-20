import { Module } from '@nestjs/common';
import { TargetRateLimiter } from '@/bookings/lookup-rate-limiter';

/**
 * ONE process-wide `TargetRateLimiter` instance for every module that caps
 * per-target mail sends (bookings TYP actions, customer welcome resends).
 * The class already namespaces counters by `bucket`, so sharing an instance
 * never collides - and a single instance means a single sweep timer instead
 * of one per consuming module.
 *
 * (`LookupRateLimiter` stays a BookingsModule provider: it is used only by
 * the traveler pair-login and has no second consumer.)
 */
@Module({
  providers: [TargetRateLimiter],
  exports: [TargetRateLimiter],
})
export class RateLimitModule {}
