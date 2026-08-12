import { escapeHtml } from './auth-email-shell';
import { operatorEmailShell, operatorInlineLink } from './operator-email-shell';

/**
 * OB-2 "Welcome + agreement" - the transactional welcome the moment the
 * operator row is created (the wireframe's `accepted` state; it fires
 * together with INT-1 to the sales pipeline). Copy is LOCKED by the
 * onboarding wireframe (stage m2). The add-a-tour CTA deliberately lives in
 * OB-2A, not here - approval gates that page (founder decision July 9).
 *
 * Block order (wireframe): logo · headline · paragraph · callout · quiet panel
 * · muted line. There is no button at all.
 *
 * ATTACHMENT GAP: the wireframe's agreement sentence says the copy "is
 * attached as a PDF". No PDF is generated yet (founder decision D4), and the
 * caller passes `agreementVersion`/`agreementUrl` as null in production, so
 * that clause only renders on the branch that also has a hosted link. When D4
 * lands, the send path already carries WP-A's `attachments` option — attaching
 * the version-pinned PDF is a CALLER change, not a template change.
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
}: OperatorWelcomeAgreementTemplateProps) {
  const acceptedLine = agreementVersion
    ? `You accepted version ${escapeHtml(agreementVersion)} on ${formatAcceptedDate(acceptedAt)}.`
    : `You accepted the Operator Agreement on ${formatAcceptedDate(acceptedAt)}.`;
  // The wireframe reads "… Your copy is attached as a PDF, and it always lives
  // at the link below." No PDF exists — founder decision D4 never supplied one.
  // Founder decision 2026-08-12: LINK to the policy page, do not promise an
  // attachment. The PDF clause is dropped and the hosted page carries the job.
  //
  // This is the one deliberate wording deviation from the operator wireframe,
  // and it is the honest direction: "attached" with nothing attached is a
  // support ticket at best, and at worst a false claim about a contract the
  // operator has just accepted.
  //
  // With no PUBLISHED agreement page there is no "link below" either, so the
  // sentence degrades to the acceptance line alone rather than promising an
  // anchor that is not there.
  const agreementBody = agreementUrl
    ? `${acceptedLine} Your copy always lives at the link below.<br>${operatorInlineLink(agreementUrl, 'Read your agreement')}`
    : acceptedLine;

  const emailLink = supportEmail
    ? operatorInlineLink(`mailto:${supportEmail}`, 'Email')
    : 'Email';
  const whatsappLink = whatsappUrl
    ? operatorInlineLink(whatsappUrl, 'WhatsApp us')
    : 'WhatsApp us';

  return operatorEmailShell({
    title: OPERATOR_WELCOME_AGREEMENT_SUBJECT,
    preheader:
      "Your agreement copy is inside. We're checking your registration.",
    blocks: [
      { kind: 'logo' },
      {
        kind: 'headline',
        text: firstName ? `Welcome, ${firstName}.` : 'Welcome.',
      },
      {
        kind: 'paragraph',
        html: 'Your operator account is live. You run the tours, we bring the travelers, and that starts with your first tour page.',
      },
      {
        kind: 'callout',
        heading: "We're checking your registration",
        bodyHtml:
          "A quick check of your registration, usually within one business day. You'll get one email the moment you're approved, then you can add your first tour.",
        // Wireframe stage m2 pins the callout's top margin to 0 - it follows
        // the paragraph directly.
        marginTop: 0,
      },
      {
        kind: 'quiet',
        heading: 'Your Operator Agreement',
        bodyHtml: agreementBody,
      },
      {
        kind: 'muted',
        html: `Questions? ${emailLink} or ${whatsappLink}. Every day, 08:00 to 20:00, Sundays too.`,
      },
    ],
    footer: { variant: 'transactional' },
  });
}
