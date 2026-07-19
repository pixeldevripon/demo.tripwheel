import { authEmailShell, escapeHtml } from './auth-email-shell';

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
    ? ` as <b style="color:#1F2937">${escapeHtml(roleLabel)}</b>`
    : '';

  const title =
    variant === 'platform'
      ? "You're invited to join the Island Tours team."
      : companyName
        ? `You're invited to join ${escapeHtml(companyName)}'s team.`
        : "You're invited to join your team on Island Tours.";

  const intro =
    variant === 'platform'
      ? `An Island Tours administrator has invited you to the Island Tours team${asRole}. Set your password to get started, then log in to the staff dashboard.`
      : `${companyName ? escapeHtml(companyName) : 'Your team'} has invited you to their team on Island Tours${asRole}. Set your password to get started, then log in to the team dashboard.`;

  return authEmailShell({
    siteLogoUrl,
    title,
    greeting: name ? `Hi ${escapeHtml(name)},` : 'Hello,',
    paragraphs: [
      intro,
      'The link expires in <b style="color:#1F2937">1 hour</b>.',
    ],
    ctaLabel: 'Set your password',
    ctaUrl: inviteUrl,
    footnote:
      variant === 'platform'
        ? 'Link expired? Ask an administrator to resend your invite, or open the login page and choose "Forgot password?".'
        : 'Link expired? Ask the account owner to resend your invite, or open the portal login and choose "Forgot password?".',
  });
}
