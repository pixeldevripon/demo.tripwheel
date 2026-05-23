import {
    Activity,
    BarChart3,
    BookOpen,
    Building2,
    Calendar,
    CircleUser,
    CreditCard,
    Globe,
    ImageIcon,
    LayoutDashboard,
    Mail,
    Map,
    MapPin,
    MessageSquare,
    Settings,
    Star,
    Tag,
    Users,
    Waypoints,
} from 'lucide-react';

import { Permission } from '@/lib/config/rbac';
import type { NavItem } from '@/lib/rbac-utils';

/**
 * Dashboard navigation definitions.
 *
 * `permissions` values must exactly match the `Permission` keys declared in
 * /frontend/lib/config/rbac.ts — these are what the AppSidebar filter compares
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

    // ─── Analytics ─────────────────────────────────────────────────────────────
    {
        title: 'Analytics',
        url: 'analytics',
        icon: BarChart3,
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
            },
        ],
    },

    // ─── Destinations ──────────────────────────────────────────────────────────
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
    },

    // ─── Activities ────────────────────────────────────────────────────────────
    {
        title: 'Activities',
        icon: Activity,
        permissions: [Permission.VIEW_ACTIVITIES, Permission.CREATE_ACTIVITY],
        items: [
            {
                title: 'All Activities',
                url: 'activities',
                permissions: [Permission.VIEW_ACTIVITIES],
            },
            {
                title: 'Add Activity',
                url: 'activities/new',
                permissions: [Permission.CREATE_ACTIVITY],
            },
        ],
    },

    // ─── Pickup & Drop ─────────────────────────────────────────────────────────
    {
        title: 'Pickup & Drop',
        icon: MapPin,
        permissions: [
            Permission.VIEW_PICKUP_DROPS,
            Permission.CREATE_PICKUP_DROP,
        ],
        items: [
            {
                title: 'All Points',
                url: 'pickup-drops',
                permissions: [Permission.VIEW_PICKUP_DROPS],
            },
            {
                title: 'Add Point',
                url: 'pickup-drops/new',
                permissions: [Permission.CREATE_PICKUP_DROP],
            },
        ],
    },

    // ─── Blog ──────────────────────────────────────────────────────────────────
    {
        title: 'Blog',
        icon: BookOpen,
        permissions: [Permission.VIEW_BLOGS, Permission.CREATE_BLOG],
        items: [
            {
                title: 'All Posts',
                url: 'blogs',
                permissions: [Permission.VIEW_BLOGS],
            },
            {
                title: 'New Post',
                url: 'blogs/new',
                permissions: [Permission.CREATE_BLOG],
            },
        ],
    },

    // ─── Bookings ──────────────────────────────────────────────────────────────
    {
        title: 'Bookings',
        url: 'bookings',
        icon: Calendar,
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
        ],
    },

    // ─── Enquiries ─────────────────────────────────────────────────────────────
    {
        title: 'Enquiries',
        url: 'enquiries',
        icon: Mail,
        permissions: [Permission.VIEW_ENQUIRIES],
    },

    // ─── Leads ─────────────────────────────────────────────────────────────────
    {
        title: 'Leads',
        url: 'leads',
        icon: MessageSquare,
        permissions: [Permission.VIEW_LEADS],
    },

    // ─── Reviews ───────────────────────────────────────────────────────────────
    {
        title: 'Reviews',
        url: 'reviews',
        icon: Star,
        permissions: [Permission.VIEW_REVIEWS],
    },

    // ─── Partners ──────────────────────────────────────────────────────────────
    {
        title: 'Partners',
        icon: Building2,
        permissions: [Permission.VIEW_PARTNERS, Permission.CREATE_PARTNER],
        items: [
            {
                title: 'All Partners',
                url: 'partners',
                permissions: [Permission.VIEW_PARTNERS],
            },
            {
                title: 'Add Partner',
                url: 'partners/new',
                permissions: [Permission.CREATE_PARTNER],
            },
        ],
    },

    // ─── Categories ────────────────────────────────────────────────────────────
    {
        title: 'Categories',
        url: 'categories',
        icon: Tag,
        permissions: [Permission.VIEW_CATEGORIES],
    },

    // ─── Media ─────────────────────────────────────────────────────────────────
    {
        title: 'Media',
        url: 'media',
        icon: ImageIcon,
        permissions: [Permission.UPLOAD_MEDIA, Permission.MANAGE_MEDIA],
    },

    // ─── Profile ───────────────────────────────────────────────────────────────
    {
        title: 'My Profile',
        url: 'profile',
        icon: CircleUser,
        permissions: [Permission.VIEW_PROFILE],
    },

    // ─── Settings ──────────────────────────────────────────────────────────────
    {
        title: 'Settings',
        icon: Settings,
        permissions: [Permission.VIEW_SETTINGS, Permission.MANAGE_SETTINGS],
        items: [
            {
                title: 'General',
                url: 'settings',
                permissions: [Permission.VIEW_SETTINGS],
            },
            {
                title: 'System',
                url: 'settings/system',
                permissions: [Permission.MANAGE_SYSTEM],
            },
        ],
    },
];

export interface NavigationMap {
    dashboard: NavItem[];
}

export function getNavigations(): NavigationMap {
    return { dashboard: dashboardNav };
}

