import { authEmailShell, escapeHtml } from './auth-email-shell';

export interface PasswordChangeConfirmationTemplateProps {
  confirmUrl: string;
  name?: string;
  /** How long the link stays valid, already humanised (e.g. "1 hour"). */
  expiresInLabel: string;
  /** Dashboard-managed logo URL; text-logo fallback when absent. */
  siteLogoUrl?: string | null;
}

/**
 * Step 2 of the two-factor password change: the current password was already
 * verified in the dashboard, so whoever asked knows the password - this email
 * proves they also hold the mailbox. The stored password is untouched until
 * this link is used.
 */
export function passwordChangeConfirmationTemplate({
  confirmUrl,
  name,
  expiresInLabel,
  siteLogoUrl,
}: PasswordChangeConfirmationTemplateProps) {
  return authEmailShell({
    siteLogoUrl,
    title: 'Confirm your new password.',
    greeting: name ? `Hi ${escapeHtml(name)},` : undefined,
    paragraphs: [
      'We received a request to change the password on your Island Tours account.',
      '<b style="color:#1F2937">Your password has not changed yet.</b> It only changes once you confirm below, and you will be signed out everywhere when it does.',
      `The link expires in <b style="color:#1F2937">${escapeHtml(expiresInLabel)}</b>.`,
    ],
    ctaLabel: 'Confirm password change',
    ctaUrl: confirmUrl,
    footnote:
      "Didn't request this? Ignore this email - your current password keeps working and nothing changes. Someone may know your password though, so sign in and change it yourself if you are unsure.",
  });
}
