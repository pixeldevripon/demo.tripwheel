import { Permission, Role, StaffSeatRole, StaffStatus } from '@prisma/client';
import { ROLE_PERMISSIONS } from '@/config/roles.config';

/**
 * Staff & Teams permission policy (single source of truth).
 *
 * Effective permissions for a staff member / team seat:
 *
 *   ((designation.permissions ∪ extraPermissions) − revokedPermissions)
 *     ∩ scope ceiling  ∪  base floor
 *
 * - The CEILING is what an admin/owner may grant at all. Anything outside it is
 *   silently ignored even if written to the DB (defense in depth against a
 *   tampered row re-granting itself).
 * - The FLOOR is always present for an ACTIVE member: the minimum needed to
 *   load the dashboard shell and manage one's own profile. It is not revocable.
 */

/** Always granted to an active staff member / seat; never revocable. */
export const STAFF_BASE_PERMISSIONS: readonly Permission[] = [
  Permission.VIEW_PROFILE,
  Permission.EDIT_PROFILE,
];

/**
 * Permissions that can NEVER be granted to platform (admin-side) staff.
 *
 * - MANAGE_SYSTEM: system administration stays with real ADMIN accounts.
 * - MANAGE_STAFF: staff must never manage staff - otherwise a staff member
 *   could grant an accomplice (or a second account) arbitrary permissions.
 * - MANAGE_TEAM: operator-side concern; meaningless for platform staff.
 * - MANAGE_USERS / CREATE_USER / UPDATE_USER / DELETE_USER: identity
 *   mutations are an escalation surface (role flips hand out un-ceilinged
 *   static permission sets; an email change redirects password resets), so
 *   they stay with real ADMIN accounts. VIEW_USERS remains grantable.
 * - MANAGE_OPERATOR_PAYMENTS: operator payout config is owner-only in the
 *   operators service regardless - listing it here keeps the grant catalog
 *   honest instead of offering a permission that always 403s.
 * - MANAGE_BOOKINGS / MANAGE_PAYMENTS: forfeit confirmations and payout-ledger
 *   flips move real money; the access-roles matrix keeps both with real ADMIN
 *   accounts (support staff triage, never execute).
 */
const PLATFORM_STAFF_EXCLUDED: readonly Permission[] = [
  Permission.MANAGE_SYSTEM,
  Permission.MANAGE_STAFF,
  Permission.MANAGE_TEAM,
  Permission.MANAGE_USERS,
  Permission.CREATE_USER,
  Permission.UPDATE_USER,
  Permission.DELETE_USER,
  Permission.MANAGE_OPERATOR_PAYMENTS,
  Permission.MANAGE_BOOKINGS,
  Permission.MANAGE_PAYMENTS,
];

/**
 * Permissions that can NEVER be granted to a non-owner operator seat.
 *
 * - MANAGE_TEAM: seat management is owner-only (login doc Phase 2 item 5).
 * - MANAGE_OPERATOR_PAYMENTS: payout/bank configuration is owner-only.
 */
const OPERATOR_SEAT_EXCLUDED: readonly Permission[] = [
  Permission.MANAGE_TEAM,
  Permission.MANAGE_OPERATOR_PAYMENTS,
];

/** Everything an admin may grant to platform staff (via designation or override). */
export const PLATFORM_STAFF_CEILING: readonly Permission[] = ROLE_PERMISSIONS[
  Role.ADMIN
].filter((p) => !PLATFORM_STAFF_EXCLUDED.includes(p));

/** Everything an owner may grant to a team seat (via designation or override). */
export const OPERATOR_SEAT_CEILING: readonly Permission[] = ROLE_PERMISSIONS[
  Role.TOUR_OPERATOR
].filter((p) => !OPERATOR_SEAT_EXCLUDED.includes(p));

/** The parts of a staff_members row (+ its designation) that decide access. */
export interface EffectivePermissionParts {
  /** True for operator team seats, false for platform (admin-side) staff. */
  operatorScoped: boolean;
  seatRole: StaffSeatRole;
  status: StaffStatus;
  designationPermissions: readonly Permission[];
  extraPermissions: readonly Permission[];
  revokedPermissions: readonly Permission[];
}

