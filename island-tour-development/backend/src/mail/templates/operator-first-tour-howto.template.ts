import {
  operatorEmailShell,
  type OperatorEmailBlock,
} from './operator-email-shell';

/**
 * OB-3 "Your first tour, step by step" - the +48h-after-approval lifecycle
 * nudge, sent only while the operator has submitted zero tours. Copy is
 * LOCKED by the onboarding wireframe (stage m3).
 *
 * The walkthrough block ALTERNATES (wireframe Q1/Q2): the Loom card when
 * `WALKTHROUGH_VIDEO_URL` is configured, the guide link alone otherwise. Video
 * never embeds in email - the card is a link that opens Loom.
 *
 * Block order: logo · headline · paragraph · Loom card · CTA · secondary link.
 * The Loom card sits BEFORE the CTA, not after it.
 */

export interface OperatorFirstTourHowtoTemplateProps {
  /** Dashboard deep link to the create-tour wizard. */
  addTourUrl: string;
  /** Step-by-step guide link - "Read the step-by-step guide". */
  guideUrl: string;
  /** Loom URL (WALKTHROUGH_VIDEO_URL); the card is omitted when absent. */
  walkthroughVideoUrl?: string | null;
  /**
   * The wireframe caption is "Watch the walkthrough · {duration}" — a merge
   * variable, so the runtime value comes from config alongside the URL. When
   * it is unset the separator and duration are dropped rather than rendering a
   * dangling "· " next to nothing.
   */
  walkthroughDuration?: string | null;
  /** WP-A unsubscribe token link - lifecycle footer (D-10). */
  optOutUrl: string;
}

export const OPERATOR_FIRST_TOUR_HOWTO_SUBJECT =
  'Your first tour, step by step';

export function operatorFirstTourHowtoTemplate({
  addTourUrl,
  guideUrl,
  walkthroughVideoUrl,
  walkthroughDuration,
  optOutUrl,
}: OperatorFirstTourHowtoTemplateProps) {
  const walkthrough: OperatorEmailBlock[] = walkthroughVideoUrl
    ? [
        {
          kind: 'loom',
          url: walkthroughVideoUrl,
          duration: walkthroughDuration?.trim() || '',
        },
      ]
    : [];

  return operatorEmailShell({
    title: OPERATOR_FIRST_TOUR_HOWTO_SUBJECT,
    preheader: 'A short walkthrough, start to finish.',
    blocks: [
      { kind: 'logo' },
      { kind: 'headline', text: OPERATOR_FIRST_TOUR_HOWTO_SUBJECT },
      {
        kind: 'paragraph',
        html: 'Your tour page starts as a short form: your overview, facts, photos, prices, availability, and departure times. You fill it in, we give it a final check, and your page goes live.',
      },
      ...walkthrough,
      { kind: 'button', label: 'Add your first tour', url: addTourUrl },
      {
        kind: 'secondary',
        label: 'Read the step-by-step guide',
        url: guideUrl,
      },
    ],
    footer: { variant: 'lifecycle', optOutUrl },
  });
}
