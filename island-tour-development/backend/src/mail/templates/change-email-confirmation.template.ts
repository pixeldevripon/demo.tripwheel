import { authEmailShell, EMAIL_EMPHASIS, escapeHtml } from './auth-email-shell';

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
      `You asked to move your sign-in email to <span style="${EMAIL_EMPHASIS}">${escapeHtml(newEmail)}</span>.`,
      `Approve below and we'll send a verification link there. Your email changes only once that link is opened. This one expires in <span style="${EMAIL_EMPHASIS}">1 hour</span>.`,
    ],
    ctaLabel: 'Approve email change',
    ctaUrl: confirmUrl,
    footnote:
      "Didn't request this? Ignore this email and nothing changes. If you think someone else has your password, reset it.",
  });
}
