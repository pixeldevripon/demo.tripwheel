import {
    Calendar,
    CalendarX,
    CircleUser,
    CreditCard,
    Globe,
    ImageIcon,
    LayoutDashboard,
    Map,
    Settings,
    SlidersHorizontal,
    Sparkles,
    Star,
    Store,
    Tag,
    Layers,
    Waypoints,
} from 'lucide-react';

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
                icon: LayoutDashboard,
                permissions: [Permission.VIEW_ANALYTICS],
            },
            {
                title: 'Bookings',
                url: 'bookings',
                icon: Calendar,
                permissions: [Permission.VIEW_BOOKINGS],
            },
            {
                title: 'Cancellations',
                url: 'cancellation-requests',
                icon: CalendarX,
                permissions: [Permission.VIEW_BOOKINGS],
            },
            {
                title: 'Payments',
                url: 'payments',
                icon: CreditCard,
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
                icon: Map,
                permissions: [Permission.VIEW_TRIPS],
            },
            {
                title: 'Media',
                url: 'media',
                icon: ImageIcon,
                permissions: [
                    Permission.UPLOAD_MEDIA,
                    Permission.MANAGE_MEDIA,
                ],
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
                icon: Globe,
                permissions: [
                    Permission.VIEW_DESTINATIONS,
                    Permission.CREATE_DESTINATION,
                ],
            },
            {
                title: 'Hubs',
                url: 'hubs',
                icon: Waypoints,
                permissions: [Permission.MANAGE_HUBS],
            },
            {
                title: 'Categories',
                url: 'categories',
                icon: Tag,
                permissions: [Permission.CREATE_CATEGORY],
            },
            {
                title: 'Collections',
                url: 'collections',
                icon: Layers,
                permissions: [
                    Permission.VIEW_COLLECTIONS,
                    Permission.CREATE_COLLECTION,
                ],
            },
            {
                title: 'Spotlight',
                url: 'spotlight',
                icon: Sparkles,
                permissions: [Permission.APPROVE_SPOTLIGHT],
            },
            {
                title: "Locals' Favourites",
                url: 'locals-favourites',
                icon: Star,
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
                icon: SlidersHorizontal,
                permissions: [Permission.MANAGE_SYSTEM],
            },
            {
                title: 'Tour Operators',
                url: 'tour-operators',
                icon: Store,
                permissions: [Permission.MANAGE_OPERATORS],
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
                title: 'Settings',
                url: 'settings',
                icon: Settings,
                permissions: [
                    Permission.VIEW_SETTINGS,
                    Permission.MANAGE_SETTINGS,
                    Permission.EDIT_OPERATOR_PROFILE,
                    Permission.MANAGE_OPERATOR_PAYMENTS,
                ],
            },
            {
                title: 'Your Profile',
                url: 'profile',
                icon: CircleUser,
                permissions: [Permission.VIEW_PROFILE],
            },
        ],
    },

    // Enquiries and Leads stay deleted: the master doc's model is "book
    // instantly, no enquiry model". Users and Reviews return with their
    // modules (blocked on A3/A2).
];

export interface NavigationMap {
    dashboard: NavGroup[];
}

export function getNavigations(): NavigationMap {
    return { dashboard: dashboardNav };
}
