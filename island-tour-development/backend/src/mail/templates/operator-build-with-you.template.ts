import { authEmailShell, escapeHtml } from './auth-email-shell';

/**
 * OB-4 "We'll build it with you" - the day-7-after-approval rescue for
 * operators still at zero tours. Copy is LOCKED by the onboarding wireframe
 * (stage m4). The WhatsApp CTA is THE ONE GREEN BUTTON in the whole email
 * family (design constants: WhatsApp green only on OB-4); when WhatsApp is
 * disabled in settings the email degrades to the email + self-serve links
 * rather than shipping a dead chat button.
 */

export interface OperatorBuildWithYouTemplateProps {
  /** wa.me deep link (SiteInfo via buildWhatsappUrl); null → no green CTA. */
  whatsappUrl?: string | null;
  /** Sales pipeline mailbox for "Or email everything to …" (salesRecipient). */
  salesEmail?: string | null;
  /** Dashboard deep link to the create-tour wizard - the self-serve line. */
  addTourUrl: string;
  /** WP-A unsubscribe token link - lifecycle footer (D-10). */
  optOutUrl: string;
  siteLogoUrl?: string | null;
}

export const OPERATOR_BUILD_WITH_YOU_SUBJECT = "We'll build it with you";

export function operatorBuildWithYouTemplate({
  whatsappUrl,
  salesEmail,
  addTourUrl,
  optOutUrl,
  siteLogoUrl,
}: OperatorBuildWithYouTemplateProps) {
  const alternatives = [
    ...(salesEmail
      ? [
          `<a href="mailto:${escapeHtml(salesEmail)}" style="color:#4B5563;font-weight:600;text-decoration:underline">Or email everything to ${escapeHtml(salesEmail)}</a>`,
        ]
      : []),
    `<a href="${addTourUrl}" style="color:#4B5563;font-weight:600;text-decoration:underline">Or add your tour yourself</a>`,
  ].join('<br> ');

  return authEmailShell({
    siteLogoUrl,
    title: OPERATOR_BUILD_WITH_YOU_SUBJECT,
    paragraphs: [
      "A first tour page can fall to the bottom of the pile. We know how island days run. Send us your photos, prices, and departure times, WhatsApp or email, and we'll set up your page together: you check it, we make it live.",
    ],
    ...(whatsappUrl
      ? {
          ctaLabel: 'Chat on WhatsApp',
          ctaUrl: whatsappUrl,
          ctaBackground: '#16A34A' as const,
        }
      : {}),
    footnote: alternatives,
    optOutUrl,
  });
}
