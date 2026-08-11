import { authEmailShell, escapeHtml } from './auth-email-shell';
import {
  INTERNAL_CTA_BACKGROUND,
  factRow,
  formatInternalTimestamp,
  internalFactsTable,
} from './internal-email.util';

/**
 * INT1R "Still pending" - the ONE reminder to the sales pipeline when an
 * operator has been PENDING for more than 2 business days (wireframe flow
 * table, INT-1 row: "Reminder once after 2 business days pending"). Fired by
 * the lifecycle sweep, which stamps `salesPendingReminderAt` so it can never
 * repeat. Same internal family rules as INT-1: facts table, ONE dark
 * "Review in admin" button, never an approve action inside the email.
 */

export interface OperatorPendingReminderTemplateProps {
  /** Company name when known, else the signatory's name. */
  operatorName: string;
  signatoryName: string;
  email: string;
  /** E.164 phone / WhatsApp; row omitted when absent. */
  phone?: string | null;
  /** Operator-row creation instant (the "accepted" moment). */
  acceptedAt: Date;
  /** Dashboard deep link: /tour-operators/{id}/edit. */
  reviewUrl: string;
  siteLogoUrl?: string | null;
}

export function operatorPendingReminderSubject(operatorName: string): string {
  return `Still pending: ${operatorName}`;
}

export function operatorPendingReminderTemplate({
  operatorName,
  signatoryName,
  email,
  phone,
  acceptedAt,
  reviewUrl,
  siteLogoUrl,
}: OperatorPendingReminderTemplateProps) {
  const rows = [
    factRow('Signatory', escapeHtml(signatoryName)),
    factRow('Email', escapeHtml(email)),
    ...(phone ? [factRow('Phone / WhatsApp', escapeHtml(phone))] : []),
    factRow('Accepted', formatInternalTimestamp(acceptedAt)),
  ];

  return authEmailShell({
    siteLogoUrl,
    title: `Still pending: ${escapeHtml(operatorName)}`,
    paragraphs: [
      'This operator signed up more than 2 business days ago and is still waiting for a verification decision. One click on the operator page approves or rejects them.',
      internalFactsTable(rows),
    ],
    ctaLabel: 'Review in admin',
    ctaUrl: reviewUrl,
    ctaBackground: INTERNAL_CTA_BACKGROUND,
    footnote:
      'Internal reminder · sent once per operator. Never forward - it contains contact details.',
  });
}
