import { escapeHtml } from './auth-email-shell';
import {
  operatorEmailShell,
  type OperatorFactRow,
} from './operator-email-shell';
import { formatInternalTimestamp } from './internal-email.util';

/**
 * INT1R "Still pending" - the ONE reminder to the sales pipeline when an
 * operator has been PENDING for more than 2 business days (wireframe flow
 * table, INT-1 row: "Reminder once after 2 business days pending"). Fired by
 * the lifecycle sweep, which stamps `salesPendingReminderAt` so it can never
 * repeat.
 *
 * INT1R has NO wireframe card of its own - only a row in the flow table - so
 * its copy is build-invented and is deliberately left as it was. What changes
 * here is only the chrome: it now wears the internal family's shell (the
 * "· Internal" logo, the facts table, ONE dark "Review in admin" button, no
 * footer) so it cannot drift from INT-1, which does have a card.
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
}: OperatorPendingReminderTemplateProps) {
  const rows: OperatorFactRow[] = [
    { label: 'Signatory', valueHtml: escapeHtml(signatoryName) },
    { label: 'Email', valueHtml: escapeHtml(email) },
    ...(phone
      ? [{ label: 'Phone / WhatsApp', valueHtml: escapeHtml(phone) }]
      : []),
    { label: 'Accepted', valueHtml: formatInternalTimestamp(acceptedAt) },
  ];

  return operatorEmailShell({
    title: operatorPendingReminderSubject(operatorName),
    preheader: 'INT-1R · to sales@island.tours · still awaiting a decision',
    blocks: [
      { kind: 'logo', variant: 'internal' },
      { kind: 'headline', text: operatorPendingReminderSubject(operatorName) },
      {
        kind: 'paragraph',
        html: 'This operator signed up more than 2 business days ago and is still waiting for a verification decision. One click on the operator page approves or rejects them.',
      },
      { kind: 'facts', rows },
      {
        kind: 'button',
        label: 'Review in admin',
        url: reviewUrl,
        tone: 'dark',
      },
      {
        kind: 'muted',
        html: 'Internal reminder · sent once per operator. Never forward - it contains contact details.',
      },
    ],
    footer: { variant: 'none' },
  });
}
