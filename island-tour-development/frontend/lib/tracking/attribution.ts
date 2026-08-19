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

/**
 * VERSIONED because the gate is not retroactive.
 *
 * Before the consent gate, `it.attribution` was written for every visitor with a
 * 90-day life. Adding the gate stops new writes but cannot reach a cookie that
 * already exists - and the clear path only runs when Cookiebot is present, which
 * is exactly what an ad blocker, a CSP block or an unset CBID removes. That
 * legacy cookie would still have been read at checkout and snapshotted onto the
 * booking forever. Bumping the name orphans every pre-consent cookie outright,
 * and `LEGACY_COOKIES` is deleted unconditionally on mount so it does not linger
 * for 90 days in someone's jar.
 */
const COOKIE = 'it.attribution.v2';
/** Pre-consent-gate cookie names, deleted on sight. Never read. */
export const LEGACY_COOKIES = ['it.attribution'] as const;
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

/** The only keys that may ever appear in the cookie (values of PARAM_MAP). */
const ATTRIBUTION_KEYS = new Set<string>(Object.values(PARAM_MAP));

/**
 * Keep only known keys, keep only strings, and re-apply the length caps.
 *
 * VALIDATE ON READ, not just on write. What comes back out of `document.cookie`
 * is not necessarily what we put in: cookies are matched on (name, domain,
 * path), so anything able to set a `Domain`-scoped cookie on a sibling
 * subdomain can plant a second `it.attribution.v2` that `.find()` may select
 * ahead of ours - and a host-only delete would not remove it. Sanitising here
 * makes such a cookie inert on both the merge and the send path instead of
 * chasing domains: unknown keys are dropped rather than merged forward and
 * posted to `/bookings/reserve`, where `forbidNonWhitelisted` would 400 every
 * booking attempt until the victim cleared their cookies.
 *
 * It also re-applies `clamp`, which otherwise only ever ran on values read from
 * the URL this visit - an oversized value already in the jar was preserved,
 * re-written and sent.
 */
function sanitize(raw: unknown): Attribution {
  if (typeof raw !== 'object' || raw === null) return {};
  const out: Attribution = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!ATTRIBUTION_KEYS.has(key)) continue;
    if (typeof value !== 'string' || value === '') continue;
    out[key as keyof Attribution] = clamp(key as keyof Attribution, value);
  }
  return out;
}

function readCookie(): Attribution {
  if (typeof document === 'undefined') return {};
  const row = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${COOKIE}=`));
  if (!row) return {};
  try {
    return sanitize(JSON.parse(decodeURIComponent(row.slice(COOKIE.length + 1))));
  } catch {
    return {};
  }
}

/**
 * Read the ad params off the CURRENT URL. Pure: touches no cookie and stores
 * nothing.
 *
 * Split out from the write so the caller can snapshot the landing URL the
 * instant the page loads, and only persist it later, once consent exists. Click
 * ids live on the landing URL and nowhere else: by the time a visitor has read
 * the cookie banner and clicked Accept they may have navigated on, and the gclid
 * would be gone. Holding it in memory in the meantime is not storage and needs
 * no consent - only writing the cookie does.
 */
export function readLandingAttribution(): Attribution {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const found: Attribution = {};
  for (const [param, key] of Object.entries(PARAM_MAP)) {
    const raw = params.get(param);
    if (raw) found[key] = clamp(key, raw);
  }
  return found;
}

/**
 * Persist attribution, MERGED over any existing cookie: last-click wins per
 * param (a fresh ad click overwrites its gclid), while params absent from this
 * visit keep their prior value, so attribution persists through the funnel.
 * No-op when there is nothing new - an organic page load never clears a
 * previously captured click id.
 *
 * CALL ONLY WITH MARKETING CONSENT. This is a first-party `document.cookie`
 * write, which Cookiebot's auto-blocking cannot intercept, so the gate has to
 * live at the call site (`AttributionCapture`) - there is nothing else to stop
 * it. `secure` is set on https so the cookie never rides a plaintext request.
 */
export function persistAttribution(found: Attribution): void {
  // Guard on `window`, not `document` - this function dereferences
  // `window.location` below, so a document-only shim would throw out of a
  // layout-mounted effect.
  if (typeof window === 'undefined') return;
  const next: Attribution = { ...readCookie() };
  let changed = false;
  for (const [key, value] of Object.entries(found) as [
    keyof Attribution,
    string,
  ][]) {
    if (value) {
      next[key] = value;
      changed = true;
    }
  }
  if (!changed) return;
  const secure = window.location.protocol === 'https:' ? ';secure' : '';
  document.cookie = `${COOKIE}=${encodeURIComponent(
    JSON.stringify(next),
  )};path=/;max-age=${MAX_AGE};samesite=lax${secure}`;
}

/**
 * Delete the stored attribution cookie.
 *
 * Called when marketing consent is absent or withdrawn. Withdrawing consent has
 * to remove what was already stored, not merely stop adding to it - otherwise a
 * visitor who accepted, browsed, then changed their mind would still have their
 * click id ride along to the booking record.
 */
export function clearAttribution(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE}=;path=/;max-age=0;samesite=lax`;
}

/**
 * Delete every pre-consent-gate cookie, UNCONDITIONALLY.
 *
 * Deliberately not behind the consent gate and not behind Cookiebot being
 * present: deleting data always needs less justification than keeping it, and
 * the whole point is that this must run in exactly the cases the gate cannot
 * reach - Cookiebot blocked by an extension, a CSP block, an unset CBID. Those
 * are the cases where a cookie written by the pre-gate build would otherwise sit
 * in the jar for 90 days and still be read at checkout.
 */
export function purgeLegacyAttribution(): void {
  if (typeof document === 'undefined') return;
  for (const name of LEGACY_COOKIES) {
    document.cookie = `${name}=;path=/;max-age=0;samesite=lax`;
  }
}

/** Stored attribution for the reserve payload, or null when none was captured. */
export function readAttribution(): Attribution | null {
  const a = readCookie();
  return Object.keys(a).length > 0 ? a : null;
}
