/**
 * What counts as an email address on the public site, client-side.
 *
 * Deliberately PERMISSIVE, and calibrated against the backend rather than
 * against RFC 5322: anything the backend's `IsEmail` will store has to pass
 * here, or a traveller whose address is already on a booking gets locked out of
 * a form by our own guess. `IsEmail` demands a dotted domain, an alpha TLD of
 * two or more, and no bare spaces, so every storable address satisfies this
 * shape.
 *
 * Shared rather than copied. It lived privately inside the traveller login
 * card; the saved-tours email capture needs the same answer, and two regexes
 * for "is this an email" is two places for the answer to drift.
 */
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** True when `value` is shaped like an address the backend would accept. */
export function isEmailShaped(value: string): boolean {
    return EMAIL_SHAPE.test(value.trim());
}
