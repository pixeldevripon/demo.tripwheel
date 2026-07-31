import {
    Calendar01Icon,
    Calendar03Icon,
    CalendarCheckIn01Icon,
    CalendarRemove01Icon,
    Coins01Icon,
    CreditCardIcon,
    DashboardSquare01Icon,
    File02Icon,
    FilterHorizontalIcon,
    Globe02Icon,
    Home01Icon,
    Building06Icon,
    Image02Icon,
    Layers01Icon,
    MapsIcon,
    RouteIcon,
    Settings02Icon,
    SparklesIcon,
    StarIcon,
    Store01Icon,
    Tag01Icon,
    TranslateIcon,
    UserGroupIcon,
} from '@hugeicons/core-free-icons';

import { Permission } from '@/lib/config/rbac';
import type { NavGroup } from '@/lib/rbac-utils';

/**
 * Dashboard navigation - four groups by TASK FREQUENCY, not entity type
 * (04 §1.2). An operator opens Bookings every morning and Attributes never;
 * a flat list makes those equally prominent, which is the defect this
 * structure replaces.
 *
 * Per-role IA falls out of permission filtering (04 §1.3): an operator holds
 * none of the Curate/Configure permissions, so those GROUPS disappear with
 * their contents - never greyed, absent. Group headers must never render
 * over an empty section (filterNavGroups enforces this).
 *
 * `permissions` values must exactly match the `Permission` keys in
 * lib/config/rbac.ts. Labels say "Tours" (backend + master doc vocabulary);
 * routes stay /trips until the G-6 rename ships.
 */
