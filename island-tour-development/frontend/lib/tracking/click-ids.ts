/**
 * The click-id set the platform tracks (master 8.3 `click_ids`). SINGLE SOURCE:
 * the wire type AND every loop over the ids derive from this tuple, so adding a
 * platform (msclkid, ttclid, ...) here updates both at once - a key can never
 * be typed but silently dropped from the push. The loop stays an explicit
 * allowlist on purpose: iterating `Object.keys` over a server response would
 * forward unexpected keys into the dataLayer.
 *
 * Client-safe module by design: `lib/api/public/bookings.ts` is server-only,
 * so the browser push imports the KEYS (a value) from here and only types from
 * there.
 */
export const CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid', 'fbclid'] as const;

export type ClickIdKey = (typeof CLICK_ID_KEYS)[number];

/** Click ids captured at landing (master 8.3 `click_ids`); a null field simply
 *  was not present on the landing URL. */
export type ConversionClickIds = Record<ClickIdKey, string | null>;
