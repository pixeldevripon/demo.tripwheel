/**
 * Whole business days (Mon-Fri) elapsed between a timestamp and now, in the
 * viewer's local timezone. Used by the verification queue's "days pending"
 * column: the INT1R sales reminder fires at 2 business days, so a row at or
 * past that threshold is highlighted as overdue.
 */
export const PENDING_BUSINESS_DAY_THRESHOLD = 2;

export function businessDaysSince(
    iso: string | Date,
    now: Date = new Date(),
): number {
    const start = new Date(iso);
    if (isNaN(start.getTime())) return 0;
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(0, 0, 0, 0);

    let count = 0;
    const cursor = new Date(start);
    while (cursor < end) {
        cursor.setDate(cursor.getDate() + 1);
        const day = cursor.getDay();
        if (day !== 0 && day !== 6) count++;
    }
    return count;
}
