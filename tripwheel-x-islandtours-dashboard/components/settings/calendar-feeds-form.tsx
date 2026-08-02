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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useRole } from '@/contexts/role-context';
import {
    useCalendarFeeds,
    useCreateCalendarFeed,
    useRevokeCalendarFeed,
    useRotateCalendarFeed,
} from '@/hooks/calendar-feeds/use-calendar-feeds';
import { useResources } from '@/hooks/resources/use-resources';
import { CalendarFeedKind, type CalendarFeed } from '@/types/calendar-feed';
import { RESOURCE_KIND_LABEL } from '@/types/resource';
import { CalendarFeedInstructions } from './calendar-feed-instructions';

/**
 * Prose only. The dashboard shell runs to ~1800px on a wide monitor, and an
 * unconstrained paragraph there is a single 200-character line nobody reads.
 *
 * Deliberately NOT applied to the URL row: the token makes these links long, and
 * capping the input truncated the URL mid-string. The row runs full width so as
 * much of the link as possible is readable at a glance, with the buttons parked
 * at the right edge.
 */
const MEASURE = 'max-w-3xl';

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
        description:
            'Every confirmed booking on your tours, with party size and reference. Cancellations stay on the calendar marked cancelled.',
        permission: 'VIEW_BOOKINGS',
        // The dangerous mistake this feature invites: pasting this URL into
        // Airbnb would publish customer names to a third party. Say it where
        // the link is, not in documentation nobody opens.
        sensitive:
            'Shows traveller names to anyone who has the link. For your own calendar app only - never paste it into Airbnb, Booking.com or any sales channel. To block dates on a channel, use the channel link on the tour itself.',
    },
    {
        kind: CalendarFeedKind.DEPARTURES,
        title: 'Departures',
        description:
            'Every departure in the next 90 days with how full it is. No traveller details, so this one is safe to hand to a guide.',
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
    const { data: feeds, isLoading } = useCalendarFeeds();
    const create = useCreateCalendarFeed();
    const rotate = useRotateCalendarFeed();
    const revoke = useRevokeCalendarFeed();

    const [confirming, setConfirming] = useState<{
        feed: CalendarFeed;
        action: 'rotate' | 'revoke';
    } | null>(null);

    const canManageAvailability = can('MANAGE_AVAILABILITY');
    const visibleKinds = FEED_KINDS.filter(k => can(k.permission));
    if (visibleKinds.length === 0 && !canManageAvailability) return null;

    // Keyed by kind ONLY for the operator-wide kinds. A RESOURCE feed is per
    // asset, so an operator holds several at once and this map would collapse
    // them - they are matched on resourceId in ResourceFeeds instead.
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
                        Subscribe in Google, Apple or Outlook Calendar to see
                        your schedule alongside everything else. Read-only: it
                        never changes availability here.
                    </p>
                </CardHeader>
                <CardContent className='divide-y pt-0'>
                    {isLoading
                        ? visibleKinds.map(k => (
                              <div key={k.kind} className='space-y-2 py-4'>
                                  <Skeleton className='h-4 w-24' />
                                  <Skeleton className='h-9 w-full' />
                              </div>
                          ))
                        : visibleKinds.map(meta => (
                              <FeedRow
                                  key={meta.kind}
                                  title={meta.title}
                                  description={meta.description}
                                  sensitive={meta.sensitive}
                                  feed={byKind.get(meta.kind)}
                                  creating={
                                      create.isPending &&
                                      create.variables?.kind === meta.kind
                                  }
                                  onCreate={() =>
                                      create.mutate({ kind: meta.kind })
                                  }
                                  onRotate={feed =>
                                      setConfirming({ feed, action: 'rotate' })
                                  }
                                  onRevoke={feed =>
                                      setConfirming({ feed, action: 'revoke' })
                                  }
                              />
                          ))}

                    {canManageAvailability && (
                        <ResourceFeeds
                            feeds={feeds}
                            creatingId={
                                create.isPending
                                    ? (create.variables?.resourceId ?? null)
                                    : null
                            }
                            onCreate={resourceId =>
                                create.mutate({
                                    kind: CalendarFeedKind.RESOURCE,
                                    resourceId,
                                })
                            }
                            onRotate={feed =>
                                setConfirming({ feed, action: 'rotate' })
                            }
                            onRevoke={feed =>
                                setConfirming({ feed, action: 'revoke' })
                            }
                        />
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
 * One subscribe link per physical asset.
 *
 * Unlike every other kind, this one is NOT a singleton: an operator with three
 * boats wants three separate calendars, because the person subscribing to each
 * is usually a different person - often not an employee at all. That is also why
 * the feed carries only busy intervals and the asset's name: the skipper of a
 * chartered boat can see when it is committed without seeing who booked it or
 * what they paid.
 *
 * Inactive assets are excluded. A deactivated resource constrains nothing, and
 * the backend renders its feed empty for the same reason - offering a link that
 * is guaranteed to be blank would just generate support tickets.
 */
function ResourceFeeds({
    feeds,
    creatingId,
    onCreate,
    onRotate,
    onRevoke,
}: {
    feeds: CalendarFeed[] | undefined;
    creatingId: string | null;
    onCreate: (resourceId: string) => void;
    onRotate: (feed: CalendarFeed) => void;
    onRevoke: (feed: CalendarFeed) => void;
}) {
    const { data: resources, isLoading } = useResources();

    if (isLoading) {
        return (
            <div className='space-y-2 py-4'>
                <Skeleton className='h-4 w-32' />
                <Skeleton className='h-9 w-full' />
            </div>
        );
    }

    const active = resources?.data.filter(r => r.isActive) ?? [];

    const byResource = new Map(
        feeds
            ?.filter(f => f.kind === CalendarFeedKind.RESOURCE && f.resourceId)
            .map(f => [f.resourceId as string, f])
    );

    return (
        <div className='py-4'>
            <h3 className='text-sm font-medium'>Equipment and staff</h3>
            <p
                className={`mt-1 ${MEASURE} text-sm font-light text-muted-foreground`}>
                A separate calendar for each boat, vehicle or guide, showing only
                the hours it is committed. No traveller names, no tour names and
                no prices - safe to give to a skipper or a freelance guide.
            </p>

            {/* Without this the section vanishes entirely when an operator has no
          assets yet - and since equipment is only added from inside a tour, there
          would be nothing anywhere telling them the feature exists. */}
            {active.length === 0 && (
                <p className='mt-2 text-sm font-light text-muted-foreground'>
                    You have not added any shared equipment yet. Add a boat,
                    vehicle or guide under Shared equipment on any tour&apos;s
                    Schedule step, and its calendar will appear here.
                </p>
            )}

            <div className='mt-2 divide-y'>
                {active.map(resource => (
                    <FeedRow
                        key={resource.id}
                        title={`${resource.name} (${RESOURCE_KIND_LABEL[resource.kind]})`}
                        description={
                            resource.tours.length === 0
                                ? 'Not used by any tour yet, so this calendar stays empty until you add it to one.'
                                : `Busy hours from ${resource.tours.length} ${resource.tours.length === 1 ? 'tour' : 'tours'}. Back-to-back trips show as one block.`
                        }
                        feed={byResource.get(resource.id)}
                        creating={creatingId === resource.id}
                        onCreate={() => onCreate(resource.id)}
                        onRotate={onRotate}
                        onRevoke={onRevoke}
                    />
                ))}
            </div>
        </div>
    );
}

function FeedRow({
    title,
    description,
    sensitive,
    feed,
    creating,
    onCreate,
    onRotate,
    onRevoke,
}: {
    title: string;
    description: string;
    sensitive?: string;
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
                <h3 className='text-sm font-medium'>{title}</h3>
                {feed && <LastSync feed={feed} />}
            </div>

            <p
                className={`${MEASURE} text-sm font-light text-muted-foreground`}>
                {description}
            </p>

            {feed ? (
                <div className='space-y-1.5'>
                    <div className='flex flex-wrap items-center gap-2'>
                        {/* Read-only rather than disabled: the operator must still be able to
                select the text by hand if the clipboard API is unavailable. */}
                        <Input
                            readOnly
                            value={feed.url}
                            className='h-9 min-w-0 flex-1 font-mono text-xs'
                        />
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
                    {isPubliclyUnreachable(feed.url) ? (
                        <p className='text-xs text-warning-fg'>
                            This link points at a private address, so Google and
                            Outlook cannot reach it - they fetch from their own
                            servers, not from your browser. The calendar will
                            subscribe and then stay empty. Set
                            <code className='mx-1 font-mono'>
                                PUBLIC_API_URL
                            </code>
                            to a public https address to use it outside this
                            machine. Apple Calendar on this Mac can still read
                            it.
                        </p>
                    ) : (
                        sensitive && (
                            <p className='text-xs text-muted-foreground'>
                                {sensitive}
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
                ? `Last synced ${new Date(feed.lastFetchedAt).toLocaleString()}`
                : 'Waiting for the first sync'}
        </span>
    );
}

function CopyButton({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard access is refused outside a secure context and in some embedded
            // browsers; the input beside this button is selectable for exactly that case,
            // so say so rather than failing silently.
            toast.error(
                'Could not copy - select the link and copy it manually'
            );
        }
    };

    return (
        <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => void copy()}>
            <HugeiconsIcon
                icon={copied ? Tick02Icon : Copy01Icon}
                className='size-3.5'
            />
            {copied ? 'Copied' : 'Copy'}
        </Button>
    );
}

