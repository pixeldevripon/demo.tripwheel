import { BadRequestException } from '@nestjs/common';

/**
 * Guards that a `[from, to]` local-date range is ordered. Both bounds are
 * strict `YYYY-MM-DD` (see `@IsLocalDate()`), which sorts lexicographically the
 * same as chronologically, so a plain string compare is correct. No-ops when
 * either bound is absent (open-ended range).
 */
export function assertDateRangeOrder(
  from: string | undefined,
  to: string | undefined,
  fromLabel = 'from',
  toLabel = 'to',
): void {
  if (from && to && to < from) {
    throw new BadRequestException(
      `${toLabel} must be on or after ${fromLabel}`,
    );
  }
}
