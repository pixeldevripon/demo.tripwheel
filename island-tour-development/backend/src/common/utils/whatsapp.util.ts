/**
 * WhatsApp deep links - master 6.6.
 *
 * "One deep-link pattern everywhere: https://wa.me/{number}?text={greeting};
 *  WhatsApp Web or the app handles desktop and mobile natively, no custom modal."
 *
 * WhatsApp lives in: tour description inline links, the global footer, error
 * states, the NeedHelp components, and post-purchase email.
 * Deliberately absent from: the widget trust strip, the trust modals, and the
 * commit moment generally.
 *
 * The frontend mirror of this helper is frontend/lib/whatsapp.ts - keep both in
 * sync (same rule as lib/config/rbac.ts mirroring roles.config.ts).
 */

/**
 * wa.me accepts digits only: no '+', spaces, dashes, or parentheses. Settings
 * stores the number in human form (e.g. '+8801913509868'), so normalize before
 * building the link or WhatsApp resolves it to nothing.
 */
export function normalizeWhatsappNumber(
  raw: string | null | undefined,
): string {
  return (raw ?? '').replace(/\D/g, '');
}

/**
 * Build the canonical wa.me deep link, or null when WhatsApp should not render.
 *
 * Returns null when the chat is disabled or the number is unusable, so callers
 * can branch on a single value rather than re-checking the flag. Never emit a
 * bare '#' href - a dead chat button is worse than no button.
 *
 * @param number   SiteInfo.whatsappNumber (any human format)
 * @param enabled  SiteInfo.enableWhatsappChat
 * @param greeting optional prefilled message; surface-specific per 6.6
 */
export function buildWhatsappUrl(
  number: string | null | undefined,
  enabled: boolean | null | undefined,
  greeting?: string | null,
): string | null {
  if (!enabled) return null;

  const digits = normalizeWhatsappNumber(number);
  // E.164 numbers run 8-15 digits; anything shorter is a typo, not a number.
  if (digits.length < 8) return null;

  const base = `https://wa.me/${digits}`;
  const text = greeting?.trim();
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
