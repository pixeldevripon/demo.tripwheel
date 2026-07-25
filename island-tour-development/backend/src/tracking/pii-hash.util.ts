import { createHash } from 'crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * SHA-256 hashed PII for Enhanced Conversions (Google) + Advanced Matching (Meta),
 * master 8.1 item 3 / 8.3.
 *
 * ONE normalization + hash pass serves BOTH platforms (master: "one SHA-256 pass
 * serves Google and Meta alike, never per-platform hashing"). Callers map the same
 * hash values onto their own envelope keys - Google's `sha256_*` dataLayer fields via
 * {@link toGoogleUserData}, Meta's `em`/`ph`/... via {@link toMetaUserData}. Both the
 * browser push (TYP) and the server CAPI (confirm) run this identical normalization,
 * so their hashes match even though they fire from different code paths.
 *
 * Raw PII is never logged or shipped to the browser - only the hashes leave this module.
 */

/** SHA-256 hex of an already-normalized string. */
function sha256(normalized: string): string {
  return createHash('sha256').update(normalized).digest('hex');
}

/** Trim + lowercase, then hash. Blank/absent -> undefined (never a hash of ''). */
function hashText(value: string | null | undefined): string | undefined {
  const v = value?.trim().toLowerCase();
  return v ? sha256(v) : undefined;
}

/**
 * Normalize a phone to E.164 (via libphonenumber-js) then hash. Numbers are stored
 * `+<dial><local>` from checkout, but the lookup/OCTO paths may not be, so parse
 * defensively; fall back to a digit/`+` strip when it can't be parsed as valid.
 */
function hashPhone(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  const parsed = parsePhoneNumberFromString(raw);
  const canonical = parsed?.isValid()
    ? parsed.number // E.164, e.g. +12125550100
    : raw.replace(/[^\d+]/g, '');
  return canonical ? sha256(canonical.toLowerCase()) : undefined;
}

/** The per-field hashes (omitted when the source field is blank). */
export interface HashedPii {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

export interface PiiInput {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

/** Compute all field hashes once (the master's single-pass rule). */
export function computeHashedPii(input: PiiInput): HashedPii {
  const out: HashedPii = {};
  const set = (key: keyof HashedPii, hash: string | undefined) => {
    if (hash) out[key] = hash;
  };
  set('email', hashText(input.email));
  set('phone', hashPhone(input.phone));
  set('firstName', hashText(input.firstName));
  set('lastName', hashText(input.lastName));
  set('city', hashText(input.city));
  set('postalCode', hashText(input.postalCode));
  set('country', hashText(input.country));
  return out;
}

/** Google Enhanced Conversions `user_data` (master 8.3 dataLayer field names). */
export interface GoogleUserData {
  sha256_email_address?: string;
  sha256_phone_number?: string;
  sha256_first_name?: string;
  sha256_last_name?: string;
  address?: {
    sha256_city?: string;
    sha256_postal_code?: string;
    sha256_country?: string;
  };
}

/** Map the shared hashes onto Google's dataLayer envelope. Returns undefined when
 *  there is nothing to send (no email - the one required field). */
export function toGoogleUserData(h: HashedPii): GoogleUserData | undefined {
  if (!h.email) return undefined; // sha256_email_address is the required field (8.3)
  const address: NonNullable<GoogleUserData['address']> = {};
  if (h.city) address.sha256_city = h.city;
  if (h.postalCode) address.sha256_postal_code = h.postalCode;
  if (h.country) address.sha256_country = h.country;

  const data: GoogleUserData = { sha256_email_address: h.email };
  if (h.phone) data.sha256_phone_number = h.phone;
  if (h.firstName) data.sha256_first_name = h.firstName;
  if (h.lastName) data.sha256_last_name = h.lastName;
  if (Object.keys(address).length > 0) data.address = address;
  return data;
}

/** Map the shared hashes onto Meta's Advanced-Matching envelope (`user_data`). */
export function toMetaUserData(h: HashedPii): Record<string, string[]> {
  const data: Record<string, string[]> = {};
  if (h.email) data.em = [h.email];
  if (h.phone) data.ph = [h.phone];
  if (h.firstName) data.fn = [h.firstName];
  if (h.lastName) data.ln = [h.lastName];
  if (h.city) data.ct = [h.city];
  if (h.postalCode) data.zp = [h.postalCode];
  if (h.country) data.country = [h.country];
  return data;
}
