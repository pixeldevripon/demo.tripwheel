'use client';

import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useMarkInboxRead } from '@/hooks/inbox/use-inbox';
import { inboxApi } from '@/lib/api/inbox';
import type { InboxNotification } from '@/types/inbox';
import { relativeTime } from '@/components/common/inbox-copy';

/**
 * Only ask the server once per browser session, even across tabs and across
 * every client-side navigation in between.
 *
 * The server marker (`user.inboxDigestShownAt`) is the real authority - it is
 * what makes "since you were last here" mean anything. This key is the second
 * half: without it, opening a second tab would call the endpoint again, and
 * anything that arrived in the intervening seconds would pop a modal in a tab
 * the user did not just log into.
 */
const SESSION_KEY = 'inbox-digest-shown';

/**
 * "What happened while you were away", once per session.
 *
 * The hard part is the trigger. "On login" has no client-side event: the
 * dashboard layout mounts on every navigation, so a naive effect fires this on
 * every page change all day. Two guards together give the intended behaviour:
 *
 * 1. `sessionStorage` - once per browser session, shared by every tab.
 * 2. the server's `inboxDigestShownAt` - only notifications that arrived SINCE
 *    the last digest, so a second session tomorrow is not shown today's again.
 *
 * It renders nothing when there is nothing new. An empty "you have no
 * notifications" modal is an interruption that charges the user attention and
 * gives back nothing.
 */
export function InboxDigestDialog() {
    const [items, setItems] = useState<InboxNotification[]>([]);
    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const { mutate: markRead } = useMarkInboxRead();

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (sessionStorage.getItem(SESSION_KEY)) return;
        // Claim the session BEFORE the request resolves: two tabs opened
        // together would otherwise both pass the check and both call the
        // endpoint, and the second would get an empty result while the first
        // shows the modal - or worse, both show it.
        sessionStorage.setItem(SESSION_KEY, '1');

        let cancelled = false;
        void inboxApi
            .digest()
            .then(result => {
                if (cancelled || result.data.length === 0) return;
                setItems(result.data);
                setUnread(result.unread);
                setOpen(true);
            })
            .catch(() => {
                // A failed digest is not worth a toast: the bell still carries
                // everything this modal would have said.
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (items.length === 0) return null;

    const hidden = Math.max(0, unread - items.length);

    return (
        // Dismissible three ways - X, Esc and the backdrop - all of which the
        // house Dialog already provides. This must never be a wall.
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className='sm:max-w-lg'>
                <DialogHeader>
                    <DialogTitle>While you were away</DialogTitle>
                    <DialogDescription>
                        {unread === 1
                            ? '1 unread notification.'
                            : `${unread} unread notifications.`}
                    </DialogDescription>
                </DialogHeader>

                <ul className='divide-y divide-border/50'>
                    {items.map(item => (
                        <li key={item.id}>
                            <Link
                                href={item.url}
                                onClick={() => {
                                    markRead({ ids: [item.id] });
                                    setOpen(false);
                                }}
                                className='flex items-start gap-3 py-2.5 transition-colors hover:bg-muted/40'>
                                <span className='min-w-0 flex-1'>
                                    <span className='block text-sm font-medium'>
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
                                <HugeiconsIcon
                                    icon={ArrowRight01Icon}
                                    className='mt-1 size-4 shrink-0 text-muted-foreground'
                                />
                            </Link>
                        </li>
                    ))}
                </ul>

                {hidden > 0 && (
                    <p className='text-xs text-muted-foreground'>
                        and {hidden} more in the bell.
                    </p>
                )}

                <DialogFooter>
                    {/* "Dismiss", not "Mark all read": closing this must not
                        silently clear notifications the user has not looked
                        at. Clearing is a separate, deliberate click. */}
                    <Button variant='outline' onClick={() => setOpen(false)}>
                        Dismiss
                    </Button>
                    <Button
                        onClick={() => {
                            markRead({ all: true });
                            setOpen(false);
                        }}>
                        Mark all read
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
