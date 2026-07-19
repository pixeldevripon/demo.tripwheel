'use client';

import { AppSidebar } from '@/components/shell/app-sidebar';
import { SiteHeader } from '@/components/shell/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { RoleProvider } from '@/contexts/role-context';
import { pageEnter } from '@/lib/motion';
import { motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface DashboardShellProps {
    children: React.ReactNode;
    userName?: string;
    userEmail?: string;
    userRole?: string;
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
    userPermissions,
    userImage,
}: DashboardShellProps) {
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();

    // False during SSR + first client render so the initial load paints plain
    // visible HTML; true from then on, so only route changes animate.
    const [ready, setReady] = useState(false);
    useEffect(() => setReady(true), []);

    return (
        <RoleProvider role={userRole} permissions={userPermissions}>
            {/* [--sidebar-width]! must stay important: SidebarProvider sets its own
                16rem default via inline style, which a plain class cannot beat. */}
            <SidebarProvider className='bg-shell-gutter shadow-none font-sans [--sidebar-width:calc(var(--spacing)*72)]! [--header-height:calc(var(--spacing)*17.5)]'>
                <AppSidebar
                    variant='inset'
                    userRole={userRole}
                    userPermissions={userPermissions}
                    userName={userName}
                    userImage={userImage}
                />
                <SidebarInset className='bg-white dark:bg-sidebar shadow-none! md:peer-data-[variant=inset]:rounded-2xl overflow-hidden'>
                    <SiteHeader
                        userName={userName}
                        userEmail={userEmail}
                        userRole={userRole}
                        userImage={userImage}
                    />
                    <div className='flex flex-1 flex-col bg-shell-content p-4'>
                        <div className='@container/main flex flex-1 flex-col gap-2'>
                            <div suppressHydrationWarning>
                                <motion.div
                                    key={pathname}
                                    initial={
                                        ready && !reduceMotion
                                            ? { opacity: 0, y: 16 }
                                            : false
                                    }
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={pageEnter}
                                    className='lg:p-8 will-change-transform relative'>
                                    {children}
                                </motion.div>
                            </div>
                        </div>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </RoleProvider>
    );
}
