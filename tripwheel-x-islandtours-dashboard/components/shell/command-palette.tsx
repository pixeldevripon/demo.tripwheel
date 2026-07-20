'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowTurnBackwardIcon, Calendar03Icon, Globe02Icon, MapsIcon, PlusSignIcon, Search01Icon } from '@hugeicons/core-free-icons';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from '@/components/ui/command';
import { useBookings } from '@/hooks/bookings/use-bookings';
import { useDestinations } from '@/hooks/destinations/use-destinations';
import { useAdminTrips, useMyTrips } from '@/hooks/trips/use-trips';
import { Permission, ROLE_PERMISSIONS } from '@/lib/config/rbac';
import {
    isCustomerRole,
    navGroupsForRole,
    resolvePermissions,
} from '@/lib/rbac-utils';
import { getNavigations } from '@/navigations/navigations';

/**
 * Global command palette - Cmd+K (04 §1.4). Jump to any screen, any tour by
 * name, any booking by ref, any destination. "This is the real answer to
 * click depth - it makes the sidebar a map rather than the only road."
 *
 * Entity search is server-side (the same list endpoints the tables use, via
 * the domain hooks) and fires only while the dialog is open with 2+ typed
 * characters - the palette costs nothing while closed. Everything shown is
 * permission-gated with the exact same filter as the sidebar.
 */

const toHref = (url?: string) => (!url ? '/' : `/${url.replace(/^\/+/, '')}`);

