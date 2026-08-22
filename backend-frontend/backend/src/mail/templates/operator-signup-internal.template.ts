import { escapeHtml } from './auth-email-shell';
import {
  operatorEmailShell,
  type OperatorFactRow,
} from './operator-email-shell';
import { formatInternalTimestamp } from './internal-email.util';

/**
 * INT-1 "New operator" - the internal alert to the sales pipeline
 * (SALES_EMAIL, ADMIN_EMAIL fallback) the moment an operator row is created.
 * Content is LOCKED by the onboarding wireframe (stage mint, first card): the
 * "· Internal" logo suffix, a facts table, and ONE dark "Review in admin"
 * button. Deliberately NO approve action in the email itself - link scanners
 * click, and approval is an admin-SSO action that must stay audit-logged
 * behind the dashboard.
 *
 * NO FOOTER: the wireframe's internal cards end at the button. Sender identity
 * and an unsubscribe are for people who did not ask to be on a list; sales@
 * did.
 *
 * MISSING ROW: the wireframe also shows a "CRM · Match: Irie Tours (Live
 * operators)" row. No CRM integration exists, so the row is omitted rather
 * than faked. Adding it is a call-site change (the lookup belongs in
 * OperatorsService, not in a template).
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
}: OperatorSignupInternalTemplateProps) {
  // The wireframe reads "Agreement v1.0". The `v` belongs to the VERSION
  // STRING, not to this template — callers pass "v1.0" verbatim, so prefixing
  // here would render "vv1.0". (Both call sites pass null today: no acceptance
  // record stores a version yet, which is why the suffix never appears in
  // production.)
  const accepted = agreementVersion
    ? `${formatInternalTimestamp(acceptedAt)} · Agreement ${escapeHtml(agreementVersion)}`
    : formatInternalTimestamp(acceptedAt);

  // `valueHtml` may carry markup, so operator-supplied values are escaped here.
  const rows: OperatorFactRow[] = [
    { label: 'Signatory', valueHtml: escapeHtml(signatoryName) },
    { label: 'Email', valueHtml: escapeHtml(email) },
    ...(phone
      ? [{ label: 'Phone / WhatsApp', valueHtml: escapeHtml(phone) }]
      : []),
    ...(kvk ? [{ label: 'KvK Curaçao', valueHtml: escapeHtml(kvk) }] : []),
    { label: 'Accepted', valueHtml: accepted },
  ];

  return operatorEmailShell({
    title: operatorSignupInternalSubject(operatorName),
    preheader: 'INT-1 · to sales@island.tours · Review in admin',
    blocks: [
      { kind: 'logo', variant: 'internal' },
      { kind: 'headline', text: operatorSignupInternalSubject(operatorName) },
      { kind: 'facts', rows },
      // Dark, never the brand orange: operational mail must not read as
      // marketing (wireframe design constants).
      {
        kind: 'button',
        label: 'Review in admin',
        url: reviewUrl,
        tone: 'dark',
      },
    ],
    footer: { variant: 'none' },
  });
}