/**
 * Pure policy function - the ONLY place the effective set is derived.
 * Used by StaffPermissionsService (guard path) and by the staff API when
 * echoing `effectivePermissions` in responses, so the two can never drift.
 */
export function computeEffectivePermissions(
  parts: EffectivePermissionParts,
): Permission[] {
  if (parts.status === StaffStatus.SUSPENDED) return [];

  // Owner seats are not permission-managed - full role set.
  if (parts.operatorScoped && parts.seatRole === StaffSeatRole.OWNER) {
    return [...ROLE_PERMISSIONS[Role.TOUR_OPERATOR]];
  }

  const ceiling = parts.operatorScoped
    ? OPERATOR_SEAT_CEILING
    : PLATFORM_STAFF_CEILING;

  const granted = new Set<Permission>(parts.designationPermissions);
  for (const p of parts.extraPermissions) granted.add(p);
  for (const p of parts.revokedPermissions) granted.delete(p);

  const effective = new Set<Permission>(
    [...granted].filter((p) => ceiling.includes(p)),
  );
  for (const p of STAFF_BASE_PERMISSIONS) effective.add(p);

  return [...effective];
}

/**
 * Human-readable permission catalog for the dashboards' permission-matrix UI.
 * Grouped by surface; only grantable permissions appear (per scope, the API
 * intersects each group with the relevant ceiling before returning it).
 */
export interface PermissionCatalogGroup {
  group: string;
  permissions: { key: Permission; label: string }[];
}

