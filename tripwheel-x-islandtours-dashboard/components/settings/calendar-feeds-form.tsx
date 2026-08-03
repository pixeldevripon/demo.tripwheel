'use client';

import {
    Copy01Icon,
    Loading03Icon,
    Refresh01Icon,
    Tick02Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRole } from '@/contexts/role-context';
import {
    useCalendarFeeds,
    useCreateCalendarFeed,
    useRevokeCalendarFeed,
    useRotateCalendarFeed,
} from '@/hooks/calendar-feeds/use-calendar-feeds';
import { CalendarFeedKind, type CalendarFeed } from '@/types/calendar-feed';
import { CalendarFeedInstructions } from './calendar-feed-instructions';

/**
 * Prose only. The dashboard shell runs to ~1800px on a wide monitor, and an
 * unconstrained paragraph there is a single 200-character line nobody reads.
 */
const MEASURE = 'max-w-3xl';

/**
 * The token IS the credential, so the full URL never renders (founder,
 * 2026-08-02) - just enough of the token survives to tell two links apart.
 * Copy is the only way to get the real thing.
 */
const maskFeedUrl = (url: string) => {
    const token = /calendar-feeds\/([^/]+)/.exec(url)?.[1] ?? '';
    return `…/${token.slice(0, 4)}····${token.slice(-4)}/calendar.ics`;
};

/**
 * Hosts that only exist on the machine reading them.
 *
 * This matters because of HOW a calendar subscription works: Google, Apple's
 * iCloud sync and Outlook fetch the URL from THEIR OWN servers, not from your
 * browser. A `localhost` URL handed to Google therefore resolves to a Google
 * machine, the request never reaches this API, and the calendar is added
 * successfully and then stays empty forever with no error anywhere - the single
 * most confusing possible failure. Warn before that happens rather than after.
 */
const PRIVATE_HOST =
    /^(localhost$|127\.|0\.0\.0\.0$|\[?::1\]?$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|.*\.local$)/i;

function isPubliclyUnreachable(url: string): boolean {
    try {
        return PRIVATE_HOST.test(new URL(url).hostname);
    } catch {
        return false;
    }
}

interface FeedKindMeta {
    kind: CalendarFeedKind;
    title: string;
    description: string;
    /** Permission the backend enforces for this kind; the row is hidden without it. */
    permission: 'VIEW_BOOKINGS' | 'MANAGE_AVAILABILITY';
    /** Rendered under the URL when the feed carries customer data. */
    sensitive?: string;
}

const FEED_KINDS: FeedKindMeta[] = [
    {
        kind: CalendarFeedKind.BOOKINGS,
        title: 'Bookings',
        description: 'Confirmed bookings with party size and reference.',
        permission: 'VIEW_BOOKINGS',
        sensitive: 'Shows traveller names - share with your team only.',
    },
    {
        kind: CalendarFeedKind.DEPARTURES,
        title: 'Departures',
        description: 'Departures for the next 90 days - no traveller details.',
        permission: 'MANAGE_AVAILABILITY',
    },
];

/**
 * iCal sync - the operator's read-only iCal export.
 *
 * Subscribing is one-way ON PURPOSE and the copy says so: adding the link to Google
 * or Apple Calendar shows what is booked, it does not let the calendar block dates
 * back here. Availability is only ever changed from the tour's own calendar.
 */
