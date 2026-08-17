/**
 * The ONE place that writes the `booking_complete` event to the GTM dataLayer
 * (master 8). GTM fans it out to Conversion Linker / Google Ads / GA4 purchase /
 * Meta Pixel (8.1 item 2); the server CAPI fires in parallel and dedupes on the
 * shared `event_id` (8.1 item 4). Conversion value is the EUR commission, never
 * GMV (rule #22 / 8.1 item 1).
 */
import type { ConversionUserData, TypConversion } from '@/lib/api/public/bookings';
import { CLICK_ID_KEYS, type ClickIdKey, type ConversionClickIds } from './click-ids';

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
 * The full `booking_complete` contract (master 8.3). Required fields are
 * deliberately non-optional: the push below is composed AGAINST this type, so a
 * missing required field is a compile (CI) error, never a runtime fallback -
 * the master 8.3 "type-checked in CI" contract rule.
 */
interface BookingCompleteEvent extends DataLayerObject {
  event: 'booking_complete';
  /** Shared with the server CAPI event_id - the Meta dedup key (8.1.4). */
  event_id: string;
  /** Human booking reference (display ref) for cross-platform reporting. */
  booking_ref: string;
  /** EUR commission, never GMV (rule #22 / 8.1.1). */
  booking_value: number;
  booking_currency: 'EUR';
  tour_id: string;
  tour_name: string | null;
  operator_id: string;
  operator_name: string | null;
  island: string;
  items: [
    {
      item_id: string;
      item_name: string | null;
      item_brand: string | null;
      item_category: string | null;
      price: number;
      quantity: 1;
    },
  ];
  /** GA4 cross-device key (hashed email); omitted when there is no email. */
  user_id?: string;
  /** Only the click ids that were actually captured; omitted when organic. */
  click_ids?: Partial<Record<ClickIdKey, string>>;
  /** Server-hashed Enhanced Conversions PII; omitted when there is no email. */
  user_data?: ConversionUserData;
}

/**
 * Drop null members; undefined when nothing was captured (organic booking).
 * Iterates CLICK_ID_KEYS - the tuple the type itself derives from - so a newly
 * added click id can never be typed but silently dropped, while the loop stays
 * an explicit allowlist (never `Object.keys` over a server response).
 */
function compactClickIds(
  ids: ConversionClickIds | null
): BookingCompleteEvent['click_ids'] {
  if (!ids) return undefined;
  const out: Partial<Record<ClickIdKey, string>> = {};
  for (const key of CLICK_ID_KEYS) {
    const value = ids[key];
    if (value) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
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
  const clickIds = compactClickIds(conversion.clickIds);
  const event: BookingCompleteEvent = {
    event: 'booking_complete',
    // Shared with the server CAPI event_id so Meta dedupes Pixel vs CAPI (8.1.4).
    event_id: conversion.eventId,
    booking_ref: conversion.bookingRef,
    // EUR commission, never GMV (rule #22).
    booking_value: value,
    booking_currency: 'EUR',
    tour_id: conversion.contentId,
    tour_name: conversion.contentName,
    operator_id: conversion.operatorId,
    operator_name: conversion.operatorName,
    island: conversion.island,
    items: [
      {
        item_id: conversion.contentId,
        item_name: conversion.contentName,
        item_brand: conversion.operatorName,
        item_category: conversion.itemCategory,
        price: value,
        quantity: 1,
      },
    ],
    // GA4 cross-device user_id (hashed email, master 8.3); omitted without email.
    ...(conversion.userId ? { user_id: conversion.userId } : {}),
    // Click ids captured at landing (master 8.3); omitted when organic.
    ...(clickIds ? { click_ids: clickIds } : {}),
    // Hashed PII for Google Enhanced Conversions (master 8.3), hashed server-side;
    // omitted entirely when there is no email to hash.
    ...(conversion.userData ? { user_data: conversion.userData } : {}),
  };
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(event);
}
