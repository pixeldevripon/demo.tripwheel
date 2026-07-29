import { authEmailShell, EMAIL_EMPHASIS } from './auth-email-shell';

export interface PasswordResetTemplateProps {
  resetUrl: string;
  /** Dashboard-managed logo URL; text-logo fallback when absent. */
  siteLogoUrl?: string | null;
}

/**
 * "Forgot password" email. Rendered through the shared auth shell so it
 * matches the booking-confirmation family verbatim.
 */
export function passwordResetTemplate({
  resetUrl,
  siteLogoUrl,
}: PasswordResetTemplateProps) {
  return authEmailShell({
    siteLogoUrl,
    title: 'Reset your password.',
    paragraphs: [
      `Set a new Island Tours password below. The link expires in <span style="${EMAIL_EMPHASIS}">1 hour</span>.`,
    ],
    ctaLabel: 'Reset password',
    ctaUrl: resetUrl,
    footnote:
      "Didn't request this? Ignore this email - your password stays unchanged.",
  });
}
