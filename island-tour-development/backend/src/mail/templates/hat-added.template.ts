import { authEmailShell, escapeHtml } from './auth-email-shell';

export interface HatAddedTemplateProps {
  /** Which identity was attached to the existing account. */
  variant: 'platform' | 'team' | 'operator';
  /** Designation / seat label, e.g. "Manager"; omitted when unknown. */
  roleLabel?: string | null;
  /** Inviting operator's company (team variant); Island Tours otherwise. */
  companyName?: string | null;
  /** The door the new identity signs in through. */
  loginUrl: string;
  name?: string;
  /** Dashboard-managed logo URL; text-logo fallback when absent. */
  siteLogoUrl?: string | null;
}

/** Who the email says did the adding - shared by the body and the subject. */
function inviterName(
  variant: HatAddedTemplateProps['variant'],
  companyName?: string | null,
): string {
  return variant === 'team' && companyName ? companyName : 'Island Tours';
}

/** Subject line, kept beside the body copy so the two can never drift. */
export function hatAddedSubject(
  params: Pick<HatAddedTemplateProps, 'variant' | 'companyName' | 'roleLabel'>,
): string {
  if (params.variant === 'operator') {
    return 'Your Island Tours account is now a tour operator account';
  }
  return `${inviterName(params.variant, params.companyName)} added you to their team${params.roleLabel ? ` as ${params.roleLabel}` : ''}`;
}

/**
 * Sent when a staff/operator identity is attached to an email that already
 * has an account WITH a password (one account, many hats). Unlike the invite
 * family this carries no set-password link - the person keeps signing in with
 * their existing credentials, just through the new door.
 */
export function hatAddedTemplate({
  variant,
  roleLabel,
  companyName,
  loginUrl,
  name,
  siteLogoUrl,
}: HatAddedTemplateProps) {
  const inviter = escapeHtml(inviterName(variant, companyName));
  const asRole = roleLabel
    ? ` as <b style="color:#1F2937">${escapeHtml(roleLabel)}</b>`
    : '';
  const what =
    variant === 'operator'
      ? `Your email now also holds a <b style="color:#1F2937">tour operator</b> account with ${inviter}.`
      : `${inviter} added you to their team${asRole}.`;

  return authEmailShell({
    siteLogoUrl,
    title: 'A new role was added to your account.',
    greeting: name ? `Hi ${escapeHtml(name)},` : undefined,
    paragraphs: [
      what,
      'You already have an Island Tours account with this email, so there is no new password to set - sign in with your existing email and password.',
    ],
    ctaLabel: 'Sign in',
    ctaUrl: loginUrl,
    footnote:
      "Not expecting this? Contact the person who added you, or our support team, and we'll sort it out.",
  });
}
