'use client';

import * as React from 'react';
import { useMemo } from 'react';

import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Image from 'next/image';
import Link from 'next/link';

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { ROLE_PERMISSIONS } from '@/lib/config/rbac';
import { filterNavGroups } from '@/lib/rbac-utils';
import { getNavigations } from '@/navigations/navigations';
import { NavMain } from './nav-main';

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
    userRole?: string;
    userName?: string;
    userImage?: string | null;
}

/**
 * Premium shell sidebar (task 2026-07-17): the rail reads as a WORKSPACE, not
 * a menu - brand header, frequency-grouped nav (permission-filtered), and an
 * identity footer that opens the profile. Collapses to a 56px icon rail
 * (tooltips take over labels; the wordmark and footer text hide).
 */
export function AppSidebar({
    userRole,
    userName,
    userImage,
    ...props
}: AppSidebarProps) {
    const navData = getNavigations();
    // Mobile: the sidebar is an overlay sheet - navigating via the logo must
    // dismiss it just like the NavMain links do. No-op on desktop.
    const { setOpenMobile } = useSidebar();

    const filteredNav = useMemo(() => {
        const userPermissions: string[] =
            (ROLE_PERMISSIONS as Record<string, string[]>)[userRole ?? ''] ??
            [];
        return filterNavGroups(navData.dashboard, userPermissions);
    }, [userRole, navData.dashboard]);

    return (
        <Sidebar collapsible='icon' {...props}>
            <SidebarHeader className='px-3 pt-3'>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <Link
                            href='/'
                            onClick={() => setOpenMobile(false)}
                            className='flex items-center gap-2.5 rounded-md px-1.5 py-1 transition-colors duration-fast hover:bg-sidebar-accent/60'>
                            <Image
                                src='/logo/logo-light.svg'
                                alt='Island Tours'
                                width={50}
                                height={50}
                                priority
                                className='h-4 w-auto shrink-0 object-contain dark:hidden'
                            />
                            <Image
                                src='/logo/logo-dark.svg'
                                alt='Island Tours'
                                width={50}
                                height={50}
                                priority
                                className='h-4 w-auto shrink-0 object-contain hidden dark:block'
                            />
                        </Link>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain groups={filteredNav} />
            </SidebarContent>

    {/*         <SidebarFooter className='border-t border-sidebar-line p-2'>
                <Link
                    href='/profile'
                    title='Your profile'
                    className='group/identity flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors duration-fast hover:border-sidebar-line hover:bg-sidebar-accent/60'>
                    <span className='relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-subtle text-sm font-semibold text-primary-subtle-content'>
                        {userImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={userImage}
                                alt={userName ?? 'User'}
                                className='h-full w-full object-cover'
                            />
                        ) : (
                            (userName?.charAt(0)?.toUpperCase() ?? 'U')
                        )}
                    </span>
                    <span className='min-w-0 flex-1 group-data-[collapsible=icon]:hidden'>
                        <span className='block truncate text-sm font-semibold text-sidebar-foreground'>
                            {userName ?? 'User'}
                        </span>
                        <span className='block text-2xs font-semibold tracking-caps uppercase text-sidebar-content/70'>
                            {userRole?.replace(/_/g, ' ') ?? ''}
                        </span>
                    </span>
                    <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className='size-4 shrink-0 text-sidebar-content/50 transition-transform duration-fast group-hover/identity:translate-x-0.5 group-data-[collapsible=icon]:hidden'
                    />
                </Link>
            </SidebarFooter> */}
        </Sidebar>
    );
}


