import { authEmailShell, escapeHtml } from './auth-email-shell';

export interface CustomerWelcomeTemplateProps {
  inviteUrl: string;
  /** Dashboard-managed logo URL; text-logo fallback when absent. */
  siteLogoUrl?: string | null;
  name?: string;
}

/**
 * Traveler "your booking created an account" welcome email with the secure
 * set-password link. Rendered through the shared auth shell so it matches the
 * operator/staff invite family verbatim. Sent ONLY when a booking provisions
 * a brand-new Role.USER account (see CustomerProvisioningService) - never for
 * genuine forgot-password requests, which use the generic reset template.
 */
export function customerWelcomeTemplate({
  inviteUrl,
  siteLogoUrl,
  name,
}: CustomerWelcomeTemplateProps) {
  return authEmailShell({
    siteLogoUrl,
    title: 'Your Island Tours account is ready.',
    greeting: name ? `Hi ${escapeHtml(name)},` : 'Hello,',
    paragraphs: [
      'Your booking created a personal Island Tours account. Set a password to see all your bookings, payments and receipts in one place - and manage your details any time.',
      'The link expires in <b style="color:#1F2937">1 hour</b>.',
      'No password needed for your trip: the links in your booking confirmation keep working as they are.',
    ],
    ctaLabel: 'Set your password',
    ctaUrl: inviteUrl,
    footnote:
      'Link expired? Open the account login and choose "Forgot password?" to request a fresh one.',
  });
}
