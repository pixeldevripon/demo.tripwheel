/**
 * The ONE place that writes the `booking_complete` event to the GTM dataLayer
 * (master 8). GTM fans it out to Conversion Linker / Google Ads / GA4 purchase /
 * Meta Pixel (8.1 item 2); the server CAPI fires in parallel and dedupes on the
 * shared `event_id` (8.1 item 4). Conversion value is the EUR commission, never
 * GMV (rule #22 / 8.1 item 1).
 */
import type { TypConversion } from '@/lib/api/public/bookings';

/**
 * Analytics master switch (master 8.2: production only, with a staging guard).
 * Both prod and staging build with NODE_ENV=production, so gate on an EXPLICIT
 * public flag set 'true' only on the real production deploy - never dev/staging,
 * so test bookings never pollute prod conversion data.
 */
export function trackingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_TRACKING === 'true';
}

/**
 * Client-side de-dupe within a single page load. The AUTHORITATIVE once-guard is
 * the server mark-first (`conversion_pushed_at`): a refresh / second tab / later
 * visit receives a null payload from `claimConversionPush` and never reaches here,
 * so this set only needs to absorb React StrictMode's double effect-invoke in the
 * same load. Deliberately NOT localStorage / sessionStorage (master 8.1 item 5).
 */
const pushed = new Set<string>();

interface DataLayerObject {
  [key: string]: unknown;
}

declare global {
  interface Window {
    dataLayer?: DataLayerObject[];
  }
}

/**
 * Push the one `booking_complete` event for this booking. No-op when tracking is
 * disabled, off the server (SSR), already pushed this load, or given no payload
 * (unverified / not-yet-confirmed / not the mark-first winner - all resolved to
 * null server-side). `event_id` is the booking publicRef, shared with the server
 * CAPI for Meta deduplication.
 */
export function pushBookingComplete(conversion: TypConversion | null): void {
  if (!conversion) return;
  if (!trackingEnabled()) return;
  if (typeof window === 'undefined') return;
  if (pushed.has(conversion.eventId)) return;
  pushed.add(conversion.eventId);

  const value = Number(conversion.value);
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    event: 'booking_complete',
    // Shared with the server CAPI event_id so Meta dedupes Pixel vs CAPI (8.1.4).
    event_id: conversion.eventId,
    // EUR commission, never GMV (rule #22). The richer 8.3 fields (booking_ref /
    // operator / island / user_data hashed PII / click_ids) are layered on by the
    // later A-phase tasks (#43 PII, #81 click ids); A1 ships the value + dedup id.
    booking_value: value,
    booking_currency: 'EUR',
    tour_id: conversion.contentId,
    tour_name: conversion.contentName,
    items: [
      {
        item_id: conversion.contentId,
        item_name: conversion.contentName,
        price: value,
        quantity: 1,
      },
    ],
  });
}
