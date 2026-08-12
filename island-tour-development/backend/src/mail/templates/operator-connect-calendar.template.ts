import { operatorEmailShell } from './operator-email-shell';

/**
 * OB-7 "Connect your calendar" - the live+3d lifecycle nudge, gated on the
 * CALENDAR_SYNC_AVAILABLE feature flag and suppressed when a calendar feed is
 * already connected (both evaluated by the sweeper at send time, never here).
 * Copy is LOCKED by the onboarding wireframe (stage m7).
 *
 * Block order: logo · headline · two paragraphs · CTA · muted line.
 */

export interface OperatorConnectCalendarTemplateProps {
  /** Dashboard calendar screen - "Connect my calendar". */
  connectUrl: string;
  /** WP-A unsubscribe token link - lifecycle footer (D-10). */
  optOutUrl: string;
}

export const OPERATOR_CONNECT_CALENDAR_SUBJECT = 'Connect your calendar';

export function operatorConnectCalendarTemplate({
  connectUrl,
  optOutUrl,
}: OperatorConnectCalendarTemplateProps) {
  return operatorEmailShell({
    title: OPERATOR_CONNECT_CALENDAR_SUBJECT,
    preheader: 'Manual works. Connected never forgets.',
    blocks: [
      { kind: 'logo' },
      { kind: 'headline', text: OPERATOR_CONNECT_CALENDAR_SUBJECT },
      {
        kind: 'paragraph',
        html: 'Keeping your availability current by hand works fine: one tap a day. But if your booking system or website can share its calendar, we can connect it, and closed dates sync themselves. No double bookings, nothing to remember.',
      },
      {
        kind: 'paragraph',
        html: "Our developer sets it up together with yours: check with your developer first, then message us and we'll make the connection.",
      },
      { kind: 'button', label: 'Connect my calendar', url: connectUrl },
      {
        kind: 'muted',
        html: 'No booking system? Manual is fine. One tap a day keeps everything current.',
      },
    ],
    footer: { variant: 'lifecycle', optOutUrl },
  });
}
