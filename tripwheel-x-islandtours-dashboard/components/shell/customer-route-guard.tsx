'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Single source of truth for which routes a customer (Role.USER) may open.
 * The sidebar only HIDES operator/admin links; a typed URL would otherwise
 * render a broken admin shell (backend 403s protect the data, not the page).
 * Server layouts cannot read the pathname per-navigation, so this small
 * client leaf redirects instead - rendered once by the (app) layout.
 */
const CUSTOMER_ALLOWED = ['/bookings', '/payments', '/profile'];

export function CustomerRouteGuard({ role }: { role?: string }) {
    const pathname = usePathname();
    const router = useRouter();

    const allowed =
        pathname === '/' || // the root page owns its own USER redirect
        CUSTOMER_ALLOWED.some(p => pathname.startsWith(p));

    useEffect(() => {
        if (role === 'USER' && !allowed) {
            router.replace('/bookings');
        }
    }, [role, allowed, router]);

    return null;
}
