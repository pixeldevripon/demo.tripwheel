import { escapeHtml } from './auth-email-shell';
import { operatorEmailShell, operatorInlineLink } from './operator-email-shell';

/**
 * OB-2A "You're approved" - the transactional email an operator gets the
 * moment an admin approves their verification (the ONE admin click that
 * unlocks tour creation). Copy is LOCKED by the onboarding wireframe
 * (technical-doc/emails/island-tours-operator-onboarding-emails-wireframe.html,
 * stage m2a); this send anchors the OB-3/OB-4/OB-6 nudges that WP-D builds.
 *
 * Block order: logo · headline · paragraph · CTA · quiet panel. The quiet
 * panel sits AFTER the button here (it does not in OB-8), which is why block
 * order is a caller decision.
 *
 * The company name is PLAIN body text: the wireframe sets no emphasis on it,
 * and bolding a merge variable is how a template starts drifting from a design.
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
}

export const OPERATOR_APPROVED_SUBJECT =
  "You're approved. Add your first tour.";

export function operatorApprovedTemplate({
  firstName,
  companyName,
  addTourUrl,
  dashboardUrl,
}: OperatorApprovedTemplateProps) {
  return operatorEmailShell({
    title: OPERATOR_APPROVED_SUBJECT,
    preheader: 'Your first tour page starts here.',
    blocks: [
      { kind: 'logo' },
      {
        kind: 'headline',
        text: firstName ? `Good news, ${firstName}.` : 'Good news.',
      },
      {
        kind: 'paragraph',
        // `paragraph.html` carries markup by contract, so the operator-authored
        // company name is escaped here.
        html: `${escapeHtml(companyName)} is approved on Island Tours. Time for the fun part: your first tour page.`,
      },
      { kind: 'button', label: 'Add your first tour', url: addTourUrl },
      {
        kind: 'quiet',
        heading: 'Your dashboard, in short',
        // Wireframe: the link is on its own line after a <br>, with NO trailing
        // period.
        bodyHtml: `Bookings the moment they land, availability in one tap, your tour pages in one place.<br>${operatorInlineLink(dashboardUrl, 'Open your dashboard')}`,
      },
    ],
    footer: { variant: 'transactional' },
  });
}
