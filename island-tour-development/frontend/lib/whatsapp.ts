/**
 * WhatsApp deep links - master 6.6.
 *
 * "One deep-link pattern everywhere: https://wa.me/{number}?text={greeting};
 *  WhatsApp Web or the app handles desktop and mobile natively, no custom modal."
 *
 * WhatsApp RENDERS in: tour description inline links, the global footer, error
 * states, the NeedHelp components, and post-purchase email.
 * WhatsApp is DELIBERATELY ABSENT from: the widget trust strip, the trust
 * modals, and the commit moment generally. Do not add it to those surfaces.
 *
 * Mirrors backend/src/common/utils/whatsapp.util.ts - keep both in sync (same
 * rule as lib/config/rbac.ts mirroring roles.config.ts). Plain functions, no
 * 'use client': callers on either side of the boundary can import this.
 */

/**
 * wa.me accepts digits only: no '+', spaces, dashes, or parentheses. Settings
 * stores the number in human form (e.g. '+8801913509868'), so normalize before
 * building the link or WhatsApp resolves it to nothing.
 */
export function normalizeWhatsappNumber(raw: string | null | undefined): string {
    return (raw ?? '').replace(/\D/g, '');
}

/**
 * Build the canonical wa.me deep link, or null when WhatsApp should not render.
 *
 * Returns null when the chat is disabled or the number is unusable, so callers
 * branch on one value and skip the whole surface. Never fall back to `href='#'`
 * - a dead chat button is worse than no button.
 *
 * @param number   PublicSiteInfo.whatsappNumber (any human format)
 * @param enabled  PublicSiteInfo.enableWhatsappChat
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
