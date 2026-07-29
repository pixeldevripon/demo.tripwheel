import { authEmailShell } from './auth-email-shell';

export interface TravellerLoginCodeTemplateProps {
  /** The six-digit one-time code. */
  code: string;
  /** How long it stays valid, already humanised (e.g. "10 minutes"). */
  expiresInLabel: string;
  /** Dashboard-managed logo URL; text-logo fallback when absent. */
  siteLogoUrl?: string | null;
}

/**
 * The traveller account-area sign-in code.
 *
 * On the AUTH shell, not the booking-notice one it used to borrow. This is a
 * credential email - it belongs with password reset and email verification, not
 * with the booking family - and the notice shell it shared with the
 * cancellation ack forced the code into a body sentence between a tour name and
 * a departure date it has nothing to do with. Here the code IS the email.
 *
 * No CTA: the traveller is already sitting on the login screen waiting to type
 * this in, so a button back to a page they are looking at is noise.
 */
export function travellerLoginCodeTemplate({
  code,
  expiresInLabel,
  siteLogoUrl,
}: TravellerLoginCodeTemplateProps) {
  return authEmailShell({
    siteLogoUrl,
    title: 'Your sign-in code.',
    paragraphs: ['Enter this code to open your Island Tours bookings.'],
    code,
    codeNote: `Expires in ${expiresInLabel} · single use`,
    footnote:
      "Didn't ask to sign in? Ignore this email - nobody can reach your bookings without this code.",
  });
}
