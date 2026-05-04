import {
  BarChart3,
  BookOpen,
  Calendar,
  CreditCard,
  FileText,
  Globe,
  ImageIcon,
  LayoutDashboard,
  Mail,
  Map,
  MessageSquare,
  Settings,
  Shield,
  Star,
  Tag,
  Users,
  Layers,
  MapPin,
  Activity,
  Building2,
} from 'lucide-react';

import type { NavItem } from '@/lib/rbac-utils';
import { Permission } from '@/RBAC.config';

/**
 * Dashboard navigation definitions.
 *
 * `permissions` values must exactly match the `Permission` keys declared in
 * /frontend/RBAC.config.ts — these are what the AppSidebar filter compares
 * against. Role→Permission mapping is also in RBAC.config.ts, whose role
 * strings (ADMIN, TOUR_OPERATOR, USER…) come from the backend.
 */
const dashboardNav: NavItem[] = [
  // ─── Overview (always visible) ─────────────────────────────────────────────
  {
    title: 'Overview',
    url: '',
    icon: LayoutDashboard,
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
      { title: 'All Trips',    url: 'trips',        permissions: [Permission.VIEW_TRIPS]   },
      { title: 'Add New Trip', url: 'trips/new',    permissions: [Permission.CREATE_TRIP]  },
    ],
  },

  // ─── Destinations ──────────────────────────────────────────────────────────
  {
    title: 'Destinations',
    icon: Globe,
    permissions: [Permission.VIEW_DESTINATIONS, Permission.CREATE_DESTINATION],
    items: [
      { title: 'All Destinations', url: 'destinations',     permissions: [Permission.VIEW_DESTINATIONS]   },
      { title: 'Add Destination',  url: 'destinations/new', permissions: [Permission.CREATE_DESTINATION]  },
    ],
  },

  // ─── Activities ────────────────────────────────────────────────────────────
  {
    title: 'Activities',
    icon: Activity,
    permissions: [Permission.VIEW_ACTIVITIES, Permission.CREATE_ACTIVITY],
    items: [
      { title: 'All Activities', url: 'activities',     permissions: [Permission.VIEW_ACTIVITIES]  },
      { title: 'Add Activity',   url: 'activities/new', permissions: [Permission.CREATE_ACTIVITY] },
    ],
  },

  // ─── Pickup & Drop ─────────────────────────────────────────────────────────
  {
    title: 'Pickup & Drop',
    icon: MapPin,
    permissions: [Permission.VIEW_PICKUP_DROPS, Permission.CREATE_PICKUP_DROP],
    items: [
      { title: 'All Points',   url: 'pickup-drops',     permissions: [Permission.VIEW_PICKUP_DROPS]   },
      { title: 'Add Point',    url: 'pickup-drops/new', permissions: [Permission.CREATE_PICKUP_DROP]  },
    ],
  },

  // ─── Blog ──────────────────────────────────────────────────────────────────
  {
    title: 'Blog',
    icon: BookOpen,
    permissions: [Permission.VIEW_BLOGS, Permission.CREATE_BLOG],
    items: [
      { title: 'All Posts', url: 'blogs',     permissions: [Permission.VIEW_BLOGS]  },
      { title: 'New Post',  url: 'blogs/new', permissions: [Permission.CREATE_BLOG] },
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
      { title: 'All Users', url: 'users',     permissions: [Permission.VIEW_USERS]    },
      { title: 'Add User',  url: 'users/new', permissions: [Permission.CREATE_USER]   },
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
      { title: 'All Partners', url: 'partners',     permissions: [Permission.VIEW_PARTNERS]   },
      { title: 'Add Partner',  url: 'partners/new', permissions: [Permission.CREATE_PARTNER]  },
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
    icon: Shield,
    permissions: [Permission.VIEW_PROFILE],
  },

  // ─── Settings ──────────────────────────────────────────────────────────────
  {
    title: 'Settings',
    icon: Settings,
    permissions: [Permission.VIEW_SETTINGS, Permission.MANAGE_SETTINGS],
    items: [
      { title: 'General',  url: 'settings',        permissions: [Permission.VIEW_SETTINGS]    },
      { title: 'System',   url: 'settings/system', permissions: [Permission.MANAGE_SYSTEM]    },
    ],
  },
];

export interface NavigationMap {
  dashboard: NavItem[];
}

export function getNavigations(): NavigationMap {
  return { dashboard: dashboardNav };
}
