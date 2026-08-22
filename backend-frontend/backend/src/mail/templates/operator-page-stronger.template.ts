import {
  operatorEmailShell,
  type OperatorEmailBlock,
} from './operator-email-shell';

/**
 * OB-8 "Make your tour page stronger" - the live+7d lifecycle nudge:
 * educational first, one partner offer at the end. Copy is LOCKED by the
 * onboarding wireframe (stage m8).
 *
 * Block order: logo · headline · paragraph · quiet panel · CTA. The quiet
 * panel sits BEFORE the button here (it sits after it in OB-2A), which is why
 * it carries the wireframe's `margin:0 0 16px` override instead of the default
 * `margin:16px 0 0` - the gap has to move to the side the content is on.
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
}

export const OPERATOR_PAGE_STRONGER_SUBJECT = 'Make your tour page stronger';

export function operatorPageStrongerTemplate({
  includePartnerOffer,
  photoShootContactUrl,
  toursUrl,
  optOutUrl,
}: OperatorPageStrongerTemplateProps) {
  const offerOn = includePartnerOffer && Boolean(photoShootContactUrl);
  const offer: OperatorEmailBlock[] = offerOn
    ? [
        {
          kind: 'quiet',
          heading: 'Want pro photos?',
          bodyHtml:
            'We arrange photo and drone shoots with Dronebaas, our photo partner on the island. One shoot, and your page gets the pictures it deserves.',
          spacing: 'below',
        },
      ]
    : [];

  return operatorEmailShell({
    title: OPERATOR_PAGE_STRONGER_SUBJECT,
    preheader: 'Photos do most of the work.',
    blocks: [
      { kind: 'logo' },
      { kind: 'headline', text: OPERATOR_PAGE_STRONGER_SUBJECT },
      {
        kind: 'paragraph',
        html: "A quick look at what makes tour pages book well: bright, real photos first (they do most of the work), availability that's always current, and honest answers to what travelers ask.",
      },
      ...offer,
      {
        kind: 'button',
        label: offerOn ? 'Plan a photo shoot' : 'Open your tour pages',
        url: offerOn ? (photoShootContactUrl as string) : toursUrl,
      },
    ],
    footer: { variant: 'lifecycle', optOutUrl },
  });
}
