import { authEmailShell, escapeHtml } from './auth-email-shell';

/**
 * OB-2 "Welcome + agreement" - the transactional welcome the moment the
 * operator row is created (the wireframe's `accepted` state; it fires
 * together with INT-1 to the sales pipeline). Copy is LOCKED by the
 * onboarding wireframe (stage m2). The add-a-tour CTA deliberately lives in
 * OB-2A, not here - approval gates that page (founder decision July 9).
 *
 * Agreement delivery is hosted-link-only for now (founder decision D4
 * pending): the send path already carries WP-A's `attachments` option, so
 * attaching the version-pinned PDF later is a caller change, not a template
 * change. When no `agreementUrl` is configured the link sentence degrades to
 * the acceptance line alone rather than shipping a dead anchor.
 */

export interface OperatorWelcomeAgreementTemplateProps {
  /** Signatory's first name - wireframe greeting is "Welcome, {firstName}." */
  firstName?: string;
  /** Operator-row creation instant - the wireframe's accepted {date}. */
  acceptedAt: Date;
  /** Agreement version tag when the acceptance flow records one ("1.0"). */
  agreementVersion?: string | null;
  /** Hosted agreement URL; the link line is omitted when absent (D4). */
  agreementUrl?: string | null;
  /** Monitored support mailbox for the "Questions?" line (MAIL_REPLY_TO). */
  supportEmail?: string | null;
  /** wa.me deep link (SiteInfo); the WhatsApp mention is plain when absent. */
  whatsappUrl?: string | null;
  siteLogoUrl?: string | null;
}

export const OPERATOR_WELCOME_AGREEMENT_SUBJECT = "You're on Island Tours.";

/** Wireframe date format: "July 9, 2026". */
function formatAcceptedDate(at: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Curacao',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(at);
}

export function operatorWelcomeAgreementTemplate({
  firstName,
  acceptedAt,
  agreementVersion,
  agreementUrl,
  supportEmail,
  whatsappUrl,
  siteLogoUrl,
}: OperatorWelcomeAgreementTemplateProps) {
  // Wireframe callout: "We're checking your registration" - inline-styled to
  // the confirmation-email tinted-callout constants (design constants block).
  const callout =
    `<span style="display:block;background:#FBF1EA;border-left:4px solid #E8611A;border-radius:10px;padding:15px 17px">` +
    `<span style="display:block;font-size:14px;font-weight:600;color:#9a4a16;margin-bottom:6px">We're checking your registration </span>` +
    `<span style="display:block;font-size:14px;color:#5b3a22;line-height:1.55">A quick check of your registration, usually within one business day. You'll get one email the moment you're approved, then you can add your first tour.</span>` +
    `</span>`;

  const acceptedLine = agreementVersion
    ? `You accepted version ${escapeHtml(agreementVersion)} on ${formatAcceptedDate(acceptedAt)}.`
    : `You accepted the Operator Agreement on ${formatAcceptedDate(acceptedAt)}.`;
  const agreementBody = agreementUrl
    ? `${acceptedLine} Your copy always lives at the link below.<br> <a href="${agreementUrl}" style="color:#1F2937;font-weight:600">Read your agreement</a>`
    : acceptedLine;
  const agreementBlock =
    `<span style="display:block;background:#F8F8F6;border:1px solid #EAE7E1;border-radius:10px;padding:13px 16px">` +
    `<span style="display:block;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;margin-bottom:5px">Your Operator Agreement </span>` +
    `<span style="display:block;font-size:13px;color:#4B5563;line-height:1.55">${agreementBody}</span>` +
    `</span>`;

  const emailLink = supportEmail
    ? `<a href="mailto:${supportEmail}" style="color:#1F2937;font-weight:600">Email</a>`
    : 'Email';
  const whatsappLink = whatsappUrl
    ? `<a href="${whatsappUrl}" style="color:#1F2937;font-weight:600">WhatsApp us</a>`
    : 'WhatsApp us';

  return authEmailShell({
    siteLogoUrl,
    title: firstName ? `Welcome, ${escapeHtml(firstName)}.` : 'Welcome.',
    paragraphs: [
      'Your operator account is live. You run the tours, we bring the travelers, and that starts with your first tour page.',
      callout,
      agreementBlock,
    ],
    footnote: `Questions? ${emailLink} or ${whatsappLink}. Every day, 08:00 to 20:00, Sundays too.`,
  });
}
