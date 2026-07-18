import { authEmailShell, escapeHtml } from './auth-email-shell';

export interface EmailVerificationTemplateProps {
  verifyUrl: string;
  /** Dashboard-managed logo URL; text-logo fallback when absent. */
  siteLogoUrl?: string | null;
  name?: string;
}

/**
 * Email-address verification email (sent on sign-in until verified). Rendered
 * through the shared auth shell so it matches the booking-confirmation family
 * verbatim.
 */
export function emailVerificationTemplate({
  verifyUrl,
  siteLogoUrl,
  name,
}: EmailVerificationTemplateProps) {
  return authEmailShell({
    siteLogoUrl,
    title: 'Verify your email address.',
    greeting: name ? `Hi ${escapeHtml(name)},` : 'Hello,',
    paragraphs: [
      'Confirm this is your email address to secure your Island Tours account and finish signing in.',
    ],
    ctaLabel: 'Verify email address',
    ctaUrl: verifyUrl,
    footnote:
      "Didn't create an Island Tours account? You can safely ignore this email.",
  });
}
