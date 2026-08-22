import { authEmailShell, EMAIL_EMPHASIS, escapeHtml } from './auth-email-shell';

export interface StaffInviteTemplateProps {
  inviteUrl: string;
  /** Dashboard-managed logo URL; text-logo fallback when absent. */
  siteLogoUrl?: string | null;
  name?: string;
  /** 'platform' = Island Tours' own staff; 'team' = an operator's team seat. */
  variant: 'platform' | 'team';
  /** What they were invited as: designation name, or the seat-role label. */
  roleLabel?: string | null;
  /** Team variant only: the inviting operator's company name. */
  companyName?: string | null;
}

/**
 * Staff/team-seat "set your password" invite. Same shared auth shell as the
 * operator invite, but the copy is DYNAMIC: it names who is inviting (Island
 * Tours vs the operator's company) and what the person was invited as
 * (designation or seat role) - an invite must never claim the wrong role.
 */
export function staffInviteTemplate({
  inviteUrl,
  siteLogoUrl,
  name,
  variant,
  roleLabel,
  companyName,
}: StaffInviteTemplateProps) {
  const asRole = roleLabel
    ? ` as <span style="${EMAIL_EMPHASIS}">${escapeHtml(roleLabel)}</span>`
    : '';

  const title =
    variant === 'platform'
      ? "You're invited to join the Island Tours team."
      : companyName
        ? `You're invited to join ${escapeHtml(companyName)}'s team.`
        : "You're invited to join your team on Island Tours.";

  const intro =
    variant === 'platform'
      ? `An Island Tours administrator invited you to the Island Tours team${asRole}. Set your password to get started, then sign in to the staff dashboard.`
      : `${companyName ? escapeHtml(companyName) : 'Your team'} invited you to their team on Island Tours${asRole}. Set your password to get started, then sign in to the team dashboard.`;

  return authEmailShell({
    siteLogoUrl,
    title,
    greeting: name ? `Hi ${escapeHtml(name)},` : 'Hello,',
    paragraphs: [
      intro,
      `The link expires in <span style="${EMAIL_EMPHASIS}">1 hour</span>.`,
    ],
    ctaLabel: 'Set your password',
    ctaUrl: inviteUrl,
    footnote:
      variant === 'platform'
        ? 'Link expired? Ask an administrator to resend it, or choose "Forgot password?" on the login page.'
        : 'Link expired? Ask the account owner to resend it, or choose "Forgot password?" on the portal login.',
  });
}
