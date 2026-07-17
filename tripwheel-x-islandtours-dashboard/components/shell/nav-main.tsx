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
import { useBookings } from '@/hooks/bookings/use-bookings';
import { useSpotlightQueue } from '@/hooks/tiers/use-tiers';
import type { NavGroup } from '@/lib/rbac-utils';
import { cn } from '@/lib/utils';

interface NavMainProps {
    groups: NavGroup[];
}

function CountChip({ count }: { count: number }) {
    if (count <= 0) return null;
    return (
        <span className='ml-auto rounded-full bg-primary-subtle px-1.5 text-2xs font-semibold tabular-nums text-primary-subtle-content'>
            {count > 99 ? '99+' : count}
        </span>
    );
}

/** Open cancellation requests awaiting admin review. */
function CancellationsBadge() {
    const { data } = useBookings({ limit: 1, cancellationRequested: true });
    return <CountChip count={data?.total ?? 0} />;
}

/** Spotlight requests waiting for an approve/reject decision. */
function SpotlightBadge() {
    const { data } = useSpotlightQueue({ status: 'REQUESTED' });
    return <CountChip count={data?.data?.length ?? 0} />;
}

/**
 * Actionable count badges (04 §1.4: badges only where a number demands
 * action). Keyed by nav url; each badge only mounts when its item survived
 * permission filtering, so operators never fire admin-only queries.
 */
const NAV_BADGES: Record<string, React.ComponentType> = {
    'cancellation-requests': CancellationsBadge,
    spotlight: SpotlightBadge,
};

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
                                    const DynamicBadge = item.url
                                        ? NAV_BADGES[item.url]
                                        : undefined;
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
                                                    {item.badge != null ? (
                                                        <span className='ml-auto rounded-full bg-primary-subtle px-1.5 text-2xs font-semibold tabular-nums text-primary-subtle-content'>
                                                            {item.badge}
                                                        </span>
                                                    ) : DynamicBadge ? (
                                                        <DynamicBadge />
                                                    ) : null}
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
