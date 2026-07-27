import { authEmailShell, escapeHtml } from './auth-email-shell';

export interface ChangeEmailConfirmationTemplateProps {
  confirmUrl: string;
  /** The address the account wants to move to (shown, HTML-escaped). */
  newEmail: string;
  name?: string;
  /** Dashboard-managed logo URL; text-logo fallback when absent. */
  siteLogoUrl?: string | null;
}

/**
 * Step 1 of the two-mailbox email change: sent to the CURRENT address to
 * approve moving the account to `newEmail`. Approving triggers the standard
 * verification email to the new address; only then does the email change.
 */
export function changeEmailConfirmationTemplate({
  confirmUrl,
  newEmail,
  name,
  siteLogoUrl,
}: ChangeEmailConfirmationTemplateProps) {
  return authEmailShell({
    siteLogoUrl,
    title: 'Confirm your email change.',
    greeting: name ? `Hi ${escapeHtml(name)},` : undefined,
    paragraphs: [
      `We received a request to change your Island Tours sign-in email to <b style="color:#1F2937">${escapeHtml(newEmail)}</b>.`,
      'If this was you, confirm below. We will then send a verification link to the new address, and your email only changes after that link is opened.',
      'The link expires in <b style="color:#1F2937">1 hour</b>.',
    ],
    ctaLabel: 'Approve email change',
    ctaUrl: confirmUrl,
    footnote:
      "Didn't request this? Ignore this email and your sign-in email stays unchanged. If you suspect someone else has access to your account, reset your password.",
  });
}
