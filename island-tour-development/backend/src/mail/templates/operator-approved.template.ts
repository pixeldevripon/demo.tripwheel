import { authEmailShell, EMAIL_EMPHASIS, escapeHtml } from './auth-email-shell';

/**
 * OB-2A "You're approved" - the transactional email an operator gets the
 * moment an admin approves their verification (the ONE admin click that
 * unlocks tour creation). Copy is LOCKED by the onboarding wireframe
 * (technical-doc/emails/island-tours-operator-onboarding-emails-wireframe.html,
 * stage m2a); this send anchors the OB-3/OB-4/OB-6 nudges that WP-D builds.
 *
 * Rides the shared auth shell: the wireframe's "Your dashboard, in short"
 * quiet block becomes the footnote slot (same copy, shell-native structure).
 */

export interface OperatorApprovedTemplateProps {
  /** Signatory's first name - wireframe greeting is "Good news, {firstName}." */
  firstName?: string;
  /** Company name when onboarding filled it; falls back to the contact name. */
  companyName: string;
  /** Dashboard deep link to the create-tour wizard (/trips/new). */
  addTourUrl: string;
  /** Dashboard root - the "Open your dashboard" link. */
  dashboardUrl: string;
  siteLogoUrl?: string | null;
}

export const OPERATOR_APPROVED_SUBJECT =
  "You're approved. Add your first tour.";

export function operatorApprovedTemplate({
  firstName,
  companyName,
  addTourUrl,
  dashboardUrl,
  siteLogoUrl,
}: OperatorApprovedTemplateProps) {
  return authEmailShell({
    siteLogoUrl,
    title: firstName ? `Good news, ${escapeHtml(firstName)}.` : 'Good news.',
    paragraphs: [
      `<span style="${EMAIL_EMPHASIS}">${escapeHtml(companyName)}</span> is approved on Island Tours. Time for the fun part: your first tour page.`,
    ],
    ctaLabel: 'Add your first tour',
    ctaUrl: addTourUrl,
    footnote: `<span style="${EMAIL_EMPHASIS}">Your dashboard, in short</span><br>Bookings the moment they land, availability in one tap, your tour pages in one place. <a href="${dashboardUrl}" style="color:#4B5563">Open your dashboard</a>.`,
  });
}
