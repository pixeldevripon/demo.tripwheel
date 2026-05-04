export const Permission = {
    // Monorepo specific / System
    VIEW_PERMISSIONS: 'VIEW_PERMISSIONS',
    MANAGE_SYSTEM: 'MANAGE_SYSTEM',
    MANAGE_TRIPS: 'MANAGE_TRIPS',
    MANAGE_SLOTS: 'MANAGE_SLOTS',
    VIEW_SLOT_ANALYTICS: 'VIEW_SLOT_ANALYTICS',
    CREATE_CONTENT: 'CREATE_CONTENT',
    VIEW_CONTENT: 'VIEW_CONTENT',
    EDIT_CONTENT: 'EDIT_CONTENT',
    DELETE_CONTENT: 'DELETE_CONTENT',
    VIEW_MEDIA: 'VIEW_MEDIA',
    VIEW_ORDERS: 'VIEW_ORDERS',
    EDIT_ORDER: 'EDIT_ORDER',
    DELETE_ORDER: 'DELETE_ORDER',

    // Users
    MANAGE_USERS: 'MANAGE_USERS',
    VIEW_USERS: 'VIEW_USERS',
    CREATE_USER: 'CREATE_USER',
    UPDATE_USER: 'UPDATE_USER',
    DELETE_USER: 'DELETE_USER',

    // Trips (Legacy compatibility)
    CREATE_TRIP: 'CREATE_TRIP',
    VIEW_TRIPS: 'VIEW_TRIPS',
    EDIT_TRIP: 'EDIT_TRIP',
    DELETE_TRIP: 'DELETE_TRIP',

    // Blogs
    CREATE_BLOG: 'CREATE_BLOG',
    VIEW_BLOGS: 'VIEW_BLOGS',
    EDIT_BLOG: 'EDIT_BLOG',
    DELETE_BLOG: 'DELETE_BLOG',

    // Destinations
    CREATE_DESTINATION: 'CREATE_DESTINATION',
    VIEW_DESTINATIONS: 'VIEW_DESTINATIONS',
    EDIT_DESTINATION: 'EDIT_DESTINATION',
    DELETE_DESTINATION: 'DELETE_DESTINATION',

    // Activities
    CREATE_ACTIVITY: 'CREATE_ACTIVITY',
    VIEW_ACTIVITIES: 'VIEW_ACTIVITIES',
    EDIT_ACTIVITY: 'EDIT_ACTIVITY',
    DELETE_ACTIVITY: 'DELETE_ACTIVITY',

    // Pickups & Drops
    CREATE_PICKUP_DROP: 'CREATE_PICKUP_DROP',
    VIEW_PICKUP_DROPS: 'VIEW_PICKUP_DROPS',
    EDIT_PICKUP_DROP: 'EDIT_PICKUP_DROP',
    DELETE_PICKUP_DROP: 'DELETE_PICKUP_DROP',

    // Categories
    CREATE_CATEGORY: 'CREATE_CATEGORY',
    VIEW_CATEGORIES: 'VIEW_CATEGORIES',
    EDIT_CATEGORY: 'EDIT_CATEGORY',
    DELETE_CATEGORY: 'DELETE_CATEGORY',

    // Bookings
    VIEW_BOOKINGS: 'VIEW_BOOKINGS',
    EDIT_BOOKING: 'EDIT_BOOKING',
    DELETE_BOOKING: 'DELETE_BOOKING',

    // Payments
    VIEW_PAYMENTS: 'VIEW_PAYMENTS',
    EDIT_PAYMENT: 'EDIT_PAYMENT',
    DELETE_PAYMENT: 'DELETE_PAYMENT',

    // Personal / User specific
    VIEW_MY_BOOKINGS: 'VIEW_MY_BOOKINGS',
    VIEW_MY_PAYMENTS: 'VIEW_MY_PAYMENTS',

    // Enquiries
    VIEW_ENQUIRIES: 'VIEW_ENQUIRIES',
    DELETE_ENQUIRY: 'DELETE_ENQUIRY',
    REPLY_ENQUIRY: 'REPLY_ENQUIRY',

    // Leads
    VIEW_LEADS: 'VIEW_LEADS',
    EDIT_LEAD: 'EDIT_LEAD',
    DELETE_LEAD: 'DELETE_LEAD',

    // Reviews
    VIEW_REVIEWS: 'VIEW_REVIEWS',
    EDIT_REVIEW: 'EDIT_REVIEW',
    DELETE_REVIEW: 'DELETE_REVIEW',

    // Partners
    CREATE_PARTNER: 'CREATE_PARTNER',
    VIEW_PARTNERS: 'VIEW_PARTNERS',
    EDIT_PARTNER: 'EDIT_PARTNER',
    DELETE_PARTNER: 'DELETE_PARTNER',

    // Files & Media
    UPLOAD_MEDIA: 'UPLOAD_MEDIA',
    MANAGE_MEDIA: 'MANAGE_MEDIA',

    // Profile
    VIEW_PROFILE: 'VIEW_PROFILE',
    EDIT_PROFILE: 'EDIT_PROFILE',

    // Settings
    MANAGE_SETTINGS: 'MANAGE_SETTINGS',
    VIEW_SETTINGS: 'VIEW_SETTINGS',

    // Analytics & Data
    VIEW_ANALYTICS: 'VIEW_ANALYTICS',
    EXPORT_DATA: 'EXPORT_DATA',
    BULK_OPERATIONS: 'BULK_OPERATIONS',
};

