import { authEmailShell } from './auth-email-shell';

/**
 * OB-8 "Make your tour page stronger" - the live+7d lifecycle nudge:
 * educational first, one partner offer at the end. Copy is LOCKED by the
 * onboarding wireframe (stage m8).
 *
 * The Dronebaas block rides behind `includePartnerOffer` (founder decision
 * D6 - counsel reviews the offer under Q5), so the email ships either way:
 * with the offer it is the wireframe verbatim (quiet block + "Plan a photo
 * shoot" CTA); without it the CTA points the operator at their own tour
 * pages instead, and no partner is named.
 */

export interface OperatorPageStrongerTemplateProps {
  /** Decision D6: render the Dronebaas offer block + photo-shoot CTA. */
  includePartnerOffer: boolean;
  /** Contact link for "Plan a photo shoot" (wa.me or mailto:sales). */
  photoShootContactUrl?: string | null;
  /** Dashboard tours list - the CTA when the partner offer is off. */
  toursUrl: string;
  /** WP-A unsubscribe token link - lifecycle footer (D-10). */
  optOutUrl: string;
  siteLogoUrl?: string | null;
}

export const OPERATOR_PAGE_STRONGER_SUBJECT = 'Make your tour page stronger';

export function operatorPageStrongerTemplate({
  includePartnerOffer,
  photoShootContactUrl,
  toursUrl,
  optOutUrl,
  siteLogoUrl,
}: OperatorPageStrongerTemplateProps) {
  const paragraphs = [
    "A quick look at what makes tour pages book well: bright, real photos first (they do most of the work), availability that's always current, and honest answers to what travelers ask.",
  ];

  const offerOn = includePartnerOffer && Boolean(photoShootContactUrl);
  if (offerOn) {
    paragraphs.push(
      `<span style="display:block;background:#F8F8F6;border:1px solid #EAE7E1;border-radius:10px;padding:13px 16px">` +
        `<span style="display:block;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;margin-bottom:5px">Want pro photos? </span>` +
        `<span style="display:block;font-size:13px;color:#4B5563;line-height:1.55">We arrange photo and drone shoots with Dronebaas, our photo partner on the island. One shoot, and your page gets the pictures it deserves.</span>` +
        `</span>`,
    );
  }

  return authEmailShell({
    siteLogoUrl,
    title: OPERATOR_PAGE_STRONGER_SUBJECT,
    paragraphs,
    ctaLabel: offerOn ? 'Plan a photo shoot' : 'Open your tour pages',
    ctaUrl: offerOn ? (photoShootContactUrl as string) : toursUrl,
    optOutUrl,
  });
}
