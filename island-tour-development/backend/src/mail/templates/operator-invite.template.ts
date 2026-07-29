import { authEmailShell, EMAIL_EMPHASIS, escapeHtml } from './auth-email-shell';

export interface OperatorInviteTemplateProps {
  inviteUrl: string;
  /** Dashboard-managed logo URL; text-logo fallback when absent. */
  siteLogoUrl?: string | null;
  name?: string;
}

/**
 * Admin-invite "set your password" email. Rendered through the shared auth
 * shell so it matches the booking-confirmation family verbatim.
 */
export function operatorInviteTemplate({
  inviteUrl,
  siteLogoUrl,
  name,
}: OperatorInviteTemplateProps) {
  return authEmailShell({
    siteLogoUrl,
    title: "You're invited as a tour operator.",
    greeting: name ? `Hi ${escapeHtml(name)},` : 'Hello,',
    paragraphs: [
      'An Island Tours administrator created a tour operator account for you. Set your password to get started, then sign in to finish your onboarding.',
      `The link expires in <span style="${EMAIL_EMPHASIS}">1 hour</span>.`,
    ],
    ctaLabel: 'Set your password',
    ctaUrl: inviteUrl,
    footnote:
      'Link expired? Open the operator login and choose "Forgot password?" for a fresh one.',
  });
}
