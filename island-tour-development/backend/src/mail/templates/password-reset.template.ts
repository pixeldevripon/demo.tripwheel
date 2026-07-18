import { authEmailShell } from './auth-email-shell';

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
      'We received a request to reset your Island Tours password.',
      'The link expires in <b style="color:#1F2937">1 hour</b>.',
    ],
    ctaLabel: 'Reset password',
    ctaUrl: resetUrl,
    footnote:
      "Didn't request this? You can safely ignore this email - your password stays unchanged.",
  });
}
