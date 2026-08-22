/**
 * The review-request timing bounds, mirrored from the backend's
 * UpdateReviewRequestsDto - ONE dashboard owner so the email-centre
 * switchboard and Settings → Review Requests cannot drift (review of #57,
 * Low 5). A backend bounds change edits exactly this file.
 */
export const REVIEW_REQUEST_BOUNDS = {
    firstSendLocalHour: { min: 0, max: 23 },
    firstSendDelayDays: { min: 0, max: 14 },
    reminderAfterDays: { min: 1, max: 30 },
    giveUpAfterDays: { min: 1, max: 180 },
} as const;

/** "10:00" for hour 10 - the shared hour formatter. */
export function clockLabel(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
}
