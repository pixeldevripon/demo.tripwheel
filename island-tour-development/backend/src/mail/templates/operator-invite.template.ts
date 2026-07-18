import { authEmailShell, escapeHtml } from './auth-email-shell';

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
      'An Island Tours administrator has created a tour operator account for you. Set your password to get started, then log in to complete your onboarding.',
      'The link expires in <b style="color:#1F2937">1 hour</b>.',
    ],
    ctaLabel: 'Set your password',
    ctaUrl: inviteUrl,
    footnote:
      'Link expired? Open the operator portal login and choose "Forgot password?" to request a fresh one.',
  });
}