function useDebounced<T>(value: T, ms: number): T {
    const [debounced, setDebounced] = React.useState(value);
    React.useEffect(() => {
        const t = setTimeout(() => setDebounced(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return debounced;
}

export function CommandPalette({
    userRole,
    userPermissions,
}: {
    userRole?: string;
    userPermissions?: string[];
}) {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const debouncedQuery = useDebounced(query.trim(), 250);

    // Same resolution as the sidebar: effective backend grants first, static
    // role map only as a fallback. Using the role map unconditionally showed
    // staff palette entries their seat does not actually grant.
    const permissions = React.useMemo(
        () =>
            resolvePermissions(
                userRole,
                userPermissions,
                ROLE_PERMISSIONS as Record<string, string[]>,
            ),
        [userRole, userPermissions],
    );
    const can = React.useCallback(
        (p: string) => permissions.includes(p),
        [permissions],
    );

    // Same resolver the sidebar uses: a customer gets the customer nav, not a
    // permission-filtered operator nav (Role.USER holds VIEW_TRIPS and the
    // self-scoped booking/payment reads, which would otherwise leave Tours,
    // Translations and Cancellations standing in here).
    const navGroups = React.useMemo(
        () => navGroupsForRole(getNavigations(), userRole, permissions),
        [userRole, permissions],
    );

    // ⌘K / Ctrl+K
    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((o) => !o);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    // Entity search - only while open, with a real query.
    const searching = open && debouncedQuery.length >= 2;
    const isAdmin = userRole === 'ADMIN';
    // A customer must never be offered catalogue entities: those results link
    // into operator screens (/trips/:id/edit, /destinations/:id) that they
    // cannot open. Permission alone is not enough of a gate here - Role.USER
    // carries VIEW_TRIPS.
    const isCustomer = isCustomerRole(userRole);

    const myTrips = useMyTrips(
        { search: debouncedQuery, limit: 6 },
        searching && !isAdmin && !isCustomer && can(Permission.VIEW_TRIPS),
    );
    const adminTrips = useAdminTrips(
        { search: debouncedQuery, limit: 6 },
        searching && isAdmin,
    );
    // Bookings stay searchable for customers: the backend scopes USER callers
    // to their OWN rows and the result links to their own bookings page.
    const bookings = useBookings(
        { search: debouncedQuery, limit: 6 },
        searching && can(Permission.VIEW_BOOKINGS),
    );
    // Destinations are few and have no search param - fetch once per open,
    // let cmdk filter them client-side.
    const destinations = useDestinations(
        { limit: 50 },
        open && !isCustomer && can(Permission.VIEW_DESTINATIONS),
    );

    const tours = (isAdmin ? adminTrips.data?.data : myTrips.data?.data) ?? [];
    const bookingRows = bookings.data?.data ?? [];
    const destinationRows = destinations.data?.data ?? [];

    const go = (href: string) => {
        setOpen(false);
        setQuery('');
        router.push(href);
    };

    return (
        <>
            <button
                type='button'
                onClick={() => setOpen(true)}
                aria-label='Search (Command+K)'
                className='inline-flex h-8 items-center gap-2 rounded-md border border-input bg-surface px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:w-64 lg:w-96'>
                <HugeiconsIcon icon={Search01Icon} className='size-3.5 shrink-0' />
                <span className='hidden md:inline'>Search…</span>
                <kbd className='ml-auto hidden rounded border border-line bg-surface-inset px-1 text-2xs font-medium text-content-subtle md:inline'>
                    ⌘K
                </kbd>
            </button>

            <CommandDialog
                open={open}
                onOpenChange={(o) => {
                    setOpen(o);
                    if (!o) setQuery('');
                }}
                title='Search the dashboard'
                description={
                    isCustomer
                        ? 'Jump to a page or one of your bookings'
                        : 'Jump to a page, tour, booking or destination'
                }
                className='w-[92vw] max-w-2xl sm:max-w-2xl'>
                <Command>
                    <CommandInput
                        placeholder={
                            isCustomer
                                ? 'Search your bookings…'
                                : 'Search pages, tours, bookings…'
                        }
                        value={query}
                        onValueChange={setQuery}
                        className='h-12 text-base'
                    />
                    <CommandList>
                        <CommandEmpty>No results.</CommandEmpty>

                        {navGroups.map((group) => (
                            <CommandGroup
                                key={group.label ?? 'nav'}
                                heading={group.label}>
                                {group.items.map((item) => (
                                    <CommandItem
                                        key={item.title}
                                        value={`${group.label} ${item.title}`}
                                        onSelect={() => go(toHref(item.url))}>
                                        {item.icon && (
                                            <HugeiconsIcon
                                                icon={item.icon}
                                                className='size-4'
                                            />
                                        )}
                                        {item.title}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}

                        {(can(Permission.CREATE_TRIP) ||
                            can(Permission.MANAGE_OPERATORS)) && (
                            <>
                                <CommandSeparator />
                                <CommandGroup heading='Actions'>
                                    {can(Permission.CREATE_TRIP) && (
                                        <CommandItem
                                            value='actions new tour create trip'
                                            onSelect={() => go('/trips/new')}>
                                            <HugeiconsIcon icon={PlusSignIcon} className='size-4' />
                                            New tour
                                            <CommandShortcut>
                                                <HugeiconsIcon icon={ArrowTurnBackwardIcon} className='size-3' />
                                            </CommandShortcut>
                                        </CommandItem>
                                    )}
                                    {can(Permission.MANAGE_OPERATORS) && (
                                        <CommandItem
                                            value='actions new tour operator'
                                            onSelect={() =>
                                                go('/tour-operators/new')
                                            }>
                                            <HugeiconsIcon icon={PlusSignIcon} className='size-4' />
                                            New tour operator
                                        </CommandItem>
                                    )}
                                </CommandGroup>
                            </>
                        )}

                        {tours.length > 0 && (
                            <>
                                <CommandSeparator />
                                <CommandGroup heading='Tours'>
                                    {tours.map((t) => (
                                        <CommandItem
                                            key={t.id}
                                            value={`tour ${t.name} ${debouncedQuery}`}
                                            onSelect={() =>
                                                go(`/trips/${t.id}/edit`)
                                            }>
                                            <HugeiconsIcon icon={MapsIcon} className='size-4' />
                                            <span className='truncate'>
                                                {t.name}
                                            </span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </>
                        )}

                        {bookingRows.length > 0 && (
                            <>
                                <CommandSeparator />
                                <CommandGroup heading='Bookings'>
                                    {bookingRows.map((b) => (
                                        <CommandItem
                                            key={b.id}
                                            value={`booking ${b.displayRef} ${b.contactFullName ?? ''} ${debouncedQuery}`}
                                            onSelect={() => go('/bookings')}>
                                            <HugeiconsIcon icon={Calendar03Icon} className='size-4' />
                                            <span className='font-mono text-xs'>
                                                {b.displayRef}
                                            </span>
                                            <span className='truncate text-muted-foreground'>
                                                {b.contactFullName ?? b.tourName}
                                            </span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </>
                        )}

                        {destinationRows.length > 0 && query.length >= 2 && (
                            <>
                                <CommandSeparator />
                                <CommandGroup heading='Destinations'>
                                    {destinationRows.map((d) => (
                                        <CommandItem
                                            key={d.id}
                                            value={`destination ${d.name}`}
                                            onSelect={() =>
                                                go(`/destinations/${d.id}`)
                                            }>
                                            <HugeiconsIcon icon={Globe02Icon} className='size-4' />
                                            {d.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </CommandDialog>
        </>
    );
}
