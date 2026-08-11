import { authEmailShell } from './auth-email-shell';

/**
 * OB-7 "Connect your calendar" - the live+3d lifecycle nudge, gated on the
 * CALENDAR_SYNC_AVAILABLE feature flag and suppressed when a calendar feed is
 * already connected (both evaluated by the sweeper at send time, never here).
 * Copy is LOCKED by the onboarding wireframe (stage m7).
 */

export interface OperatorConnectCalendarTemplateProps {
  /** Dashboard calendar screen - "Connect my calendar". */
  connectUrl: string;
  /** WP-A unsubscribe token link - lifecycle footer (D-10). */
  optOutUrl: string;
  siteLogoUrl?: string | null;
}

export const OPERATOR_CONNECT_CALENDAR_SUBJECT = 'Connect your calendar';

export function operatorConnectCalendarTemplate({
  connectUrl,
  optOutUrl,
  siteLogoUrl,
}: OperatorConnectCalendarTemplateProps) {
  return authEmailShell({
    siteLogoUrl,
    title: OPERATOR_CONNECT_CALENDAR_SUBJECT,
    paragraphs: [
      'Keeping your availability current by hand works fine: one tap a day. But if your booking system or website can share its calendar, we can connect it, and closed dates sync themselves. No double bookings, nothing to remember.',
      "Our developer sets it up together with yours: check with your developer first, then message us and we'll make the connection.",
    ],
    ctaLabel: 'Connect my calendar',
    ctaUrl: connectUrl,
    footnote:
      'No booking system? Manual is fine. One tap a day keeps everything current.',
    optOutUrl,
  });
}
