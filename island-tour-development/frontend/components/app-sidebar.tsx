'use client';

import * as React from 'react';
import { useMemo } from 'react';

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { filterNavigationByPermissions } from '@/lib/rbac-utils';
import { getNavigations } from '@/navigations/navigations';
import { ROLE_PERMISSIONS } from '@/RBAC.config';
import { CommandIcon } from 'lucide-react';
import { NavMain } from './nav-main';

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
    userRole?: string;
    userName?: string;
}

export function AppSidebar({ userRole, userName, ...props }: AppSidebarProps) {
    const navData = getNavigations();

    const filteredNav = useMemo(() => {
        const userPermissions: string[] =
            (ROLE_PERMISSIONS as Record<string, string[]>)[userRole ?? ''] ??
            [];
        return filterNavigationByPermissions(
            navData.dashboard,
            userPermissions
        );
    }, [userRole, navData.dashboard]);

    return (
        <Sidebar collapsible='offcanvas' {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            className='data-[slot=sidebar-menu-button]:p-1.5!'>
                            <a href='#'>
                                <CommandIcon className='size-5!' />
                                <span className='text-base font-semibold font-dm-sans'>
                                    Island Tours
                                </span>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={filteredNav} />
            </SidebarContent>
            <SidebarFooter>
                <div className='flex items-center gap-2 p-4'>
                    <div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm'>
                        {userName?.charAt(0)?.toUpperCase() ?? 'U'}
                    </div>
                    <div className='flex flex-col'>
                        <span className='text-sm font-semibold font-dm-sans'>
                            {userName ?? 'User'}
                        </span>
                        <span className='text-xs text-muted-foreground capitalize'>
                            {userRole?.toLowerCase() ?? 'Member'}
                        </span>
                    </div>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}

