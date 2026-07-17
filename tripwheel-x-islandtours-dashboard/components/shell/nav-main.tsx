'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { NavGroup } from '@/lib/rbac-utils';
import { cn } from '@/lib/utils';

interface NavMainProps {
    groups: NavGroup[];
}

/**
 * Grouped flat navigation (04 §1.2). Groups arrive already permission-filtered
 * (filterNavGroups) - an empty group never reaches this component.
 *
 * Active state is bg-sidebar-accent PLUS a 2px leading indicator (04 §1.4):
 * color is never the only cue.
 *
 * Premium shell (2026-07-17): groups stagger in on first mount (framer,
 * reduced-motion aware); labels use the micro-label style; tooltips carry
 * the labels in the collapsed icon rail.
 *
 * Nav `url`s are relative and root-less ('trips', '' for Overview), so the
 * href is built here. The dashboard serves at the root - concatenating a '/'
 * root would yield '//trips', which a browser reads as protocol-relative.
 */
const toHref = (url?: string) => (!url ? '/' : `/${url.replace(/^\/+/, '')}`);

export function NavMain({ groups }: NavMainProps) {
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();

    const isPathActive = (url?: string) => {
        const target = toHref(url);
        const normPath = pathname.replace(/\/+$/, '') || '/';
        const normTarget = target.replace(/\/+$/, '') || '/';
        // Overview ('/') matches only exactly; sections own their subtree so
        // /trips/abc/edit still lights Tours.
        if (normTarget === '/') return normPath === '/';
        return normPath === normTarget || normPath.startsWith(`${normTarget}/`);
    };

    return (
        <>
            {groups.map((group, groupIndex) => (
                <motion.div
                    key={group.label ?? 'main'}
                    initial={
                        reduceMotion ? false : { opacity: 0, y: 6 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        duration: 0.26,
                        delay: groupIndex * 0.06,
                        ease: [0.25, 1, 0.5, 1],
                    }}>
                    <SidebarGroup>
                        {group.label && (
                            <SidebarGroupLabel className='px-4 text-2xs font-semibold tracking-caps uppercase text-sidebar-content/60 group-data-[collapsible=icon]:hidden'>
                                {group.label}
                            </SidebarGroupLabel>
                        )}
                        <SidebarGroupContent>
                            <SidebarMenu className='gap-0.5 px-2'>
                                {group.items.map(item => {
                                    const active = isPathActive(item.url);
                                    return (
                                        <SidebarMenuItem key={item.title}>
                                            <SidebarMenuButton
                                                asChild
                                                tooltip={item.title}
                                                isActive={active}
                                                className={cn(
                                                    'relative h-10 rounded-md transition-colors duration-fast',
                                                    active
                                                        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                                                        : 'hover:bg-sidebar-accent/50',
                                                )}>
                                                <Link href={toHref(item.url)}>
                                                    {/* 2px leading indicator - the non-color active cue */}
                                                    <span
                                                        aria-hidden
                                                        className={cn(
                                                            'absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full',
                                                            active
                                                                ? 'bg-primary'
                                                                : 'bg-transparent',
                                                        )}
                                                    />
                                                    {item.icon && (
                                                        <HugeiconsIcon
                                                            icon={item.icon}
                                                            className='size-5! shrink-0'
                                                        />
                                                    )}
                                                    <span className='text-sm'>
                                                        {item.title}
                                                    </span>
                                                    {item.badge != null && (
                                                        <span className='ml-auto rounded-full bg-primary-subtle px-1.5 text-2xs font-semibold tabular-nums text-primary-subtle-content'>
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                })}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </motion.div>
            ))}
        </>
    );
}
