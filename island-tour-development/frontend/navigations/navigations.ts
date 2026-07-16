import {
    Calendar,
    CalendarX,
    CircleUser,
    CreditCard,
    Globe,
    ImageIcon,
    LayoutDashboard,
    Mail,
    Map,
    MessageSquare,
    Settings,
    SlidersHorizontal,
    Sparkles,
    Star,
    Store,
    Tag,
    Layers,
    Users,
    Waypoints,
} from 'lucide-react';

import { Permission } from '@/lib/config/rbac';
import type { NavItem } from '@/lib/rbac-utils';

/**
 * Dashboard navigation definitions.
 *
 * `permissions` values must exactly match the `Permission` keys declared in
 * /frontend/lib/config/rbac.ts - these are what the AppSidebar filter compares
 * against. Role→Permission mapping is also in lib/config/rbac.ts, whose role
 * strings (ADMIN, TOUR_OPERATOR, USER…) come from the backend.
 */
const dashboardNav: NavItem[] = [
    // ─── Overview (always visible) ─────────────────────────────────────────────
    {
        title: 'Overview',
        url: '',
        icon: LayoutDashboard,
        permissions: [Permission.VIEW_ANALYTICS],
    },

    // ─── Trips ─────────────────────────────────────────────────────────────────
    {
        title: 'Trips',
        icon: Map,
        permissions: [Permission.VIEW_TRIPS, Permission.CREATE_TRIP],
        items: [
            {
                title: 'All Trips',
                url: 'trips',
                permissions: [Permission.VIEW_TRIPS],
            },
            {
                title: 'Add New Trip',
                url: 'trips/new',
                permissions: [Permission.CREATE_TRIP],
            }, // ─── Destinations ──────────────────────────────────────────────────────────
            {
                title: 'Destinations',
                icon: Globe,
                url: 'destinations',
                permissions: [
                    Permission.VIEW_DESTINATIONS,
                    Permission.CREATE_DESTINATION,
                ],
            },
            {
                title: 'Hubs',
                icon: Waypoints,
                url: 'hubs',
                permissions: [Permission.MANAGE_HUBS],
            }, // ─── Categories ────────────────────────────────────────────────────────────
            {
                title: 'Categories',
                url: 'categories',
                icon: Tag,
                permissions: [Permission.CREATE_CATEGORY],
            },
            {
                title: 'Attributes',
                url: 'attributes',
                icon: SlidersHorizontal,
                permissions: [Permission.MANAGE_SYSTEM],
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
            // ─── Spotlight (admin approval queue) ───────────────────────────────────────
            {
                title: 'Spotlight',
                url: 'spotlight',
                icon: Sparkles,
                permissions: [Permission.APPROVE_SPOTLIGHT],
            },
            // ─── Locals' favourites (editorial curation, admin-only) ─────────────────────
            {
                title: "Locals' Favourites",
                url: 'locals-favourites',
                icon: Star,
                permissions: [Permission.MANAGE_EDITORIAL],
            },
        ],
    },

    // ─── Media ─────────────────────────────────────────────────────────────────
    {
        title: 'Media',
        url: 'media',
        icon: ImageIcon,
        permissions: [Permission.UPLOAD_MEDIA, Permission.MANAGE_MEDIA],
    },
    // ─── Bookings ──────────────────────────────────────────────────────────────
    {
        title: 'Bookings',
        url: 'bookings',
        icon: Calendar,
        permissions: [Permission.VIEW_BOOKINGS],
    },

    // ─── Cancellation requests (master 6.4 admin queue) ───────────────────────
    {
        title: 'Cancellation Requests',
        url: 'cancellation-requests',
        icon: CalendarX,
        permissions: [Permission.VIEW_BOOKINGS],
    },

    // ─── Payments ──────────────────────────────────────────────────────────────
    {
        title: 'Payments',
        url: 'payments',
        icon: CreditCard,
        permissions: [Permission.VIEW_PAYMENTS],
    },
    // ─── Users / Customers ─────────────────────────────────────────────────────
    {
        title: 'Users',
        icon: Users,
        permissions: [Permission.VIEW_USERS, Permission.MANAGE_USERS],
        items: [
            {
                title: 'All Users',
                url: 'users',
                permissions: [Permission.VIEW_USERS],
            },
            {
                title: 'Add User',
                url: 'users/new',
                permissions: [Permission.CREATE_USER],
            },
            // ─── Profile ───────────────────────────────────────────────────────────────
            {
                title: 'Your Profile',
                url: 'profile',
                icon: CircleUser,
                permissions: [Permission.VIEW_PROFILE],
            },
        ],
    },
    // ─── Tour Operators ──────────────────────────────────────────────────────
    {
        title: 'Tour Operators',
        icon: Store,
        permissions: [Permission.MANAGE_OPERATORS],
        items: [
            {
                title: 'All Tour Operators',
                url: 'tour-operators',
                permissions: [Permission.MANAGE_OPERATORS],
            },
            {
                title: 'Add Tour Operator',
                url: 'tour-operators/new',
                permissions: [Permission.MANAGE_OPERATORS],
            },
        ],
    },

    // ─── Enquiries ─────────────────────────────────────────────────────────────
/*     {
        title: 'Enquiries',
        url: 'enquiries',
        icon: Mail,
        permissions: [Permission.VIEW_ENQUIRIES],
    }, */

    // ─── Leads ─────────────────────────────────────────────────────────────────
/*     {
        title: 'Leads',
        url: 'leads',
        icon: MessageSquare,
        permissions: [Permission.VIEW_LEADS],
    }, */

    // ─── Reviews ───────────────────────────────────────────────────────────────
/*     {
        title: 'Reviews',
        url: 'reviews',
        icon: Star,
        permissions: [Permission.VIEW_REVIEWS],
    }, */

    // ─── Settings ──────────────────────────────────────────────────────────────
    // Visible to admins (system settings) and operators (own company + payments).
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
];

export interface NavigationMap {
    dashboard: NavItem[];
}

export function getNavigations(): NavigationMap {
    return { dashboard: dashboardNav };
}












