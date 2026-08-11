import { authEmailShell, escapeHtml } from './auth-email-shell';

/**
 * OB-5 "Your tour is live" - transactional, fired instantly off the
 * `operator.first-tour-live` outbox event, once per operator (first live
 * tour only). Copy is LOCKED by the onboarding wireframe (stage m5). It
 * introduces the availability habit ONCE; the recurring freshness nudge
 * belongs to the availability dev spec and never rides this template.
 */

export interface OperatorTourLiveTemplateProps {
  /** The first live tour's name - operator-authored, escaped here. */
  tourName: string;
  /** Public tour page URL - "See your live page". */
  tourUrl: string;
  /** Dashboard availability screen - "Open your availability". */
  availabilityUrl: string;
  siteLogoUrl?: string | null;
}

export function operatorTourLiveSubject(tourName: string): string {
  return `Your tour is live: ${tourName}`;
}

export function operatorTourLiveTemplate({
  tourName,
  tourUrl,
  availabilityUrl,
  siteLogoUrl,
}: OperatorTourLiveTemplateProps) {
  // Wireframe callout: the availability habit, tinted like the confirmation
  // family's callouts.
  const habitCallout =
    `<span style="display:block;background:#FBF1EA;border-left:4px solid #E8611A;border-radius:10px;padding:15px 17px">` +
    `<span style="display:block;font-size:14px;font-weight:600;color:#9a4a16;margin-bottom:6px">Keep your availability current </span>` +
    `<span style="display:block;font-size:14px;color:#5b3a22;line-height:1.55">A day full, or not running? Close that date in the portal, one tap. Travelers can only book what's really open, so you never get a booking you can't take.</span>` +
    `</span>`;

  return authEmailShell({
    siteLogoUrl,
    title: `${escapeHtml(tourName)} is live.`,
    paragraphs: [
      'Travelers can book it right now. Take a look at your page, this is what they see.',
      habitCallout,
    ],
    ctaLabel: 'See your live page',
    ctaUrl: tourUrl,
    footnote: `<a href="${availabilityUrl}" style="color:#4B5563;font-weight:600;text-decoration:underline">Open your availability</a>`,
  });
}
