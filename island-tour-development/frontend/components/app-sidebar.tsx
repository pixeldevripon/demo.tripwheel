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
    userImage?: string | null;
}

export function AppSidebar({ userRole, userName, userImage, ...props }: AppSidebarProps) {
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
            <SidebarFooter className="border-t border-border/40 p-2">
                <div className='flex items-center gap-3 p-3 rounded-xl hover:bg-sidebar-accent transition-colors group cursor-pointer'>
                    <div className='relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold text-sm overflow-hidden border border-border/50 shadow-sm'>
                        {userImage ? (
                            <img src={userImage} alt={userName} className="h-full w-full object-cover" />
                        ) : (
                            userName?.charAt(0)?.toUpperCase() ?? 'U'
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                    </div>
                    <div className='flex flex-col min-w-0 flex-1'>
                        <span className='text-sm font-semibold font-dm-sans truncate text-foreground/90'>
                            {userName ?? 'User'}
                        </span>
                        <span className='text-[10px] text-muted-foreground uppercase tracking-wider font-bold opacity-60 mt-0.5'>
                            {userRole?.replace('_', ' ')}
                        </span>
                    </div>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}

