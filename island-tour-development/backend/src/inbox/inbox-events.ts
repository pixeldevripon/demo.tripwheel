import { InboxCategory, InboxEvent, Permission } from '@prisma/client';

/**
 * The routing table for every in-app notification.
 *
 * ONE place decides who hears about a thing. A call site says "this happened,
 * about this entity, here is the copy"; it never says who to tell. That split
 * is what stops the answer to "can a guide-level seat see payout amounts?" from
 * being re-derived, differently, at fifteen call sites.
 *
 * `permission` is the load-bearing field, and the rule behind it is:
 *
 *   **Gate a notification on the permission that gates the page it links to.**
 *
 * A notification is a link. A link to a screen the recipient cannot open is a
 * dead end at best; at worst the title leaks the existence of a record they are
 * not cleared for - a seat learning a settlement amount from a bell it should
 * never have received. The effective-permission engine
 * (`StaffPermissionsService`) is the only authority consulted, so a designation
 * change moves the inbox and the sidebar together.
 */
export interface InboxEventDefinition {
  /** Drives the sidebar badge - must match a real nav section. */
  category: InboxCategory;
  /**
   * `platform` - Island Tours staff and admins.
   * `operator` - the owning operator's account: its owner seat and its team.
   * `both`     - each side hears it, filtered by the same permission.
   *
   * `both` is for events where the two audiences want it for DIFFERENT reasons
   * and neither is the actor - a nightly job demoting a tour is the operator's
   * bad news and the platform's commercial signal. Reach for it sparingly: an
   * event that fires on every booking would bury the handful of things that
   * actually need a human at Island Tours.
   */
  audience: 'platform' | 'operator' | 'both';
  /** The permission gating the destination page. See the rule above. */
  permission: Permission;
}

export const INBOX_EVENTS: Record<InboxEvent, InboxEventDefinition> = {
  // ── Tours ──────────────────────────────────────────────────────────────────
  // Publishing is always Island Tours' (access-roles conflict #1), so the
  // submission goes to the platform and all three verdicts come back.
  [InboxEvent.TOUR_SUBMITTED_FOR_REVIEW]: {
    category: InboxCategory.TOURS,
    audience: 'platform',
    permission: Permission.MANAGE_TRIPS,
  },
  [InboxEvent.TOUR_APPROVED]: {
    category: InboxCategory.TOURS,
    audience: 'operator',
    permission: Permission.EDIT_TRIP,
  },
  [InboxEvent.TOUR_CHANGES_REQUESTED]: {
    category: InboxCategory.TOURS,
    audience: 'operator',
    permission: Permission.EDIT_TRIP,
  },
  [InboxEvent.TOUR_PUBLISHED]: {
    category: InboxCategory.TOURS,
    audience: 'operator',
    permission: Permission.EDIT_TRIP,
  },
  /**
   * The silent failure this whole feature is most worth building for: a tour
   * that is LIVE and invisible because its departures ran out. Nothing told
   * anyone before - you had to open the tour and notice.
   */
  [InboxEvent.TOUR_UNLISTED_NO_DEPARTURES]: {
    category: InboxCategory.TOURS,
    // `both`: the operator has to fix it, and Island Tours needs to know a
    // published tour has gone dark - that is inventory quietly leaving the
    // marketplace, which nothing else reports.
    audience: 'both',
    permission: Permission.EDIT_TRIP,
  },

  // ── Commercial ─────────────────────────────────────────────────────────────
  [InboxEvent.SPOTLIGHT_REQUESTED]: {
    category: InboxCategory.PROMOTION,
    audience: 'platform',
    permission: Permission.APPROVE_SPOTLIGHT,
  },
  [InboxEvent.SPOTLIGHT_APPROVED]: {
    category: InboxCategory.PROMOTION,
    audience: 'operator',
    permission: Permission.EDIT_TRIP,
  },
  [InboxEvent.SPOTLIGHT_REJECTED]: {
    category: InboxCategory.PROMOTION,
    audience: 'operator',
    permission: Permission.EDIT_TRIP,
  },
  /**
   * The nightly eligibility job moved a tour down a tier. No actor, and both
   * sides need it: the operator loses ranking and rate, and Island Tours has
   * just lost commission on a tour nobody chose to change.
   */
  [InboxEvent.TIER_DEMOTED]: {
    category: InboxCategory.PROMOTION,
    audience: 'both',
    permission: Permission.EDIT_TRIP,
  },

  // ── Bookings ───────────────────────────────────────────────────────────────
  // Operator-only on purpose. Platform staff read bookings through the
  // Bookings screen; one bell row per booking across every operator would bury
  // everything else in the inbox on the first busy day.
  [InboxEvent.BOOKING_CONFIRMED]: {
    category: InboxCategory.BOOKINGS,
    audience: 'operator',
    permission: Permission.VIEW_BOOKINGS,
  },
  [InboxEvent.BOOKING_CANCELLED]: {
    category: InboxCategory.BOOKINGS,
    audience: 'operator',
    permission: Permission.VIEW_BOOKINGS,
  },
  // Cancellations need a human at Island Tours: the refund is ours to execute.
  [InboxEvent.BOOKING_CANCELLATION_REQUESTED]: {
    category: InboxCategory.CANCELLATIONS,
    audience: 'platform',
    permission: Permission.EDIT_BOOKING,
  },
  [InboxEvent.BOOKING_OPERATOR_REPORTED_CANCELLATION]: {
    category: InboxCategory.CANCELLATIONS,
    audience: 'platform',
    permission: Permission.EDIT_BOOKING,
  },
  [InboxEvent.BOOKING_OPERATOR_REPORTED_NON_PAYMENT]: {
    category: InboxCategory.PAYMENTS,
    audience: 'platform',
    permission: Permission.MANAGE_PAYMENTS,
  },

  // ── Reviews ────────────────────────────────────────────────────────────────
  [InboxEvent.REVIEW_SUBMITTED]: {
    category: InboxCategory.REVIEWS,
    audience: 'platform',
    permission: Permission.APPROVE_REVIEW,
  },
  [InboxEvent.REVIEW_PUBLISHED]: {
    category: InboxCategory.REVIEWS,
    audience: 'operator',
    permission: Permission.VIEW_REVIEWS,
  },

  // ── Money ──────────────────────────────────────────────────────────────────
  // VIEW_BOOKING_FINANCIALS, not VIEW_BOOKINGS: conflict #7 keeps amounts away
  // from guide-level seats, and a settlement notification is an amount.
  [InboxEvent.SETTLEMENT_STATEMENT_READY]: {
    category: InboxCategory.SETTLEMENTS,
    audience: 'operator',
    permission: Permission.VIEW_BOOKING_FINANCIALS,
  },

  // ── Team ───────────────────────────────────────────────────────────────────
  //
  // Invite only. "Seat activated" was specified and then dropped: the flip to
  // ACTIVE happens in a Better Auth login hook, which runs outside Nest DI and
  // would need its own InboxService - and therefore its own
  // StaffPermissionsService, the exact duplicate instance that module forbids.
  // A registered-but-never-emitted event is a registry that lies, so it is gone
  // rather than stubbed. It is also the least actionable of the set: the owner
  // already heard about the invite, and "they signed in" asks nothing of them.
  [InboxEvent.TEAM_SEAT_INVITED]: {
    category: InboxCategory.TEAM,
    audience: 'operator',
    permission: Permission.MANAGE_TEAM,
  },
};

/** Every category, in the order the dashboard lists them. */
export const INBOX_CATEGORIES = Object.values(InboxCategory);