export function CalendarFeedsForm() {
    const { can } = useRole();
    const {
        data: feeds,
        isLoading,
        isError,
        error,
        isFetching,
        refetch,
    } = useCalendarFeeds();
    const create = useCreateCalendarFeed();
    const rotate = useRotateCalendarFeed();
    const revoke = useRevokeCalendarFeed();

    const [confirming, setConfirming] = useState<{
        feed: CalendarFeed;
        action: 'rotate' | 'revoke';
    } | null>(null);

    const visibleKinds = FEED_KINDS.filter(k => can(k.permission));
    if (visibleKinds.length === 0) return null;

    const byKind = new Map(feeds?.map(f => [f.kind, f]));
    const pending = rotate.isPending || revoke.isPending;

    const runConfirmed = () => {
        if (!confirming) return;
        const { feed, action } = confirming;
        const mutation = action === 'rotate' ? rotate : revoke;
        mutation.mutate(feed.id, { onSettled: () => setConfirming(null) });
    };

    return (
        <>
            <Card>
                <CardHeader className='border-b'>
                    <CardTitle>iCal sync</CardTitle>
                    {/* No "updates every hour" promise. We send an hourly REFRESH-INTERVAL
              hint, but the calendar app decides whether to honour it - Outlook can
              take over a day - and a promise we cannot keep becomes a support ticket. */}
                    <p
                        className={`mt-1 ${MEASURE} text-sm font-light normal-case tracking-normal text-muted-foreground`}>
                        Read-only links for Google, Apple or Outlook Calendar.
                    </p>
                </CardHeader>
                <CardContent className='divide-y pt-0'>
                    {/* Fragments, NOT a wrapper div. CardContent's `divide-y`
                        draws its rules with `& > * ~ *`, so anything that groups
                        these rows swallows the selector and the hairlines between
                        them vanish - `display: contents` does not help, it hides
                        the box but the element still matches. */}
                    {isLoading && (
                        <>
                            {visibleKinds.map(k => (
                                <div key={k.kind} className='space-y-2 py-4'>
                                    <Skeleton className='h-4 w-24' />
                                    <Skeleton className='h-9 w-full' />
                                </div>
                            ))}
                        </>
                    )}

                    {/* Never fall through to the rows on a failed read with nothing
                        cached: an empty list and a broken list render identically
                        there, so the operator gets a Create button that already
                        did its job. */}
                    {!isLoading && isError && !feeds && (
                        <FeedsUnavailable
                            message={error?.message}
                            onRetry={() => void refetch()}
                            retrying={isFetching}
                        />
                    )}

                    {!isLoading && (!isError || feeds) && (
                        <>
                            {isError && (
                                <p className='py-3 text-xs text-warning-fg'>
                                    Showing the last links we loaded - checking
                                    for changes just failed. They keep working
                                    either way.
                                </p>
                            )}
                            {visibleKinds.map(meta => (
                                <FeedRow
                                    key={meta.kind}
                                    meta={meta}
                                    feed={byKind.get(meta.kind)}
                                    creating={
                                        create.isPending &&
                                        create.variables?.kind === meta.kind
                                    }
                                    onCreate={() =>
                                        create.mutate({ kind: meta.kind })
                                    }
                                    onRotate={feed =>
                                        setConfirming({
                                            feed,
                                            action: 'rotate',
                                        })
                                    }
                                    onRevoke={feed =>
                                        setConfirming({
                                            feed,
                                            action: 'revoke',
                                        })
                                    }
                                />
                            ))}
                        </>
                    )}

                    <CalendarFeedInstructions />
                </CardContent>
            </Card>

            <ConfirmDialog
                open={confirming !== null}
                onOpenChange={open => !open && setConfirming(null)}
                destructive
                loading={pending}
                title={
                    confirming?.action === 'rotate'
                        ? 'Generate a new link?'
                        : 'Turn this calendar off?'
                }
                description={
                    confirming?.action === 'rotate'
                        ? 'The current link stops working immediately. Every device already subscribed to it will need the new link added.'
                        : 'The link stops working immediately and every device subscribed to it stops updating. You can create a new one later, but it will be a different link.'
                }
                confirmLabel={
                    confirming?.action === 'rotate'
                        ? 'Generate new link'
                        : 'Turn off'
                }
                onConfirm={runConfirmed}
            />
        </>
    );
}

/**
 * A failed READ, said out loud.
 *
 * The rows are driven entirely by the list query, where "no feeds" and "could not
 * load feeds" used to be the same render: both fell through to the Create button.
 * So a broken GET looked like a working screen, and pressing Create minted the
 * feed, toasted success, and returned to the identical button - the write had
 * worked, the read had not, and nothing anywhere said so. Whatever is wrong, the
 * one thing this must not do is imply the operator has no link.
 */
function FeedsUnavailable({
    message,
    onRetry,
    retrying,
}: {
    message?: string;
    onRetry: () => void;
    retrying: boolean;
}) {
    return (
        <div className='space-y-3 py-4'>
            <div className='space-y-1'>
                <h3 className='text-sm font-medium'>
                    Could not load your calendar links
                </h3>
                <p
                    className={`${MEASURE} text-sm font-light text-muted-foreground`}>
                    {message || 'The request did not get through.'}
                </p>
                <p className={`${MEASURE} text-xs text-muted-foreground`}>
                    Any link you have already added to a calendar keeps working -
                    this only failed to read them back.
                </p>
            </div>
            <Button
                variant='outline'
                size='sm'
                onClick={onRetry}
                disabled={retrying}>
                {retrying && (
                    <HugeiconsIcon
                        icon={Loading03Icon}
                        className='size-4 animate-spin'
                    />
                )}
                {retrying ? 'Retrying' : 'Try again'}
            </Button>
        </div>
    );
}