export const PERMISSION_CATALOG: readonly PermissionCatalogGroup[] = [
  {
    group: 'Tours',
    permissions: [
      { key: Permission.VIEW_TRIPS, label: 'View tours' },
      { key: Permission.CREATE_TRIP, label: 'Create tours' },
      { key: Permission.EDIT_TRIP, label: 'Edit tours' },
      { key: Permission.DELETE_TRIP, label: 'Delete tours' },
      { key: Permission.MANAGE_TRIPS, label: 'Manage all tours' },
      { key: Permission.MANAGE_AVAILABILITY, label: 'Manage availability' },
      { key: Permission.MANAGE_EDITORIAL, label: 'Editorial curation' },
    ],
  },
  {
    group: 'Bookings & Payments',
    permissions: [
      { key: Permission.VIEW_BOOKINGS, label: 'View bookings' },
      {
        key: Permission.VIEW_BOOKING_FINANCIALS,
        label: 'See booking amounts + traveler contact',
      },
      { key: Permission.EDIT_BOOKING, label: 'Edit bookings' },
      { key: Permission.DELETE_BOOKING, label: 'Delete bookings' },
      { key: Permission.VIEW_PAYMENTS, label: 'View payments' },
      { key: Permission.EDIT_PAYMENT, label: 'Edit payments' },
      { key: Permission.DELETE_PAYMENT, label: 'Delete payments' },
      { key: Permission.VIEW_ORDERS, label: 'View orders' },
      { key: Permission.EDIT_ORDER, label: 'Edit orders' },
    ],
  },
  {
    group: 'Catalog',
    permissions: [
      { key: Permission.VIEW_DESTINATIONS, label: 'View destinations' },
      { key: Permission.CREATE_DESTINATION, label: 'Create destinations' },
      { key: Permission.EDIT_DESTINATION, label: 'Edit destinations' },
      { key: Permission.DELETE_DESTINATION, label: 'Delete destinations' },
      { key: Permission.VIEW_CATEGORIES, label: 'View categories' },
      { key: Permission.CREATE_CATEGORY, label: 'Create categories' },
      { key: Permission.EDIT_CATEGORY, label: 'Edit categories' },
      { key: Permission.DELETE_CATEGORY, label: 'Delete categories' },
      { key: Permission.VIEW_COLLECTIONS, label: 'View collections' },
      { key: Permission.CREATE_COLLECTION, label: 'Create collections' },
      { key: Permission.EDIT_COLLECTION, label: 'Edit collections' },
      { key: Permission.DELETE_COLLECTION, label: 'Delete collections' },
      { key: Permission.MANAGE_HUBS, label: 'Manage hubs' },
    ],
  },
  {
    group: 'Content & Media',
    permissions: [
      { key: Permission.VIEW_CONTENT, label: 'View content' },
      { key: Permission.CREATE_CONTENT, label: 'Create content' },
      { key: Permission.EDIT_CONTENT, label: 'Edit content' },
      { key: Permission.DELETE_CONTENT, label: 'Delete content' },
      { key: Permission.VIEW_MEDIA, label: 'View media library' },
      { key: Permission.UPLOAD_MEDIA, label: 'Upload media' },
      { key: Permission.MANAGE_MEDIA, label: 'Manage media library' },
      { key: Permission.VIEW_BLOGS, label: 'View blog posts' },
      { key: Permission.CREATE_BLOG, label: 'Create blog posts' },
      { key: Permission.EDIT_BLOG, label: 'Edit blog posts' },
      { key: Permission.DELETE_BLOG, label: 'Delete blog posts' },
    ],
  },
  {
    group: 'Reviews',
    permissions: [
      { key: Permission.VIEW_REVIEWS, label: 'View reviews' },
      { key: Permission.EDIT_REVIEW, label: 'Edit reviews' },
      { key: Permission.DELETE_REVIEW, label: 'Delete reviews' },
      { key: Permission.APPROVE_REVIEW, label: 'Approve reviews' },
    ],
  },
  {
    group: 'Commercial',
    permissions: [
      { key: Permission.MANAGE_TIERS, label: 'Manage commission tiers' },
      {
        key: Permission.APPROVE_SPOTLIGHT,
        label: 'Approve spotlight requests',
      },
    ],
  },
  {
    group: 'Operators',
    permissions: [
      { key: Permission.MANAGE_OPERATORS, label: 'Manage operators' },
      { key: Permission.CREATE_OPERATOR, label: 'Create operators' },
      {
        key: Permission.VIEW_OPERATOR_PROFILE,
        label: 'View operator profiles',
      },
      {
        key: Permission.EDIT_OPERATOR_PROFILE,
        label: 'Edit operator profiles',
      },
      {
        key: Permission.MANAGE_OPERATOR_PAYMENTS,
        label: 'Manage operator payouts',
      },
      { key: Permission.DELETE_OPERATOR, label: 'Delete operators' },
    ],
  },
  {
    group: 'Users & Support',
    permissions: [
      { key: Permission.VIEW_USERS, label: 'View users' },
      { key: Permission.MANAGE_USERS, label: 'Manage users' },
      { key: Permission.CREATE_USER, label: 'Create users' },
      { key: Permission.UPDATE_USER, label: 'Update users' },
      { key: Permission.DELETE_USER, label: 'Delete users' },
      { key: Permission.VIEW_ENQUIRIES, label: 'View enquiries' },
      { key: Permission.REPLY_ENQUIRY, label: 'Reply to enquiries' },
      { key: Permission.DELETE_ENQUIRY, label: 'Delete enquiries' },
      { key: Permission.VIEW_LEADS, label: 'View leads' },
      { key: Permission.EDIT_LEAD, label: 'Edit leads' },
      { key: Permission.DELETE_LEAD, label: 'Delete leads' },
    ],
  },
  {
    group: 'Settings & Analytics',
    permissions: [
      { key: Permission.VIEW_SETTINGS, label: 'View settings' },
      { key: Permission.MANAGE_SETTINGS, label: 'Manage settings' },
      { key: Permission.VIEW_ANALYTICS, label: 'View analytics' },
      { key: Permission.EXPORT_DATA, label: 'Export data' },
      { key: Permission.BULK_OPERATIONS, label: 'Bulk operations' },
    ],
  },
];
