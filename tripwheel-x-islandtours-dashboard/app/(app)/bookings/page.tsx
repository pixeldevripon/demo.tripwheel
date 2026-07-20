import { BookingsPageView } from '@/components/common/bookings-page-view';

/**
 * A synchronous shell on purpose. The role branch (customer vs admin/operator
 * framing) reads `RoleProvider` on the client, so this page performs no data
 * fetch and its RSC payload is static - the sidebar click commits at once and
 * the table streams its own rows behind `loading.tsx` + TanStack Query.
 */
/**
 * NOT opted into `unstable_instant` - and the reason is worth keeping.
 *
 * This page itself is clean: fully synchronous, zero awaits, so a sidebar
 * click between dashboard routes re-renders only this segment and commits
 * immediately (layouts are preserved across sibling navigations, so the auth
 * layout does not re-run).
 *
 * But `unstable_instant: { prefetch: 'static' }` validates a stricter
 * property - a static shell at EVERY entry point, including a cold load of
 * this URL, where the layout must render. `app/(app)/layout.tsx` nests
 * `{children}` inside an async component that awaits `headers()` +
 * `getUserProfile()`, so validation fails here with INSTANT_VALIDATION_ERROR
 * pointing at `layout.tsx:36`. Verified: neither `unstable_instant = false`
 * on the layout nor scoping with `from: [...]` suppresses it.
 *
 * Enabling it requires lifting `{children}` out of the auth-awaiting subtree,
 * which means `RoleProvider` can no longer wrap children synchronously. Do
 * that first, then add the export here.
 */
export default function BookingsPage() {
    return <BookingsPageView />;
}