export const ALL_PERMISSIONS = Object.values(Permission);

// Role enum values
export const Role = {
    ADMIN: 'ADMIN',
    EDITOR: 'EDITOR',
    STAFF: 'STAFF',
    GUIDE: 'GUIDE',
    TOUR_OPERATOR: 'TOUR_OPERATOR',
    USER: 'USER',
};

export const ROLE_PERMISSIONS: any = {
    [Role.ADMIN]: [...ALL_PERMISSIONS],

    [Role.EDITOR]: [
        Permission.CREATE_TRIP,
        Permission.VIEW_TRIPS,
        Permission.EDIT_TRIP,
        Permission.DELETE_TRIP,
        Permission.CREATE_BLOG,
        Permission.VIEW_BLOGS,
        Permission.EDIT_BLOG,
        Permission.DELETE_BLOG,
        Permission.CREATE_DESTINATION,
        Permission.VIEW_DESTINATIONS,
        Permission.EDIT_DESTINATION,
        Permission.DELETE_DESTINATION,
        Permission.CREATE_ACTIVITY,
        Permission.VIEW_ACTIVITIES,
        Permission.EDIT_ACTIVITY,
        Permission.DELETE_ACTIVITY,
        Permission.CREATE_PICKUP_DROP,
        Permission.VIEW_PICKUP_DROPS,
        Permission.EDIT_PICKUP_DROP,
        Permission.DELETE_PICKUP_DROP,
        Permission.CREATE_CATEGORY,
        Permission.VIEW_CATEGORIES,
        Permission.EDIT_CATEGORY,
        Permission.DELETE_CATEGORY,
        Permission.VIEW_BOOKINGS,
        Permission.EDIT_BOOKING,
        Permission.DELETE_BOOKING,
        Permission.VIEW_PAYMENTS,
        Permission.EDIT_PAYMENT,
        Permission.DELETE_PAYMENT,
        Permission.VIEW_ENQUIRIES,
        Permission.DELETE_ENQUIRY,
        Permission.REPLY_ENQUIRY,
        Permission.VIEW_LEADS,
        Permission.EDIT_LEAD,
        Permission.DELETE_LEAD,
        Permission.VIEW_REVIEWS,
        Permission.EDIT_REVIEW,
        Permission.DELETE_REVIEW,
        Permission.CREATE_PARTNER,
        Permission.VIEW_PARTNERS,
        Permission.EDIT_PARTNER,
        Permission.DELETE_PARTNER,
        Permission.UPLOAD_MEDIA,
        Permission.MANAGE_MEDIA,
        Permission.VIEW_PROFILE,
        Permission.EDIT_PROFILE,
        Permission.VIEW_ANALYTICS,
        Permission.EXPORT_DATA,
        Permission.BULK_OPERATIONS,
    ],

    [Role.STAFF]: [
        Permission.CREATE_TRIP,
        Permission.VIEW_TRIPS,
        Permission.CREATE_BLOG,
        Permission.VIEW_BLOGS,
        Permission.VIEW_BOOKINGS,
        Permission.EDIT_BOOKING,
        Permission.DELETE_BOOKING,
        Permission.VIEW_PAYMENTS,
        Permission.EDIT_PAYMENT,
        Permission.DELETE_PAYMENT,
        Permission.VIEW_ENQUIRIES,
        Permission.DELETE_ENQUIRY,
        Permission.REPLY_ENQUIRY,
        Permission.VIEW_LEADS,
        Permission.EDIT_LEAD,
        Permission.DELETE_LEAD,
        Permission.VIEW_REVIEWS,
        Permission.EDIT_REVIEW,
        Permission.DELETE_REVIEW,
        Permission.CREATE_PARTNER,
        Permission.VIEW_PARTNERS,
        Permission.EDIT_PARTNER,
        Permission.DELETE_PARTNER,
        Permission.UPLOAD_MEDIA,
        Permission.MANAGE_MEDIA,
        Permission.VIEW_PROFILE,
        Permission.EDIT_PROFILE,
        Permission.VIEW_ANALYTICS,
    ],

    [Role.GUIDE]: [
        Permission.VIEW_USERS,
        Permission.VIEW_PROFILE,
        Permission.VIEW_BOOKINGS,
        Permission.VIEW_TRIPS,
        Permission.VIEW_REVIEWS,
    ],

    [Role.TOUR_OPERATOR]: [
        Permission.VIEW_USERS,
        Permission.CREATE_TRIP,
        Permission.EDIT_TRIP,
        Permission.VIEW_TRIPS,
        Permission.VIEW_BLOGS,
        Permission.VIEW_ANALYTICS,
        Permission.EXPORT_DATA,
        Permission.VIEW_REVIEWS,
        Permission.VIEW_PERMISSIONS,
        Permission.CREATE_CONTENT,
        Permission.EDIT_CONTENT,
        Permission.DELETE_CONTENT,
        Permission.VIEW_CONTENT,
        Permission.UPLOAD_MEDIA,
        Permission.VIEW_MEDIA,
        Permission.VIEW_ORDERS,
        Permission.VIEW_PAYMENTS,
        Permission.VIEW_PROFILE,
        Permission.EDIT_PROFILE,
        Permission.MANAGE_TRIPS,
        Permission.VIEW_CATEGORIES,
        Permission.VIEW_SLOT_ANALYTICS,
    ],

    [Role.USER]: [
        Permission.VIEW_PROFILE,
        Permission.VIEW_MY_BOOKINGS,
        Permission.VIEW_MY_PAYMENTS,
    ],
};

// Helper function to check if user has permission
export const hasPermission = (
    userRole: string | number,
    permission: string
) => {
    const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
    return rolePermissions.includes(permission);
};

// Helper function to check if user has any of the permissions
export const hasAnyPermission = (
    userRole: string | number,
    permissions: any[]
) => {
    const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
    return permissions.some(permission => rolePermissions.includes(permission));
};

// Helper function to check if user has all the permissions
export const hasAllPermissions = (
    userRole: string | number,
    permissions: any[]
) => {
    const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
    return permissions.every((permission: string) =>
        rolePermissions.includes(permission)
    );
};

