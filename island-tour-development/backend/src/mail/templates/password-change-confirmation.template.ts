import { authEmailShell, EMAIL_EMPHASIS, escapeHtml } from './auth-email-shell';

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
      `<span style="${EMAIL_EMPHASIS}">Your password has not changed yet.</span> It changes only once you confirm below, and you'll be signed out everywhere when it does.`,
      `The link expires in <span style="${EMAIL_EMPHASIS}">${escapeHtml(expiresInLabel)}</span>.`,
    ],
    ctaLabel: 'Confirm password change',
    ctaUrl: confirmUrl,
    footnote:
      "Didn't request this? Ignore this email - your current password keeps working. Someone may know it though, so sign in and change it yourself if you're unsure.",
  });
}