function FeedRow({
    meta,
    feed,
    creating,
    onCreate,
    onRotate,
    onRevoke,
}: {
    meta: FeedKindMeta;
    feed: CalendarFeed | undefined;
    creating: boolean;
    onCreate: () => void;
    onRotate: (feed: CalendarFeed) => void;
    onRevoke: (feed: CalendarFeed) => void;
}) {
    return (
        <div className='space-y-2 py-4'>
            {/* Title and sync state sit together rather than justified to the card's
          edges - at this width, right-aligning the status put it 1,500px from the
          heading it describes. */}
            <div className='flex flex-wrap items-baseline gap-2'>
                <h3 className='text-sm font-medium'>{meta.title}</h3>
                {feed && <LastSync feed={feed} />}
            </div>

            <p
                className={`${MEASURE} text-sm font-light text-muted-foreground`}>
                {meta.description}
            </p>

            {feed ? (
                <div className='space-y-1.5'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <code className='inline-flex h-8 min-w-0 items-center truncate rounded-md border bg-muted/50 px-3 font-mono text-xs text-muted-foreground md:min-w-90'>
                            {maskFeedUrl(feed.url)}
                        </code>
                        <CopyButton value={feed.url} />
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={() => onRotate(feed)}
                            title='Generate a new link and kill the current one'>
                            <HugeiconsIcon
                                icon={Refresh01Icon}
                                className='size-3.5'
                            />
                            New link
                        </Button>
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => onRevoke(feed)}>
                            Turn off
                        </Button>
                    </div>
                    {/* Google/Outlook fetch from their own servers, so a private
                        address subscribes fine and then stays empty forever -
                        warn before that happens, not after. */}
                    {isPubliclyUnreachable(feed.url) ? (
                        <p className='text-xs text-warning-fg'>
                            Private address - Google and Outlook cannot reach
                            it. Set
                            <code className='mx-1 font-mono'>
                                PUBLIC_API_URL
                            </code>
                            to a public https address first.
                        </p>
                    ) : (
                        meta.sensitive && (
                            <p className='text-xs text-muted-foreground'>
                                {meta.sensitive}
                            </p>
                        )
                    )}
                </div>
            ) : (
                <Button size='sm' onClick={onCreate} disabled={creating}>
                    {creating && (
                        <HugeiconsIcon
                            icon={Loading03Icon}
                            className='size-4 animate-spin'
                        />
                    )}
                    {creating ? 'Creating' : 'Create link'}
                </Button>
            )}
        </div>
    );
}

/**
 * "Is this actually working?" - the one question an operator has after pasting the
 * URL somewhere. Counts come from real 200s, so a feed that has never been polled
 * reads as waiting rather than claiming a sync that never happened.
 */
function LastSync({ feed }: { feed: CalendarFeed }) {
    return (
        <span className='text-xs text-muted-foreground'>
            {feed.lastFetchedAt
                ? `Last synced ${new Date(feed.lastFetchedAt).toLocaleString(
                      undefined,
                      { dateStyle: 'short', timeStyle: 'short' }
                  )}`
                : 'Waiting for the first sync'}
        </span>
    );
}

function CopyButton({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
        } catch {
            // Clipboard access is refused outside a secure context and in some
            // embedded browsers. The URL renders MASKED, so there is nothing on
            // screen to hand-select any more - fall back to the legacy
            // execCommand path with an off-screen textarea instead.
            const ta = document.createElement('textarea');
            ta.value = value;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            ta.remove();
            if (!ok) {
                toast.error('Could not copy the link');
                return;
            }
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        // Fixed width: "Copy" -> "Copied" must not resize the button and
        // shove the New link / Turn off buttons sideways mid-click.
        <Button
            type='button'
            variant='outline'
            size='sm'
            className='w-22'
            onClick={() => void copy()}>
            <HugeiconsIcon
                icon={copied ? Tick02Icon : Copy01Icon}
                className='size-3.5'
            />
            {copied ? 'Copied' : 'Copy'}
        </Button>
    );
}

