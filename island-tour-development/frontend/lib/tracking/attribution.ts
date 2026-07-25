/**
 * Ad click id + UTM capture (master 8.1 item 6 / E.8 / dev spec 14).
 *
 * Click ids (gclid/gbraid/wbraid/fbclid) and UTM params arrive on the LANDING
 * URL but the booking is created several navigations later, so they are stored in
 * a first-party cookie that survives the funnel and read back into the reserve
 * payload. The backend snapshots them onto the booking at creation only, feeding
 * the `booking_complete` push (8.3) and later Google Ads / Meta adjustments.
 *
 * Client-only (`document.cookie` / `window.location`); guarded so an accidental
 * server import is a no-op rather than a crash.
 */

export interface Attribution {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

const COOKIE = 'it.attribution';
// 90 days - comfortably spans the consider-then-book window for a holiday trip.
const MAX_AGE = 60 * 60 * 24 * 90;

/** Landing-URL query param -> Attribution key. */
const PARAM_MAP: Record<string, keyof Attribution> = {
  gclid: 'gclid',
  gbraid: 'gbraid',
  wbraid: 'wbraid',
  fbclid: 'fbclid',
  utm_source: 'utmSource',
  utm_medium: 'utmMedium',
  utm_campaign: 'utmCampaign',
  utm_term: 'utmTerm',
  utm_content: 'utmContent',
};

/** Cap defensively (the backend DTO also caps): click ids <= 512, UTM <= 255. */
function clamp(key: keyof Attribution, value: string): string {
  const max = key.startsWith('utm') ? 255 : 512;
  return value.slice(0, max);
}

function readCookie(): Attribution {
  if (typeof document === 'undefined') return {};
  const row = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${COOKIE}=`));
  if (!row) return {};
  try {
    return JSON.parse(
      decodeURIComponent(row.slice(COOKIE.length + 1)),
    ) as Attribution;
  } catch {
    return {};
  }
}

/**
 * Capture attribution from the current URL, MERGED over any existing cookie:
 * last-click wins per param (a fresh ad click overwrites its gclid), while params
 * absent from this URL keep their prior value, so attribution persists through the
 * funnel. No-op when the URL carries none - an organic page load never clears a
 * previously captured click id.
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const next: Attribution = { ...readCookie() };
  let changed = false;
  for (const [param, key] of Object.entries(PARAM_MAP)) {
    const raw = params.get(param);
    if (raw) {
      next[key] = clamp(key, raw);
      changed = true;
    }
  }
  if (!changed) return;
  document.cookie = `${COOKIE}=${encodeURIComponent(
    JSON.stringify(next),
  )};path=/;max-age=${MAX_AGE};samesite=lax`;
}

/** Stored attribution for the reserve payload, or null when none was captured. */
export function readAttribution(): Attribution | null {
  const a = readCookie();
  return Object.keys(a).length > 0 ? a : null;
}
