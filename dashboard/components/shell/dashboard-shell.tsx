'use client';

import { AppSidebar } from '@/components/shell/app-sidebar';
import { InboxDigestDialog } from '@/components/common/inbox-digest-dialog';
import { SiteHeader } from '@/components/shell/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { RoleProvider } from '@/contexts/role-context';
import { dashboardPageEnter } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface DashboardShellProps {
    children: React.ReactNode;
    userName?: string;
    userEmail?: string;
    userRole?: string;
    /** Which login door minted the session; null = shape the view by role. */
    userSurface?: string | null;
    /** Effective permission set from the backend (staff/team grants included). */
    userPermissions?: string[];
    userImage?: string | null;
}

/**
 * The dashboard chrome: sidebar, header, and the animated content pane.
 *
 * Was `components/dashboard/dashbaord-wraper.tsx` (sic) in the monorepo. Renamed
 * on the way over, and its two hardcoded hexes (`#f1f4fa` gutter, `#F4F7FB`
 * pane) are now the `shell-gutter` / `shell-content` tokens - the gutter had no
 * dark variant, so dark mode framed the pane in light lavender (defect D-4).
 *
 * Enter-only page transition. We deliberately avoid AnimatePresence + mode="wait"
 * here: in the App Router the layout swaps `children` to the next page in lockstep
 * with `pathname`, so an exit-animating wrapper would briefly hold the previous keyed
 * subtree while it already contains the new page's tree - a hook-count mismatch
 * that throws "Rendered more hooks than during the previous render". A keyed
 * motion.div remounts on navigation and replays the entrance with no stale subtree.
 */
export default function DashboardShell({
    children,
    userName,
    userEmail,
    userRole,
    userSurface,
    userPermissions,
    userImage,
}: DashboardShellProps) {
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();

    // False during SSR + first client render so the initial load paints plain
    // visible HTML; true from then on, so only route changes animate.
    const [ready, setReady] = useState(false);
    useEffect(() => setReady(true), []);

    // `will-change` promotes the pane to its own compositor layer. That helps
    // DURING the transition and hurts after it: a permanent
    // `will-change-transform` class (what this used to carry) keeps a full-page
    // layer alive for the lifetime of the route, which on a long table costs
    // memory and can soften text rendering. So arm it per navigation and drop
    // it the moment the animation settles.
    const [animating, setAnimating] = useState(false);
    useEffect(() => {
        setAnimating(true);
    }, [pathname]);
    const clearWillChange = useCallback(() => setAnimating(false), []);

    return (
        <RoleProvider
            role={userRole}
            surface={userSurface}
            permissions={userPermissions}>
            {/* [--sidebar-width]! must stay important: SidebarProvider sets its own
                16rem default via inline style, which a plain class cannot beat. */}
            <SidebarProvider className='bg-shell-gutter shadow-none font-sans [--sidebar-width:--spacing(72)]! [--header-height:--spacing(17.5)]'>
                <AppSidebar
                    variant='inset'
                    userRole={userRole}
                    userPermissions={userPermissions}
                    userName={userName}
                    userImage={userImage}
                />
                {/* No overflow-hidden here: it made the pane a clip container,
                    which silently cut off anything wider than the pane AND
                    killed every `sticky` inside (sticky resolves against the
                    nearest scrollport, and a hidden-overflow pane never
                    scrolls - the document does). The rounded corners are
                    painted by the header (rounded-t) and content pane
                    (rounded-b) instead. */}
                <SidebarInset className='bg-white dark:bg-sidebar shadow-none! min-w-0 md:peer-data-[variant=inset]:rounded-2xl'>
                    <SiteHeader
                        userName={userName}
                        userEmail={userEmail}
                        userRole={userRole}
                        userPermissions={userPermissions}
                        userImage={userImage}
                    />
                    <div className='flex flex-1 flex-col bg-shell-content p-4 md:rounded-b-2xl'>
                        <div className='@container/main flex flex-1 flex-col gap-2'>
                            <div suppressHydrationWarning>
                                <motion.div
                                    key={pathname}
                                    initial={
                                        ready && !reduceMotion
                                            ? { opacity: 0, y: 8 }
                                            : false
                                    }
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={dashboardPageEnter}
                                    onAnimationComplete={clearWillChange}
                                    className={cn(
                                        'lg:p-8 relative',
                                        animating && 'will-change-transform',
                                    )}>
                                    {children}
                                </motion.div>
                            </div>
                        </div>
                    </div>
                </SidebarInset>
            </SidebarProvider>
            {/* Mounted at the shell, not per page: it must fire once per
                session, and a page-level mount would re-run it on every
                navigation. It renders null unless the server says something
                arrived since this account last saw the digest. */}
            <InboxDigestDialog />
        </RoleProvider>
    );
}
