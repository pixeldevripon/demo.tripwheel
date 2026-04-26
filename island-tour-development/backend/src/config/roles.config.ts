import { Permission, Role } from '@prisma/client';

/**
 * Maps every Role to the set of Permissions it is allowed to exercise.
 * Used by PermissionsGuard — do not access these checks in business logic directly;
 * use @RequirePermissions() on the controller handler instead.
 *
 * Hierarchy:
 *   ADMIN        — full platform access
 *   TOUR_OPERATOR — own-content + booking visibility
 *   USER         — traveler browsing and self-management only
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    Permission.MANAGE_USERS,
    Permission.VIEW_PERMISSIONS,
    Permission.VIEW_USERS,
    Permission.CREATE_USER,
    Permission.UPDATE_USER,
    Permission.DELETE_USER,
    Permission.MANAGE_TRIPS,
    Permission.MANAGE_SLOTS,
    Permission.VIEW_SLOT_ANALYTICS,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA,
    Permission.BULK_OPERATIONS,
    Permission.CREATE_CONTENT,
    Permission.VIEW_CONTENT,
    Permission.EDIT_CONTENT,
    Permission.DELETE_CONTENT,
    Permission.CREATE_CATEGORY,
    Permission.VIEW_CATEGORIES,
    Permission.EDIT_CATEGORY,
    Permission.DELETE_CATEGORY,
    Permission.UPLOAD_MEDIA,
    Permission.MANAGE_MEDIA,
    Permission.VIEW_MEDIA,
    Permission.VIEW_ORDERS,
    Permission.EDIT_ORDER,
    Permission.VIEW_PAYMENTS,
    Permission.EDIT_PAYMENT,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
    Permission.VIEW_SETTINGS,
    Permission.MANAGE_SETTINGS,
    Permission.MANAGE_SYSTEM,
  ],

  [Role.TOUR_OPERATOR]: [
    Permission.VIEW_PERMISSIONS,
    Permission.CREATE_CONTENT,
    Permission.EDIT_CONTENT,
    Permission.DELETE_CONTENT,
    Permission.VIEW_CONTENT,
    Permission.UPLOAD_MEDIA,
    Permission.VIEW_MEDIA,
    Permission.VIEW_ORDERS,
    Permission.VIEW_PAYMENTS,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
    Permission.MANAGE_TRIPS,
    Permission.VIEW_CATEGORIES,
    Permission.VIEW_SLOT_ANALYTICS,
  ],

  [Role.USER]: [
    Permission.VIEW_CONTENT,
    Permission.VIEW_ORDERS,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
  ],
};
