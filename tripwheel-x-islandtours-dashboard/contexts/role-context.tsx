'use client';

import { createContext, useContext } from 'react';
import { ROLE_PERMISSIONS, type PermissionKey, type RoleKey } from '@/lib/config/rbac';

interface RoleContextValue {
  role: string | undefined;
  can: (permission: PermissionKey) => boolean;
  canAny: (permissions: PermissionKey[]) => boolean;
}

const RoleContext = createContext<RoleContextValue>({
  role: undefined,
  can: () => false,
  canAny: () => false,
});

export function RoleProvider({
  role,
  children,
}: {
  role?: string;
  children: React.ReactNode;
}) {
  const permissions: PermissionKey[] = role
    ? (ROLE_PERMISSIONS[role as RoleKey] ?? [])
    : [];

  function can(permission: PermissionKey): boolean {
    return permissions.includes(permission);
  }

  function canAny(perms: PermissionKey[]): boolean {
    return perms.some((p) => permissions.includes(p));
  }

  return (
    <RoleContext.Provider value={{ role, can, canAny }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  return useContext(RoleContext);
}
