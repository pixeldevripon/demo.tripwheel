import { Permission } from '@prisma/client';

/**
 * Default operator-team designations, provisioned for EVERY operator:
 * on operator create (operators.service) and backfilled for existing
 * operators by prisma/seed.ts. Rows are written with `isSystem: true`,
 * which carries the same semantics as the platform-side system rows:
 * rename/delete are blocked, but owners edit the permission SETS freely
 * (the point of a template is that it can be tuned to the business).
 *
 * Every permission here must sit inside OPERATOR_SEAT_CEILING
 * (staff.config.ts) - enforced by team-designations.config.spec.ts. The
 * effective-permission engine would silently drop anything outside the
 * ceiling anyway; the test keeps the templates honest instead of relying
 * on that.
 *
 * STAFF_BASE_PERMISSIONS (VIEW_PROFILE/EDIT_PROFILE) are deliberately NOT
 * granted: the engine adds that floor to every active seat regardless, and
 * the dashboard's grant matrix excludes them - listing them here only makes
 * the "N/total granted" counts overflow the total.
 *
 * This file deliberately imports ONLY @prisma/client so prisma/seed.ts can
 * pull it in without dragging the Nest config graph along.
 */
export interface TeamDesignationTemplate {
  name: string;
  description: string;
  permissions: Permission[];
}

/**
 * The createMany row shape for one operator's default set. Shared by
 * operators.service.create, prisma/seed.ts and the demo seed so the three
 * write sites can never drift.
 */
export function defaultTeamDesignationRows(operatorId: string) {
  return DEFAULT_TEAM_DESIGNATIONS.map((template) => ({
    operatorId,
    name: template.name,
    description: template.description,
    permissions: [...template.permissions],
    isSystem: true,
  }));
}

export const DEFAULT_TEAM_DESIGNATIONS: readonly TeamDesignationTemplate[] = [
  {
    name: 'Operations Manager',
    description:
      'Runs the operation day to day: tours, availability, bookings, content and the numbers. Everything a seat can hold except payouts and team management (owner-only).',
    permissions: [
      Permission.VIEW_TRIPS,
      Permission.CREATE_TRIP,
      Permission.EDIT_TRIP,
      Permission.DELETE_TRIP,
      Permission.MANAGE_AVAILABILITY,
      Permission.STOP_SELL,
      Permission.VIEW_BOOKINGS,
      Permission.VIEW_BOOKING_FINANCIALS,
      Permission.EDIT_BOOKING,
      Permission.VIEW_PAYMENTS,
      Permission.VIEW_ORDERS,
      Permission.VIEW_REVIEWS,
      Permission.VIEW_ANALYTICS,
      Permission.EXPORT_DATA,
      Permission.VIEW_CONTENT,
      Permission.CREATE_CONTENT,
      Permission.EDIT_CONTENT,
      Permission.DELETE_CONTENT,
      Permission.VIEW_MEDIA,
      Permission.UPLOAD_MEDIA,
      Permission.VIEW_OPERATOR_PROFILE,
      Permission.EDIT_OPERATOR_PROFILE,
      Permission.VIEW_USERS,
      Permission.VIEW_CATEGORIES,
      Permission.VIEW_BLOGS,
    ],
  },
  {
    name: 'Reservations Agent',
    description:
      'Front desk for bookings: full booking rows (amounts + traveler contact), booking changes, and opening/closing departures.',
    permissions: [
      Permission.VIEW_TRIPS,
      Permission.VIEW_BOOKINGS,
      Permission.VIEW_BOOKING_FINANCIALS,
      Permission.EDIT_BOOKING,
      Permission.VIEW_PAYMENTS,
      Permission.VIEW_ORDERS,
      Permission.MANAGE_AVAILABILITY,
      Permission.STOP_SELL,
    ],
  },
  {
    name: 'Content Editor',
    description:
      'Maintains tour listings, copy and media. No access to bookings or money.',
    permissions: [
      Permission.VIEW_TRIPS,
      Permission.CREATE_TRIP,
      Permission.EDIT_TRIP,
      Permission.VIEW_CONTENT,
      Permission.CREATE_CONTENT,
      Permission.EDIT_CONTENT,
      Permission.DELETE_CONTENT,
      Permission.VIEW_MEDIA,
      Permission.UPLOAD_MEDIA,
      Permission.VIEW_CATEGORIES,
      Permission.VIEW_BLOGS,
      Permission.VIEW_REVIEWS,
    ],
  },
  {
    // The matrix v1.7 dock-staff grant: VIEW_BOOKINGS without
    // VIEW_BOOKING_FINANCIALS = the manifest projection (headcounts, no
    // amounts or traveler contact), plus stop-sell for the day-of call.
    name: 'Guide',
    description:
      'Day-of-tour crew: sees the manifest (no amounts or traveler contact) and can close or reopen departures.',
    permissions: [
      Permission.VIEW_TRIPS,
      Permission.VIEW_BOOKINGS,
      Permission.STOP_SELL,
    ],
  },
];
