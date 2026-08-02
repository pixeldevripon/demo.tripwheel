import type { EmailTemplateContext } from '@/mail/templates/email-template.renderer';

/**
 * The email copy for calendar sync, as pure functions.
 *
 * Separate from the service for the same reason `block-mapper.util.ts` is: copy
 * is what changes most often and is what most benefits from being assertable
 * without standing up Prisma, the reconciler and the inbox. The service decides
 * WHETHER to send; this decides what the operator reads.
 *
 * ## Why these three and no more
 * Email is interruptive, so it is spent only where the operator has to do
 * something we cannot do for them:
 *
 * - **Conflict** - a channel sold time we have also sold. Nobody but a human can
 *   work out which booking is real, and it may mean phoning a traveller.
 * - **Broken** - dates have silently stopped updating. The fix (a fresh link) is
 *   entirely theirs, and until they make it the connection is decorative.
 * - **Recovered** - closes the loop. Without it, an operator who fixed a link has
 *   no way to know it took, and the honest ones keep checking.
 *
 * A routine successful sync gets no email. It is the normal case, it happens up
 * to 96 times a day per connection, and the dashboard bell plus the sync history
 * already record it.
 */

/** Everything the copy needs about a connection. No Prisma types - keeps this pure. */
export interface CalendarMailSubscription {
  tourId: string;
  tourName: string;
  /** Already resolved to a display name ("Airbnb", or a custom label). */
  channelLabel: string;
}

export interface CalendarMailContext {
  subscription: CalendarMailSubscription;
  /** Dashboard origin, no trailing slash. */
  dashboardBaseUrl: string;
  siteLogoUrl: string;
  emailIconBase: string;
}

export interface CalendarMail {
  subject: string;
  context: EmailTemplateContext;
}

/**
 * The notice shell renders a booking header (reference / date / time). A
 * calendar alert has none of those, so they are deliberately blanked rather than
 * filled with placeholder text - the template omits empty rows, and inventing a
 * fake reference would be worse than showing nothing.
 */
function base(
  ctx: CalendarMailContext,
  noticeTitle: string,
  paragraphs: string[],
  ctaLabel: string,
): EmailTemplateContext {
  return {
    noticeTitle,
    bookingRef: '',
    tourName: ctx.subscription.tourName,
    dateLong: '',
    startTime: '',
    noticeParagraphs: paragraphs,
    ctaUrl: `${ctx.dashboardBaseUrl}/trips/${ctx.subscription.tourId}/edit?step=schedule`,
    ctaLabel,
    siteLogoUrl: ctx.siteLogoUrl,
    emailIconBase: ctx.emailIconBase,
  };
}

/**
 * A channel marked time busy that we have already sold.
 *
 * The first paragraph exists to stop a panic: closing a date never cancels
 * anybody, and an operator who thinks we just cancelled travellers will phone
 * support before reading paragraph two.
 */
export function conflictMail(
  ctx: CalendarMailContext,
  freshConflicts: number,
): CalendarMail {
  const { channelLabel, tourName } = ctx.subscription;
  const plural = freshConflicts === 1 ? 'departure' : 'departures';

  return {
    subject: `${channelLabel} overlaps ${freshConflicts} booked ${plural} - ${tourName}`,
    context: base(
      ctx,
      `${channelLabel} is busy on time you have sold.`,
      [
        `${channelLabel} reports it is busy on ${freshConflicts} ${plural} of ${tourName} that already have seats sold here.`,
        'No traveller has been cancelled and no booking has changed. This is a warning, not an action we have taken on your behalf.',
        `Check whether the same seats were sold twice - once on ${channelLabel} and once here. If they were, contact the traveller you cannot carry before they travel.`,
      ],
      'Review the departures',
    ),
  };
}

/**
 * The feed stopped working.
 *
 * Sent ONCE, on the transition into a broken state - never on each rung of the
 * retry ladder. Paragraph one answers the question the operator actually has
 * ("am I about to be double-booked?") before explaining the fault, because the
 * answer is reassuring and burying it is how alerts get ignored.
 */
export function failureMail(
  ctx: CalendarMailContext,
  reason: string,
): CalendarMail {
  const { channelLabel, tourName } = ctx.subscription;

  return {
    subject: `${channelLabel} calendar stopped syncing - ${tourName}`,
    context: base(
      ctx,
      `We cannot read your ${channelLabel} calendar.`,
      [
        `The dates it had already blocked on ${tourName} are still blocked, so you are not at risk of a double booking right now.`,
        `What has stopped is the updates: new reservations on ${channelLabel} will not close dates here until the link works again.`,
        `The reason we were given: ${reason}`,
        `Calendar links expire and get regenerated. Copy a fresh export link from ${channelLabel} and paste it in, and we will start syncing again immediately.`,
      ],
      'Fix the connection',
    ),
  };
}

/**
 * The feed works again.
 *
 * The counterpart to `failureMail`, and the reason the failure email can be
 * sent once rather than repeatedly: an operator who is told when it breaks AND
 * when it recovers never has to poll the dashboard to find out which state they
 * are in.
 */
export function recoveryMail(ctx: CalendarMailContext): CalendarMail {
  const { channelLabel, tourName } = ctx.subscription;

  return {
    subject: `${channelLabel} calendar is syncing again - ${tourName}`,
    context: base(
      ctx,
      `Your ${channelLabel} calendar is back.`,
      [
        `We read ${channelLabel} successfully, so ${tourName} is up to date with that channel again.`,
        'Any dates that were booked there while the link was down have been applied in this sync.',
      ],
      'View the schedule',
    ),
  };
}
