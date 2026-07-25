'use client';

import { useEffect } from 'react';
import type { TypConversion } from '@/lib/api/public/bookings';
import { pushBookingComplete } from '@/lib/tracking/booking-complete';

/**
 * Fires the one-time `booking_complete` dataLayer push on the TYP (master 8.2).
 *
 * The server component already mark-first-claimed the push (`claimConversionPush`)
 * and hands us the payload ONLY on the winning render - null on a refresh, a
 * second tab, a shared link, or a not-yet-confirmed booking. So this leaf just
 * delivers the payload browser-side (GTM/Pixel are client-only) and renders
 * nothing. `pushBookingComplete` is itself a no-op when tracking is disabled or
 * the payload is null, so mounting it unconditionally is safe.
 */
export function ConversionPush({
  conversion,
}: {
  conversion: TypConversion | null;
}) {
  useEffect(() => {
    pushBookingComplete(conversion);
  }, [conversion]);
  return null;
}
