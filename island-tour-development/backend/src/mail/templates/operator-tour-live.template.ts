import { operatorEmailShell } from './operator-email-shell';

/**
 * OB-5 "Your tour is live" - transactional, fired instantly off the
 * `operator.first-tour-live` outbox event, once per operator (first live
 * tour only). Copy is LOCKED by the onboarding wireframe (stage m5). It
 * introduces the availability habit ONCE; the recurring freshness nudge
 * belongs to the availability dev spec and never rides this template.
 *
 * Block order: logo · headline · paragraph · CTA · callout · secondary link.
 * The callout sits BELOW the CTA — the page comes first, the habit second.
 */

export interface OperatorTourLiveTemplateProps {
  /** The first live tour's name - operator-authored, escaped by the shell. */
  tourName: string;
  /** Public tour page URL - "See your live page". */
  tourUrl: string;
  /** Dashboard availability screen - "Open your availability". */
  availabilityUrl: string;
}

export function operatorTourLiveSubject(tourName: string): string {
  return `Your tour is live: ${tourName}`;
}

export function operatorTourLiveTemplate({
  tourName,
  tourUrl,
  availabilityUrl,
}: OperatorTourLiveTemplateProps) {
  return operatorEmailShell({
    title: operatorTourLiveSubject(tourName),
    preheader: 'See your page, then keep your calendar current.',
    blocks: [
      { kind: 'logo' },
      { kind: 'headline', text: `${tourName} is live.` },
      {
        kind: 'paragraph',
        html: 'Travelers can book it right now. Take a look at your page, this is what they see.',
      },
      { kind: 'button', label: 'See your live page', url: tourUrl },
      {
        kind: 'callout',
        heading: 'Keep your availability current',
        bodyHtml:
          "A day full, or not running? Close that date in the portal, one tap. Travelers can only book what's really open, so you never get a booking you can't take.",
        // Wireframe stage m5 pins a 16px top margin here: the callout follows
        // the CTA, so it needs the breathing room the CTA's own margin cannot
        // supply.
        marginTop: 16,
      },
      {
        kind: 'secondary',
        label: 'Open your availability',
        url: availabilityUrl,
      },
    ],
    footer: { variant: 'transactional' },
  });
}
