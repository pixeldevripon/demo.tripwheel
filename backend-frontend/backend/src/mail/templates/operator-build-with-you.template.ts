import {
  operatorEmailShell,
  type OperatorEmailBlock,
} from './operator-email-shell';

/**
 * OB-4 "We'll build it with you" - the day-7-after-approval rescue for
 * operators still at zero tours. Copy is LOCKED by the onboarding wireframe
 * (stage m4). The WhatsApp CTA is THE ONE GREEN BUTTON in the whole email
 * family (design constants: WhatsApp green only on OB-4); when WhatsApp is
 * disabled in settings the email degrades to the email + self-serve links
 * rather than shipping a dead chat button.
 *
 * The two alternatives are SEPARATE `.e-sec` lines with 6px and 8px tops, not
 * one line joined by a `<br>`: the wireframe stacks them as three descending
 * offers, and the tightening gap is what makes them read that way.
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
}

export const OPERATOR_BUILD_WITH_YOU_SUBJECT = "We'll build it with you";

export function operatorBuildWithYouTemplate({
  whatsappUrl,
  salesEmail,
  addTourUrl,
  optOutUrl,
}: OperatorBuildWithYouTemplateProps) {
  const cta: OperatorEmailBlock[] = whatsappUrl
    ? [
        {
          kind: 'button',
          label: 'Chat on WhatsApp',
          url: whatsappUrl,
          tone: 'green',
        },
      ]
    : [];
  const emailLine: OperatorEmailBlock[] = salesEmail
    ? [
        {
          kind: 'secondary',
          label: `Or email everything to ${salesEmail}`,
          url: `mailto:${salesEmail}`,
          marginTop: 6,
        },
      ]
    : [];

  return operatorEmailShell({
    title: OPERATOR_BUILD_WITH_YOU_SUBJECT,
    preheader: 'Send your photos and prices on WhatsApp.',
    blocks: [
      { kind: 'logo' },
      { kind: 'headline', text: OPERATOR_BUILD_WITH_YOU_SUBJECT },
      {
        kind: 'paragraph',
        html: "A first tour page can fall to the bottom of the pile. We know how island days run. Send us your photos, prices, and departure times, WhatsApp or email, and we'll set up your page together: you check it, we make it live.",
      },
      ...cta,
      ...emailLine,
      {
        kind: 'secondary',
        label: 'Or add your tour yourself',
        url: addTourUrl,
        marginTop: 8,
      },
    ],
    footer: { variant: 'lifecycle', optOutUrl },
  });
}
