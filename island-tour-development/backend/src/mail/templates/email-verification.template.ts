import { authEmailShell, escapeHtml } from './auth-email-shell';

export interface EmailVerificationTemplateProps {
  verifyUrl: string;
  /** Dashboard-managed logo URL; text-logo fallback when absent. */
  siteLogoUrl?: string | null;
  name?: string;
  /**
   * 'account' = ordinary address verification (sent on sign-in until
   * verified). 'email-change' = step 2 of the change-email flow: this exact
   * email goes to the NEW address after the old inbox approved the change,
   * so the copy must explain that opening it completes the switch.
   */
  variant?: 'account' | 'email-change';
}

/**
 * Email-address verification email. Rendered through the shared auth shell so
 * it matches the booking-confirmation family verbatim. The change-email flow
 * reuses this template with the 'email-change' variant.
 */
export function emailVerificationTemplate({
  verifyUrl,
  siteLogoUrl,
  name,
  variant = 'account',
}: EmailVerificationTemplateProps) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hello,';

  if (variant === 'email-change') {
    return authEmailShell({
      siteLogoUrl,
      title: 'Confirm your new email address.',
      greeting,
      paragraphs: [
        'You asked to move your Island Tours sign-in email to this address, and the request was approved from your current inbox. Confirm below to complete the change.',
        'Until you confirm, you keep signing in with your current email.',
      ],
      ctaLabel: 'Confirm new email',
      ctaUrl: verifyUrl,
      footnote:
        "Didn't request this change? You can safely ignore this email - your sign-in email stays as it is.",
    });
  }

  return authEmailShell({
    siteLogoUrl,
    title: 'Verify your email address.',
    greeting,
    paragraphs: [
      'Confirm this is your email address to secure your Island Tours account and finish signing in.',
    ],
    ctaLabel: 'Verify email address',
    ctaUrl: verifyUrl,
    footnote:
      "Didn't create an Island Tours account? You can safely ignore this email.",
  });
}
