import type { InboxCategory } from '@/types/inbox';

/**
 * Category labels and the nav sections they badge.
 *
 * `navTitle` must match the `title` of a `NavItem` in the sidebar tree - that
 * string is the join key between an unread count and the row it appears on. A
 * category with no matching nav item simply shows no badge; it still counts
 * toward the bell, so nothing is ever lost, only less visible.
 */
export const INBOX_CATEGORY_META: Record<
    InboxCategory,
    { label: string; navTitle: string | null }
> = {
    TOURS: { label: 'Tours', navTitle: 'Trips' },
    BOOKINGS: { label: 'Bookings', navTitle: 'Bookings' },
    CANCELLATIONS: { label: 'Cancellations', navTitle: 'Cancellations' },
    PAYMENTS: { label: 'Payments', navTitle: 'Payments' },
    REVIEWS: { label: 'Reviews', navTitle: 'Reviews' },
    SETTLEMENTS: { label: 'Settlements', navTitle: 'Settlements' },
    PROMOTION: { label: 'Promotion', navTitle: null },
    TEAM: { label: 'Team', navTitle: 'Team' },
    SYSTEM: { label: 'System', navTitle: null },
};

/**
 * "3 minutes ago" for a bell that is read at a glance.
 *
 * Deliberately not a date library: this is eight lines, and the list only ever
 * shows recent items - anything older than a week reads as a date anyway.
 */
export function relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const seconds = Math.round((Date.now() - then) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
    });
}