const dashboardNav: NavGroup[] = [
    {
        // Daily. The operator's morning screen-set.
        label: 'Operate',
        items: [
            {
                title: 'Overview',
                url: '',
                icon: DashboardSquare01Icon,
                permissions: [Permission.VIEW_ANALYTICS],
            },
            {
                // THE daily habit (matrix v1.6, availability review §3.3):
                // every departure across all the operator's tours, one list,
                // one-tap close. Setup stays under Tours.
                title: 'Availability',
                url: 'availability',
                icon: CalendarCheckIn01Icon,
                // ANY-of: a stop-sell-only dock seat sees the agenda too.
                permissions: [
                    Permission.MANAGE_AVAILABILITY,
                    Permission.STOP_SELL,
                ],
            },
            {
                title: 'Bookings',
                url: 'bookings',
                icon: Calendar03Icon,
                permissions: [Permission.VIEW_BOOKINGS],
            },
            {
                // The global Month/Week/Day management calendar. Lived as a
                // glyph in the site header until 2026-07-31 (founder sketch:
                // navigation belongs in the sidebar, not the header chrome).
                // Same ANY-of gate as Availability - a stop-sell-only seat
                // can close/reopen from the calendar too.
                title: 'Calendar',
                url: 'calendar',
                icon: Calendar01Icon,
                permissions: [
                    Permission.MANAGE_AVAILABILITY,
                    Permission.STOP_SELL,
                ],
            },
            {
                title: 'Cancellations',
                url: 'cancellation-requests',
                icon: CalendarRemove01Icon,
                permissions: [Permission.VIEW_BOOKINGS],
            },
            {
                // A daily inbox, the same shape as Cancellations and Spotlight:
                // three queues, one pattern. Operators see it too, scoped by the
                // backend to their own tours (read + flag only).
                title: 'Reviews',
                url: 'reviews',
                icon: StarIcon,
                permissions: [Permission.VIEW_REVIEWS],
            },
            {
                // Who has booked, and who still owes a review. Operators see it
                // too, scoped by the BACKEND to their own customers - the same
                // actor-scoped rule the queues above follow.
                title: 'Customers',
                url: 'customers',
                icon: UserGroupIcon,
                permissions: [Permission.VIEW_USERS],
            },
            {
                title: 'Payments',
                url: 'payments',
                icon: CreditCardIcon,
                permissions: [Permission.VIEW_PAYMENTS],
            },
            {
                title: 'Settlements',
                url: 'settlements',
                icon: Coins01Icon,
                permissions: [Permission.VIEW_PAYMENTS],
            },
        ],
    },
    {
        // Weekly. The operator's own inventory.
        // Translations joins this group when its console ships (04 §3).
        label: 'Catalog',
        items: [
            {
                title: 'Tours',
                url: 'trips',
                icon: MapsIcon,
                permissions: [Permission.VIEW_TRIPS],
            },
            {
                title: 'Media',
                url: 'media',
                icon: Image02Icon,
                permissions: [Permission.UPLOAD_MEDIA, Permission.MANAGE_MEDIA],
            },
            {
                // The single largest operator workload finally has a home
                // (04 §1.2, §3): entity × locale matrix + workspace.
                title: 'Translations',
                url: 'translations',
                icon: TranslateIcon,
                permissions: [Permission.VIEW_TRIPS],
            },
        ],
    },
    {
        // Admin, weekly. Marketplace curation.
        label: 'Curate',
        items: [
            {
                title: 'Destinations',
                url: 'destinations',
                icon: Globe02Icon,
                permissions: [
                    Permission.VIEW_DESTINATIONS,
                    Permission.CREATE_DESTINATION,
                ],
            },
            {
                title: 'Hubs',
                url: 'hubs',
                icon: RouteIcon,
                permissions: [Permission.MANAGE_HUBS],
            },
            {
                title: 'Categories',
                url: 'categories',
                icon: Tag01Icon,
                permissions: [Permission.CREATE_CATEGORY],
            },
            {
                title: 'Collections',
                url: 'collections',
                icon: Layers01Icon,
                permissions: [
                    Permission.VIEW_COLLECTIONS,
                    Permission.CREATE_COLLECTION,
                ],
            },
            {
                title: 'Spotlight',
                url: 'spotlight',
                icon: SparklesIcon,
                permissions: [Permission.APPROVE_SPOTLIGHT],
            },
            {
                title: "Locals' Favourites",
                url: 'locals-favourites',
                icon: StarIcon,
                permissions: [Permission.MANAGE_EDITORIAL],
            },
            {
                // Our OWN places to stay, promoted on the thank-you page. They
                // sit under Pages rather than Curate for the same reason the
                // homepage does: this is "what does this page say", not "which
                // marketplace entities do we push". They are also not operator
                // listings - they never enter search, ranking or booking - so
                // they belong nowhere near Tours.
                title: 'Hotels',
                url: 'hotels',
                icon: Building06Icon,
                permissions: [Permission.MANAGE_EDITORIAL],
            },
        ],
    },
    {
        // Admin, rarely. Platform configuration.
        label: 'Configure',
        items: [
            {
                title: 'Attributes',
                url: 'attributes',
                icon: FilterHorizontalIcon,
                permissions: [Permission.MANAGE_SYSTEM],
            },
            {
                title: 'Tour Operators',
                url: 'tour-operators',
                icon: Store01Icon,
                permissions: [Permission.MANAGE_OPERATORS],
            },
        ],
    },
    {
        // Admin, rarely. THE SITE'S OWN PAGES - the homepage plus, from Phase 5,
        // the legal/marketing pages. Grouped by what they ARE (a page you edit)
        // rather than by permission: Curate is "which marketplace entities do we
        // push", this is "what does this page say".
        label: 'Pages',
        items: [
            {
                title: 'Homepage',
                url: 'homepage',
                icon: Home01Icon,
                permissions: [Permission.MANAGE_EDITORIAL],
            },
            {
                // The Pages system: legal/policy permalinks (terms,
                // privacy-policy, ...) edited through the TipTap editor.
                title: 'Pages',
                url: 'pages',
                icon: File02Icon,
                permissions: [Permission.MANAGE_EDITORIAL],
            },
        ],
    },
    {
        // Both roles. The operator's ACCOUNT group (04 §1.3); for admins it
        // rounds out Configure without burying Settings under admin-only
        // permissions.
        label: 'Account',
        items: [
            {
                // One route, two audiences: admins manage PLATFORM staff +
                // designations (MANAGE_STAFF); operator owners manage their
                // own team seats (MANAGE_TEAM). Non-owner seats hold neither,
                // so the item disappears for them. Labeled "Users" for now
                // (owner decision) - the module is still Staff & Teams.
                title: 'Users',
                url: 'users',
                icon: UserGroupIcon,
                permissions: [Permission.MANAGE_STAFF, Permission.MANAGE_TEAM],
            },
            {
                // Admin-only between 2026-07-28 and 2026-07-29: "Your Business"
                // (EDIT_OPERATOR_PROFILE) had moved to /profile and Payments
                // (MANAGE_OPERATOR_PAYMENTS) was parked, so the page had
                // nothing left for operators and the link was a dead end.
                // iCal sync (MANAGE_AVAILABILITY) gave it operator content
                // again, so operators are back. Restore
                // MANAGE_OPERATOR_PAYMENTS here too when payments ships.
                title: 'Settings',
                url: 'settings',
                icon: Settings02Icon,
                permissions: [
                    Permission.VIEW_SETTINGS,
                    Permission.MANAGE_SETTINGS,
                    Permission.MANAGE_AVAILABILITY,
                ],
            },
            /*             {
                title: 'Your Profile',
                url: 'profile',
                icon: UserCircleIcon,
                permissions: [Permission.VIEW_PROFILE],
            }, */
        ],
    },

    // Enquiries and Leads stay deleted: the master doc's model is "book
    // instantly, no enquiry model". Reviews shipped 2026-07-22 and now sits in
    // Operate above. "Users" above is the Staff & Teams module.
];

// The customer (Role.USER) nav lived here until 2026-07-28. Travellers now
// have their own account area on the public site (/{locale}/traveller), so
// this app serves operators, staff and admins only.

export interface NavigationMap {
    dashboard: NavGroup[];
}

export function getNavigations(): NavigationMap {
    return { dashboard: dashboardNav };
}


