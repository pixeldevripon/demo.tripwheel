'use client';

import {
    Cancel01Icon,
    Delete02Icon,
    Notification01Icon,
    Tick02Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useClearInbox,
    useInboxList,
    useInboxSummary,
    useMarkInboxRead,
    useRemoveInboxNotification,
} from '@/hooks/inbox/use-inbox';
import { springPop, swapFade } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { InboxNotification } from '@/types/inbox';
import { relativeTime } from '@/components/common/inbox-copy';

/**
 * The header bell.
 *
 * Two queries, deliberately split: the COUNT is polled in the background, the
 * LIST is not fetched until the popover opens. A dashboard left open on a
 * second monitor all day therefore costs one indexed aggregate a minute, not a
 * page of rows.
 */
export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const reduceMotion = useReducedMotion();

    const { data: summary } = useInboxSummary();
    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
        useInboxList({ limit: 12 }, open);
    const { mutate: markRead } = useMarkInboxRead();
    const { mutate: clearInbox } = useClearInbox();
    const { mutate: removeOne } = useRemoveInboxNotification();

    const unread = summary?.unread ?? 0;
    const items = data?.pages.flatMap(p => p.data) ?? [];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type='button'
                    aria-label={
                        unread > 0
                            ? `Notifications, ${unread} unread`
                            : 'Notifications'
                    }
                    className='relative flex cursor-pointer items-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
                    <HugeiconsIcon
                        className='size-5'
                        icon={Notification01Icon}
                    />
                    {/* The count sits ON the bell rather than beside it: the
                        header is a dense row and a chip next to the icon reads
                        as a separate control. */}
                    <AnimatePresence initial={false}>
                        {unread > 0 && (
                            <motion.span
                                key='count'
                                initial={
                                    reduceMotion ? false : { scale: 0.6, opacity: 0 }
                                }
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.6, opacity: 0 }}
                                transition={
                                    reduceMotion ? { duration: 0 } : springPop
                                }
                                className='absolute -top-0.5 -right-1 min-w-4 rounded-full bg-primary px-1 text-2xs leading-4 font-medium tabular-nums text-primary-foreground'>
                                {unread > 99 ? '99+' : unread}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>
            </PopoverTrigger>

            <PopoverContent
                align='end'
                sideOffset={8}
                className='w-90 p-0'
                // The list scrolls inside the panel; the page never does.
            >
                <div className='flex items-center justify-between border-b border-border/50 px-3 py-2.5'>
                    <p className='text-sm font-medium'>Notifications</p>
                    {unread > 0 && (
                        <Button
                            variant='ghost'
                            size='sm'
                            className='h-auto py-0.5 text-xs text-muted-foreground'
                            onClick={() => markRead({ all: true })}>
                            <HugeiconsIcon
                                icon={Tick02Icon}
                                className='size-3.5'
                            />
                            Mark all read
                        </Button>
                    )}
                </div>

                <div className='max-h-96 overflow-y-auto'>
                    {isLoading ? (
                        <div className='space-y-2 p-3'>
                            {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className='h-12 w-full' />
                            ))}
                        </div>
                    ) : items.length === 0 ? (
                        // Not an illustration and not an apology - one line.
                        <p className='px-3 py-8 text-center text-xs text-muted-foreground'>
                            Nothing yet. Bookings, review verdicts and payouts
                            will show up here.
                        </p>
                    ) : (
                        <ul>
                            {items.map(item => (
                                <NotificationRow
                                    key={item.id}
                                    item={item}
                                    onOpen={() => {
                                        if (!item.readAt) {
                                            markRead({ ids: [item.id] });
                                        }
                                        setOpen(false);
                                    }}
                                    onDismiss={() => removeOne(item.id)}
                                />
                            ))}
                        </ul>
                    )}

                    {hasNextPage && (
                        <div className='p-2'>
                            <Button
                                variant='ghost'
                                size='sm'
                                className='w-full text-xs text-muted-foreground'
                                disabled={isFetchingNextPage}
                                onClick={() => void fetchNextPage()}>
                                {isFetchingNextPage ? 'Loading...' : 'Load more'}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Clearing is destructive, so it sits at the BOTTOM, apart
                    from the row you were reaching for, and is worded as what
                    it does. "Clear read" is the safe sweep and the default
                    offer; clearing unread ones too has to be asked for by
                    name. */}
                {items.length > 0 && (
                    <div className='flex items-center justify-between gap-2 border-t border-border/50 px-3 py-2'>
                        <Button
                            variant='ghost'
                            size='sm'
                            className='h-auto py-0.5 text-xs text-muted-foreground'
                            onClick={() => clearInbox({ all: true, onlyRead: true })}>
                            <HugeiconsIcon icon={Delete02Icon} className='size-3.5' />
                            Clear read
                        </Button>
                        <Button
                            variant='ghost'
                            size='sm'
                            className='h-auto py-0.5 text-xs text-muted-foreground'
                            onClick={() => clearInbox({ all: true })}>
                            Clear all
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

/**
 * One row. The whole row is the link - a small "view" affordance repeated down
 * a column is more chrome than target.
 */
function NotificationRow({
    item,
    onOpen,
    onDismiss,
}: {
    item: InboxNotification;
    onOpen: () => void;
    onDismiss: () => void;
}) {
    const reduceMotion = useReducedMotion();
    return (
        <motion.li
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduceMotion ? { duration: 0 } : swapFade}
            className='group relative border-b border-border/40 last:border-b-0'>
            {/* Dismiss sits OUTSIDE the link, not inside it: a button nested in
                an anchor is invalid, and clicking it must not also navigate.
                Visible on hover and on keyboard focus - never hover-only, or
                it does not exist for a keyboard. */}
            <button
                type='button'
                aria-label='Dismiss notification'
                onClick={onDismiss}
                className='absolute top-2 right-2 z-10 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none hover:text-foreground'>
                <HugeiconsIcon icon={Cancel01Icon} className='size-3' />
            </button>
            <Link
                href={item.url}
                onClick={onOpen}
                className={cn(
                    'flex gap-2.5 py-2.5 pr-8 pl-3 transition-colors hover:bg-muted/50',
                    !item.readAt && 'bg-primary-subtle/30',
                )}>
                {/* Unread is a dot, not a colour on the text: the title has to
                    stay equally readable in both states. */}
                <span
                    aria-hidden
                    className={cn(
                        'mt-1.5 size-1.5 shrink-0 rounded-full',
                        item.readAt ? 'bg-transparent' : 'bg-primary',
                    )}
                />
                <span className='min-w-0 flex-1'>
                    <span className='block text-xs font-medium text-foreground'>
                        {item.title}
                    </span>
                    {item.body && (
                        <span className='mt-0.5 line-clamp-2 block text-xs text-muted-foreground'>
                            {item.body}
                        </span>
                    )}
                    <span className='mt-1 block text-2xs text-muted-foreground'>
                        {relativeTime(item.createdAt)}
                    </span>
                </span>
            </Link>
        </motion.li>
    );
}
