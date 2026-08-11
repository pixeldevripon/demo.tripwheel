import { authEmailShell, escapeHtml } from './auth-email-shell';

/**
 * INT-1 "New operator" - the internal alert to the sales pipeline
 * (SALES_EMAIL, ADMIN_EMAIL fallback) the moment an operator row is created.
 * Content is LOCKED by the onboarding wireframe (stage mint): a facts table
 * plus ONE dark "Review in admin" button. Deliberately NO approve action in
 * the email itself - link scanners click, and approval is an admin-SSO
 * action that must stay audit-logged behind the dashboard.
 */

export interface OperatorSignupInternalTemplateProps {
  /** Company name when known, else the signatory's name. */
  operatorName: string;
  signatoryName: string;
  email: string;
  /** E.164 phone / WhatsApp; row omitted when absent. */
  phone?: string | null;
  /** KvK registration; row omitted when absent (not captured at sign-up yet). */
  kvk?: string | null;
  /** Operator-row creation instant (the "accepted" moment). */
  acceptedAt: Date;
  /** Agreement version tag when the acceptance flow records one. */
  agreementVersion?: string | null;
  /** Dashboard deep link: /tour-operators/{id}/edit. */
  reviewUrl: string;
  siteLogoUrl?: string | null;
}

/**
 * Internal-table row in the wireframe's exact style. Values pre-escaped.
 * The trailing space in the label cell and the newline between rows are for
 * the shell's PLAIN-TEXT part, which strips tags without inserting spacing -
 * both are invisible in the rendered HTML.
 */
function factRow(label: string, value: string): string {
  return `<tr><td style="padding:4px 0;color:#6B7280">${label} </td><td style="padding:4px 0;text-align:right;font-weight:600">${value}</td></tr>`;
}

/** Wireframe format: "Jul 9, 2026, 14:32" in the sales team's timezone. */
export function formatInternalTimestamp(at: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Curacao',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at);
}

export function operatorSignupInternalSubject(operatorName: string): string {
  return `New operator: ${operatorName}`;
}

export function operatorSignupInternalTemplate({
  operatorName,
  signatoryName,
  email,
  phone,
  kvk,
  acceptedAt,
  agreementVersion,
  reviewUrl,
  siteLogoUrl,
}: OperatorSignupInternalTemplateProps) {
  const accepted = agreementVersion
    ? `${formatInternalTimestamp(acceptedAt)} · Agreement ${escapeHtml(agreementVersion)}`
    : formatInternalTimestamp(acceptedAt);

  const rows = [
    factRow('Signatory', escapeHtml(signatoryName)),
    factRow('Email', escapeHtml(email)),
    ...(phone ? [factRow('Phone / WhatsApp', escapeHtml(phone))] : []),
    ...(kvk ? [factRow('KvK Curaçao', escapeHtml(kvk))] : []),
    factRow('Accepted', accepted),
  ].join('\n');

  return authEmailShell({
    siteLogoUrl,
    title: `New operator: ${escapeHtml(operatorName)}`,
    paragraphs: [
      `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:13.5px;color:#374151">${rows}</table>`,
    ],
    ctaLabel: 'Review in admin',
    ctaUrl: reviewUrl,
    // Internal family: dark button, never the brand orange (wireframe).
    ctaBackground: '#1F2937',
    footnote:
      'Internal alert · approval is one click on the operator page. Never forward - it contains contact details.',
  });
}
