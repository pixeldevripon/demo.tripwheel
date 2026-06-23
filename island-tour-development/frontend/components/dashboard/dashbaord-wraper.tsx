'use client';

import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { RoleProvider } from '@/contexts/role-context';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

interface DashboardWrapperProps {
    children: React.ReactNode;
    userName?: string;
    userEmail?: string;
    userRole?: string;
    userImage?: string | null;
}

// Enter-only slide-up. We deliberately avoid AnimatePresence + mode="wait" here:
// in the App Router the layout swaps `children` to the next page in lockstep with
// `pathname`, so an exit-animating wrapper would briefly hold the previous keyed
// subtree while it already contains the new page's tree - a hook-count mismatch
// that throws "Rendered more hooks than during the previous render". A keyed
// motion.div remounts on navigation and replays the entrance with no stale subtree.
const slideUp = {
    initial: { y: '0.5%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
};

export default function DashboardWrapper({
    children,
    userName,
    userEmail,
    userRole,
    userImage,
}: DashboardWrapperProps) {
    const pathname = usePathname();

    return (
        <RoleProvider role={userRole}>
        <SidebarProvider
            className='bg-[#f1f4fa] shadow-none font-sans'
            style={
                {
                    '--sidebar-width': 'calc(var(--spacing) * 72)',
                    '--header-height': 'calc(var(--spacing) * 17.5)',
                } as React.CSSProperties
            }>
            <AppSidebar
                variant='inset'
                userRole={userRole}
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
                <div className='flex flex-1 flex-col p-5 bg-[#F4F7FB] dark:bg-background'>
                    <div className='@container/main flex flex-1 flex-col gap-2'>
                        <div suppressHydrationWarning className={cn()}>
                            <motion.div
                                key={pathname}
                                initial={slideUp.initial}
                                animate={slideUp.animate}
                                transition={{
                                    stiffness: 300,
                                    duration: 0.2,
                                }}
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

