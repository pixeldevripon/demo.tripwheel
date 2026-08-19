import { Permission, Role } from '@prisma/client';

/**
 * Maps every Role to the set of Permissions it is allowed to exercise.
 * Used by PermissionsGuard - do not access these checks in business logic directly;
 * use @RequirePermissions() on the controller handler instead.
 *
 * Hierarchy:
 *   ADMIN        - full platform access
 *   TOUR_OPERATOR - own-content + booking visibility
 *   USER         - traveler browsing and self-management only
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    Permission.VIEW_PERMISSIONS,
    Permission.MANAGE_OPERATORS,
    Permission.CREATE_OPERATOR,
    Permission.VIEW_OPERATOR_PROFILE,
    Permission.EDIT_OPERATOR_PROFILE,
    Permission.MANAGE_OPERATOR_PAYMENTS,
    Permission.DELETE_OPERATOR,
    Permission.MANAGE_SYSTEM,
    Permission.MANAGE_TRIPS,
    // Editorial curation (Locals' favourite etc.) — admin-only, never operators.
    Permission.MANAGE_EDITORIAL,
    Permission.MANAGE_AVAILABILITY,
    Permission.STOP_SELL,
    Permission.CREATE_CONTENT,
    Permission.VIEW_CONTENT,
    Permission.EDIT_CONTENT,
    Permission.DELETE_CONTENT,
    Permission.VIEW_MEDIA,
    Permission.VIEW_ORDERS,
    Permission.EDIT_ORDER,
    Permission.MANAGE_USERS,
    Permission.VIEW_USERS,
    Permission.CREATE_USER,
    Permission.UPDATE_USER,
    Permission.DELETE_USER,
    // Staff & teams: platform staff/designations (admin-only by ceiling) and
    // any operator's team (admin bypass in the staff service).
    Permission.MANAGE_STAFF,
    Permission.MANAGE_TEAM,
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
    Permission.MANAGE_HUBS,
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
    Permission.CREATE_COLLECTION,
    Permission.VIEW_COLLECTIONS,
    Permission.EDIT_COLLECTION,
    Permission.DELETE_COLLECTION,
    Permission.VIEW_BOOKINGS,
    Permission.EDIT_BOOKING,
    Permission.DELETE_BOOKING,
    // Admin-only booking ops (non-payment forfeit confirmation - guide s15).
    Permission.MANAGE_BOOKINGS,
    // Conflict #7: money + traveler PII on booking rows. Without it a seat
    // sees only the MANIFEST projection (who/when/where).
    Permission.VIEW_BOOKING_FINANCIALS,
    Permission.VIEW_PAYMENTS,
    Permission.EDIT_PAYMENT,
    Permission.DELETE_PAYMENT,
    // Payout ledger actions (settlements mark-paid/mark-unpaid). Admin-only:
    // excluded from the platform-staff ceiling, never granted to operators
    // (access-roles matrix: operator settlements are view-own).
    Permission.MANAGE_PAYMENTS,
    Permission.VIEW_ENQUIRIES,
    Permission.DELETE_ENQUIRY,
    Permission.REPLY_ENQUIRY,
    Permission.VIEW_LEADS,
    Permission.EDIT_LEAD,
    Permission.DELETE_LEAD,
    Permission.VIEW_REVIEWS,
    Permission.EDIT_REVIEW,
    Permission.DELETE_REVIEW,
    Permission.APPROVE_REVIEW,

    // Commercial tiers & spotlight (admin-only; operators change tiers / request
    // spotlight via EDIT_TRIP on their own tours - owner accounts only, the
    // tiers service rejects non-owner seats)
    Permission.MANAGE_TIERS,
    Permission.APPROVE_SPOTLIGHT,

    Permission.UPLOAD_MEDIA,
    Permission.MANAGE_MEDIA,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
    Permission.MANAGE_SETTINGS,
    Permission.VIEW_SETTINGS,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA,
    Permission.BULK_OPERATIONS,
  ],

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
    Permission.MANAGE_HUBS,
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
    Permission.CREATE_COLLECTION,
    Permission.VIEW_COLLECTIONS,
    Permission.EDIT_COLLECTION,
    Permission.DELETE_COLLECTION,
    Permission.VIEW_BOOKINGS,
    Permission.EDIT_BOOKING,
    Permission.DELETE_BOOKING,
    // Conflict #7: platform support keeps the full row (they triage refunds).
    Permission.VIEW_BOOKING_FINANCIALS,
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
    Permission.APPROVE_REVIEW,

    Permission.UPLOAD_MEDIA,
    Permission.VIEW_MEDIA,
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
    // Conflict #7: platform support keeps the full row (they triage refunds).
    Permission.VIEW_BOOKING_FINANCIALS,
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
    Permission.APPROVE_REVIEW,
    Permission.UPLOAD_MEDIA,
    Permission.VIEW_MEDIA,
    Permission.MANAGE_MEDIA,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
    Permission.VIEW_ANALYTICS,
  ],

  [Role.GUIDE]: [
    Permission.VIEW_USERS,
    Permission.VIEW_PROFILE,
    // Conflict #7: VIEW_BOOKINGS without VIEW_BOOKING_FINANCIALS = the
    // manifest projection (who/when/where, no money, no traveler email).
    Permission.VIEW_BOOKINGS,
    Permission.VIEW_TRIPS,
    Permission.VIEW_REVIEWS,
  ],

  [Role.TOUR_OPERATOR]: [
    Permission.VIEW_OPERATOR_PROFILE,
    Permission.EDIT_OPERATOR_PROFILE,
    Permission.MANAGE_OPERATOR_PAYMENTS,
    // Team seats: held by the full role set (= owners). Non-owner seats never
    // receive it - it sits outside the seat grant ceiling (staff.config.ts).
    Permission.MANAGE_TEAM,
    Permission.VIEW_USERS,
    Permission.CREATE_TRIP,
    Permission.EDIT_TRIP,
    Permission.DELETE_TRIP,
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
    // Master roles doc: operators "view own bookings" - the bookings/payments
    // list services scope them to their own tours' rows (never platform-wide).
    Permission.VIEW_BOOKINGS,
    // Conflict #7: owners/managers keep the full booking row; a guide-level
    // designation omits this and gets the manifest projection instead.
    Permission.VIEW_BOOKING_FINANCIALS,
    // EDIT_BOOKING gates ONLY the three operator REPORT routes
    // (report-non-payment, report-cancellation, report-no-show) - all
    // ownership-pinned in the service and none of them moves money or settles
    // anything (the admin executes the forfeit/refund/no-show verdict).
    Permission.EDIT_BOOKING,
    Permission.VIEW_PAYMENTS,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
    // Conflict #1 (access-roles matrix): NO MANAGE_TRIPS - publishing is
    // always Island Tours'. Operators submit-for-review + pause/archive their
    // own tours via EDIT_TRIP routes; publish/unpause/restore are platform.
    Permission.MANAGE_AVAILABILITY,
    // Matrix v1.7: the narrow close/reopen grant, implied by the full one for
    // owners; exists so a staff DESIGNATION can hold stop-sell alone.
    Permission.STOP_SELL,
    Permission.VIEW_CATEGORIES,
  ],

  [Role.USER]: [
    Permission.VIEW_TRIPS,
    Permission.VIEW_BLOGS,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
    Permission.VIEW_REVIEWS,
    Permission.VIEW_CONTENT,
    Permission.VIEW_ORDERS,
    // Customer dashboard reads - the bookings/payments list services scope
    // these to the caller's own rows (where userId/booking.userId = actor.id),
    // never the operator/admin datasets.
    Permission.VIEW_BOOKINGS,
    Permission.VIEW_PAYMENTS,
  ],
};
