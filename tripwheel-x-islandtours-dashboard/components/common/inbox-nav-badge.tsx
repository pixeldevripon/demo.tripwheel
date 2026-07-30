'use client';

import { useInboxSummary } from '@/hooks/inbox/use-inbox';
import type { InboxCategory } from '@/types/inbox';

/**
 * Unread count for one nav row.
 *
 * Registered into the SAME `NAV_BADGES` map the work-queue badges use, so a row
 * can only ever carry one number. That constraint is the point:
 *
 * Rows that already had a queue badge - cancellation requests, reviews,
 * spotlight - keep it. A queue badge counts OPEN WORK ("3 reviews awaiting
 * moderation"); an unread badge counts things you have not looked at. On the
 * same row they disagree constantly: read the notification and the unread count
 * drops while the work still sits there. The queue number is the truthful one,
 * so it wins, and those categories reach the operator through the bell instead.
 *
 * Every badge shares one polled query (`useInboxSummary`), so mounting six of
 * these costs one request, not six - and they cannot disagree with the bell.
 */
export function InboxNavBadge({ category }: { category: InboxCategory }) {
    const { data } = useInboxSummary();
    const count = data?.byCategory?.[category] ?? 0;
    if (count === 0) return null;
    return (
        <span className='ml-auto rounded-full bg-primary-subtle px-1.5 text-2xs font-medium tabular-nums text-primary-subtle-content'>
            {count > 99 ? '99+' : count}
        </span>
    );
}
