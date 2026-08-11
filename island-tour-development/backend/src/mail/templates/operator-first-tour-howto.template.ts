import { authEmailShell } from './auth-email-shell';

/**
 * OB-3 "Your first tour, step by step" - the +48h-after-approval lifecycle
 * nudge, sent only while the operator has submitted zero tours. Copy is
 * LOCKED by the onboarding wireframe (stage m3).
 *
 * The walkthrough block ALTERNATES (wireframe Q1/Q2): a "Watch the
 * walkthrough" link when `WALKTHROUGH_VIDEO_URL` is configured, the guide
 * link alone otherwise. Video never embeds in email - the link opens Loom.
 */

export interface OperatorFirstTourHowtoTemplateProps {
  /** Dashboard deep link to the create-tour wizard. */
  addTourUrl: string;
  /** Step-by-step guide link - "Read the step-by-step guide". */
  guideUrl: string;
  /** Loom URL (WALKTHROUGH_VIDEO_URL); block omitted when absent. */
  walkthroughVideoUrl?: string | null;
  /** WP-A unsubscribe token link - lifecycle footer (D-10). */
  optOutUrl: string;
  siteLogoUrl?: string | null;
}

export const OPERATOR_FIRST_TOUR_HOWTO_SUBJECT =
  'Your first tour, step by step';

export function operatorFirstTourHowtoTemplate({
  addTourUrl,
  guideUrl,
  walkthroughVideoUrl,
  optOutUrl,
  siteLogoUrl,
}: OperatorFirstTourHowtoTemplateProps) {
  const paragraphs = [
    'Your tour page starts as a short form: your overview, facts, photos, prices, availability, and departure times. You fill it in, we give it a final check, and your page goes live.',
  ];
  if (walkthroughVideoUrl) {
    // The alternate slot: a linked block, never an embedded player (the
    // wireframe's Loom thumbnail collapses to its caption in a TS template).
    paragraphs.push(
      `<a href="${walkthroughVideoUrl}" style="display:block;border:1px solid #EAE7E1;border-radius:12px;padding:14px 16px;color:#1F2937;font-weight:600;text-decoration:none">&#9654;&#65039; Watch the walkthrough</a>`,
    );
  }

  return authEmailShell({
    siteLogoUrl,
    title: OPERATOR_FIRST_TOUR_HOWTO_SUBJECT,
    paragraphs,
    ctaLabel: 'Add your first tour',
    ctaUrl: addTourUrl,
    footnote: `<a href="${guideUrl}" style="color:#4B5563;font-weight:600;text-decoration:underline">Read the step-by-step guide</a>`,
    optOutUrl,
  });
}
