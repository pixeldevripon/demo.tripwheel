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
