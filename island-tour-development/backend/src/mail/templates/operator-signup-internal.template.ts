import { authEmailShell, escapeHtml } from './auth-email-shell';
import {
  INTERNAL_CTA_BACKGROUND,
  factRow,
  formatInternalTimestamp,
  internalFactsTable,
} from './internal-email.util';

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
  ];

  return authEmailShell({
    siteLogoUrl,
    title: `New operator: ${escapeHtml(operatorName)}`,
    paragraphs: [internalFactsTable(rows)],
    ctaLabel: 'Review in admin',
    ctaUrl: reviewUrl,
    // Internal family: dark button, never the brand orange (wireframe).
    ctaBackground: INTERNAL_CTA_BACKGROUND,
    footnote:
      'Internal alert · approval is one click on the operator page. Never forward - it contains contact details.',
  });
}
