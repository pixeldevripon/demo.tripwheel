'use client';

import { CalendarFeedsForm } from './calendar-feeds-form';

/**
 * Operator settings. iCal sync is the whole page today.
 *
 * "Your Business" (the operator's own company info) left on 2026-07-28 for
 * `/profile`, and Payments (`OperatorPaymentsForm`) is still parked. The
 * signpost card that replaced them is gone too (2026-07-29): once the page had
 * real content again, a full-width card whose only job was to say the content
 * had moved elsewhere was just something to scroll past.
 *
 * Kept as its own component rather than inlining `CalendarFeedsForm` into
 * `SettingsClient` because this is the seam where the operator page regrows -
 * when payments ships, restore the `EntityTabs` wrapper here (see git history
 * for the two-tab version); the form component itself is untouched.
 *
 * No operator-record guard: the calendar-feeds routes take no `operatorId` and
 * resolve the caller's operator server-side (team seats included), so there is
 * nothing here that a missing `user.operator` would invalidate.
 */
export function OperatorSettings() {
    return <CalendarFeedsForm />;
}

