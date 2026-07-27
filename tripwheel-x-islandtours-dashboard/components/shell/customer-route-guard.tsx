'use client';

import { isCustomerView } from '@/lib/rbac-utils';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Single source of truth for which routes the customer VIEW may open - any
 * session that entered through the /account door (multi-hat staff included),
 * or a Role.USER session with no surface. The sidebar only HIDES
 * operator/admin links; a typed URL would otherwise render a broken admin
 * shell (backend 403s protect the data, not the page). Server layouts cannot
 * read the pathname per-navigation, so this small client leaf redirects
 * instead - rendered once by the (app) layout.
 */
const CUSTOMER_ALLOWED = ['/bookings', '/payments', '/profile'];

export function CustomerRouteGuard({
    role,
    surface,
}: {
    role?: string;
    surface?: string | null;
}) {
    const pathname = usePathname();
    const router = useRouter();

    const allowed =
        pathname === '/' || // the root page owns its own view redirect
        CUSTOMER_ALLOWED.some(p => pathname.startsWith(p));

    useEffect(() => {
        if (isCustomerView(role, surface) && !allowed) {
            router.replace('/bookings');
        }
    }, [role, surface, allowed, router]);

    return null;
}
