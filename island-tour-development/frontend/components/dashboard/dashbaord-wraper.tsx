'use client';

import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

interface DashboardWrapperProps {
    children: React.ReactNode;
    userName?: string;
    userEmail?: string;
    userRole?: string;
    userImage?: string | null;
}

// Animation variants for super smooth slide directions matching legacy project
const slideVariants = {
    slideUp: {
        initial: { y: '0.5%', opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: '-0.5%', opacity: 0 },
    },
    fade: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
    },
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
                            <AnimatePresence mode='wait'>
                                <motion.div
                                    key={pathname}
                                    initial={slideVariants.slideUp.initial}
                                    animate={slideVariants.slideUp.animate}
                                    exit={slideVariants.slideUp.exit}
                                    transition={{
                                        stiffness: 300,
                                        duration: 0.2,
                                    }}
                                    className='lg:p-8 will-change-transform relative'>
                                    {children}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}

