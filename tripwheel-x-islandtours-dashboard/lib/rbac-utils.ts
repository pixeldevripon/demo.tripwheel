import type { IconSvgElement } from '@hugeicons/react';
/**
 * Filters a navigation tree so only items the user has permission to see are shown.
 * An item is visible if:
 *   - It has no `permissions` array (always visible)
 *   - The user holds at least one of the item's required permissions
 *
 * The filter is applied recursively so child items are also filtered.
 * A parent item that requires no permission but whose ALL children are hidden
 * is itself removed from the tree.
 */

export interface NavItem {
  title: string;
  url?: string;
  icon?: IconSvgElement;
  isActive?: boolean;
  permissions?: string[];
  items?: NavItem[];
  badge?: string | number;
}

/** A labelled sidebar section (04 §1.2). */
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/**
 * Filters each group's items, then drops groups left empty - a group header
 * must never render over nothing (04 §1.3: for an operator, Curate and
 * Configure are absent, not greyed).
 */
export function filterNavGroups(
  groups: NavGroup[] | undefined,
  userPermissions: string[]
): NavGroup[] {
  if (!groups || !Array.isArray(groups)) return [];
  return groups
    .map((group) => ({
      ...group,
      items: filterNavigationByPermissions(group.items, userPermissions),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * The permission set to gate UI with: the backend's EFFECTIVE grants when we
 * have them (fine-grained staff seats), the static role map only as a
 * transient-failure fallback - except STAFF, whose fallback is empty rather
 * than the broad legacy list, since guessing wide for a staff seat shows them
 * doors their seat may not open. Backend guards enforce regardless; this only
 * decides what we render.
 *
 * Shared by the sidebar and the command palette so a staff member cannot see
 * an entry in one surface that the other correctly hides.
 */
export function resolvePermissions(
  role: string | undefined,
  userPermissions: string[] | undefined,
  roleMap: Record<string, string[]>
): string[] {
  if (userPermissions) return userPermissions;
  if (role === 'STAFF') return [];
  return roleMap[role ?? ''] ?? [];
}

/** Roles that get the customer surface instead of the operator/admin one. */
export function isCustomerRole(role?: string): boolean {
  return role === 'USER';
}

/**
 * Whether this session renders the CUSTOMER view - decided by which login
 * door minted the session (`session.surface`, stamped server-side and never
 * client-writable), falling back to role for surface-less sessions (created
 * before surfaces existed, or by verify-email flows).
 *
 * This is what lets one account wear many hats: a STAFF-role user who signed
 * in through /account gets the traveler view of their own bookings, while the
 * same account through /staff gets the staff dashboard. Purely presentational
 * - every API route authorizes independently server-side.
 */
export function isCustomerView(
  role?: string,
  surface?: string | null
): boolean {
  if (surface === 'account') return true;
  if (surface) return false; // portal/staff/admin door -> dashboard view
  return isCustomerRole(role);
}

/**
 * The navigation a session may actually see - the ONE place that decision
 * lives.
 *
 * A customer VIEW gets the SEPARATE customer tree, never the operator tree
 * filtered by permission. `Role.USER` holds `VIEW_TRIPS` (legacy) plus the
 * self-scoped `VIEW_BOOKINGS`/`VIEW_PAYMENTS` grants, so permission-filtering
 * the operator tree leaves Tours, Translations and Cancellations standing -
 * which is exactly how they leaked into the command palette while the sidebar
 * looked correct. Both surfaces resolve through here so they cannot disagree
 * again.
 */
export function navGroupsForRole(
  nav: { dashboard: NavGroup[]; customer: NavGroup[] },
  role: string | undefined,
  userPermissions: string[],
  surface?: string | null
): NavGroup[] {
  const groups = isCustomerView(role, surface) ? nav.customer : nav.dashboard;
  return filterNavGroups(groups, userPermissions);
}

export function filterNavigationByPermissions(
  items: NavItem[] | undefined,
  userPermissions: string[]
): NavItem[] {
  if (!items || !Array.isArray(items)) return [];

  return items.reduce<NavItem[]>((acc, item) => {
    // Check if user has permission for this item
    const hasPermission =
      !item.permissions ||
      item.permissions.length === 0 ||
      item.permissions.some((p) => userPermissions.includes(p));

    if (!hasPermission) return acc;

    // Recursively filter children
    const filteredChildren = item.items
      ? filterNavigationByPermissions(item.items, userPermissions)
      : undefined;

    // If the item has children defined but all were filtered out, skip item
    if (item.items && item.items.length > 0 && filteredChildren?.length === 0) {
      return acc;
    }

    acc.push({
      ...item,
      items: filteredChildren,
    });

    return acc;
  }, []);
}
