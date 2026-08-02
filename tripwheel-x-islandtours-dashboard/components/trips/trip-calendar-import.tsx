'use client';

import { Loading03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';

import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useRole } from '@/contexts/role-context';
import {
    useCalendarSubscriptions,
    useCalendarSyncLogs,
    useCreateCalendarSubscription,
    useDisconnectCalendar,
    useSyncCalendarNow,
    useUpdateCalendarSubscription,
    useValidateCalendarFeed,
} from '@/hooks/calendar-sync/use-calendar-subscriptions';
import {
    useCalendarFeeds,
    useCreateCalendarFeed,
} from '@/hooks/calendar-feeds/use-calendar-feeds';
import { CalendarFeedKind } from '@/types/calendar-feed';
import {
    CalendarImportMode,
    CalendarPlatform,
    PLATFORM_LABELS,
    type CalendarSubscription,
    type SyncLogEntry,
    type ValidateFeedResult,
} from '@/types/calendar-subscription';

/**
 * Import an external calendar so a channel's bookings close dates here.
 *
 * ## The one thing this UI has to teach
 * iCal carries **no seat count**. An external "Busy" event says the listing is
 * unavailable - it cannot say "one of sixty seats sold". So the mode selector is
 * not a preference, it is the operator telling us which kind of tour this is,
 * and `WARN_ONLY` leads because every multi-capacity tour would be wrongly shut
 * by the blunt alternative.
 *
 * ## What it deliberately does not do
 * Promise a sync interval. We poll on our schedule and the channel publishes on
 * theirs; the gap is real and unfixable, so the copy says so once rather than
 * letting the operator discover it through a double booking.
 */

const MODE_OPTIONS: {
    value: CalendarImportMode;
    label: string;
    hint: string;
}[] = [
    {
        value: CalendarImportMode.WARN_ONLY,
        label: 'Warn me only',
        hint: 'Nothing is closed. You get an alert when a busy date overlaps seats you have sold. Right for tours that take more than one booking per departure.',
    },
    {
        value: CalendarImportMode.CLOSE_DATES,
        label: 'Close the whole day',
        hint: 'A busy date stops all sales that day. Right for whole-boat charters and anything you can only run once.',
    },
    {
        value: CalendarImportMode.CLOSE_SLOTS,
        label: 'Close overlapping departures',
        hint: 'Only departures that actually clash are closed. Needs the channel to publish times, which most do not.',
    },
    {
        value: CalendarImportMode.IGNORE,
        label: 'Ignore for now',
        hint: 'Keeps syncing and records what it would have closed, without touching availability. Useful to preview a channel before trusting it.',
    },
];

const STATUS_TEXT: Record<string, { label: string; tone: string }> = {
    PENDING: { label: 'Connecting', tone: 'text-muted-foreground' },
    SYNCING: { label: 'Syncing', tone: 'text-muted-foreground' },
    ACTIVE: { label: 'Active', tone: 'text-success-fg' },
    ERROR: { label: 'Not syncing', tone: 'text-danger-fg' },
    INVALID_URL: { label: 'Link broken', tone: 'text-danger-fg' },
    PAUSED: { label: 'Paused', tone: 'text-muted-foreground' },
    DISCONNECTED: { label: 'Disconnected', tone: 'text-muted-foreground' },
};

interface TripCalendarImportProps {
    tripId: string;
}

export function TripCalendarImport({ tripId }: TripCalendarImportProps) {
    const { can } = useRole();
    const { data: subscriptions, isLoading } = useCalendarSubscriptions(tripId);
    const [adding, setAdding] = useState(false);

    if (!can('MANAGE_AVAILABILITY')) return null;

    // Both directions live together on purpose. Sync only works when BOTH are
    // set up - most operators will not intuit that pushing our dates out and
    // pulling theirs in are two separate links - and splitting them across
    // screens is how you end up with half a connection and a double booking.

    if (isLoading) {
        return (
            <div className='space-y-3'>
                <Skeleton className='h-4 w-40' />
                <Skeleton className='h-9 w-full' />
            </div>
        );
    }

    const live = subscriptions ?? [];

    return (
        <div className='space-y-8'>
            <ChannelFeedBlock tripId={tripId} />

            {/* Stated once, up front. Every support ticket on iCal features is
                an operator who expected instant, seat-accurate sync. */}
            <p className='max-w-2xl text-sm font-light text-muted-foreground'>
                Paste the calendar link from a channel you also sell on and we
                will read its booked dates. A calendar link only says{' '}
                <strong className='font-medium'>busy or free</strong> - it never
                says how many seats went, and it updates on that channel&apos;s
                schedule, not instantly.
            </p>

            {live.length > 0 && (
                <ul className='divide-y'>
                    {live.map((subscription) => (
                        <SubscriptionRow
                            key={subscription.id}
                            tripId={tripId}
                            subscription={subscription}
                        />
                    ))}
                </ul>
            )}

            {adding ? (
                <AddCalendarForm
                    tripId={tripId}
                    onDone={() => setAdding(false)}
                />
            ) : (
                <Button
                    size='sm'
                    variant='outline'
                    onClick={() => setAdding(true)}>
                    Connect a calendar
                </Button>
            )}
        </div>
    );
}

/**
 * The outbound half: the link an operator gives to Airbnb.
 *
 * A separate feed kind from the two in Settings, and the distinction is a
 * privacy boundary rather than a preference. The Settings feeds are the
 * operator's own calendar and carry traveller names; this one is scoped to this
 * tour, contains dates and nothing else, and is the only one that may leave the
 * business. It publishes a date only when the tour genuinely cannot take
 * another booking, so one seat sold on a 60-seat boat does not close it.
 */
function ChannelFeedBlock({ tripId }: { tripId: string }) {
    const { data: feeds, isLoading } = useCalendarFeeds();
    const create = useCreateCalendarFeed();

    const feed = feeds?.find(
        (f) => f.kind === CalendarFeedKind.CHANNEL && f.tourId === tripId,
    );

    return (
        <div className='space-y-2'>
            <h4 className='text-sm font-medium'>Share this tour with a channel</h4>
            <p className='max-w-2xl text-sm font-light text-muted-foreground'>
                Give this link to Airbnb, Booking.com or any channel and they
                will stop selling the dates this tour is full or closed. It
                contains dates only - no traveller names, no numbers.
            </p>

            {isLoading ? (
                <Skeleton className='h-9 w-full max-w-2xl' />
            ) : feed ? (
                <div className='flex max-w-2xl flex-wrap items-center gap-2'>
                    <Input
                        readOnly
                        value={feed.url}
                        className='h-9 min-w-0 flex-1 font-mono text-xs'
                    />
                    <CopyLinkButton value={feed.url} />
                </div>
            ) : (
                <Button
                    size='sm'
                    variant='outline'
                    disabled={create.isPending}
                    onClick={() =>
                        create.mutate({
                            kind: CalendarFeedKind.CHANNEL,
                            tourId: tripId,
                        })
                    }>
                    {create.isPending && (
                        <HugeiconsIcon
                            icon={Loading03Icon}
                            className='size-4 animate-spin'
                        />
                    )}
                    Create the channel link
                </Button>
            )}
        </div>
    );
}

function CopyLinkButton({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <Button
            size='sm'
            variant='outline'
            onClick={() => {
                void navigator.clipboard
                    .writeText(value)
                    .then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    })
                    .catch(() =>
                        toast.error(
                            'Could not copy - select the link and copy it manually',
                        ),
                    );
            }}>
            {copied ? 'Copied' : 'Copy'}
        </Button>
    );
}

function SubscriptionRow({
    tripId,
    subscription,
}: {
    tripId: string;
    subscription: CalendarSubscription;
}) {
    const sync = useSyncCalendarNow(tripId);
    const update = useUpdateCalendarSubscription(tripId);
    const disconnect = useDisconnectCalendar(tripId);
    const [confirming, setConfirming] = useState(false);
    const [releaseDates, setReleaseDates] = useState(false);

    const status = STATUS_TEXT[subscription.status] ?? STATUS_TEXT.PENDING;
    const name =
        subscription.platform === CalendarPlatform.OTHER
            ? (subscription.platformLabel ?? 'External calendar')
            : PLATFORM_LABELS[subscription.platform];

    return (
        <li className='space-y-2 py-4'>
            <div className='flex flex-wrap items-baseline gap-x-2 gap-y-1'>
                <span className='text-sm font-medium'>{name}</span>
                <span className={`text-xs ${status.tone}`}>{status.label}</span>
                <span className='text-xs text-muted-foreground'>
                    {subscription.lastSuccessAt
                        ? `· synced ${formatDistanceToNow(new Date(subscription.lastSuccessAt), { addSuffix: true })}`
                        : '· not synced yet'}
                </span>
            </div>

            {/* The error IS the instruction - it already says what to do. */}
            {subscription.lastErrorMessage &&
                subscription.status !== 'ACTIVE' && (
                    <p className='max-w-2xl text-xs text-danger-fg'>
                        {subscription.lastErrorMessage}{' '}
                        <span className='text-muted-foreground'>
                            The {subscription.blockedCount} date
                            {subscription.blockedCount === 1 ? '' : 's'} it had
                            blocked are still blocked.
                        </span>
                    </p>
                )}

            {subscription.openConflictCount > 0 && (
                <p className='max-w-2xl text-xs text-warning-fg'>
                    Overlaps {subscription.openConflictCount} departure
                    {subscription.openConflictCount === 1 ? '' : 's'} you have
                    already sold. No traveller has been cancelled - check
                    whether the same seats went twice.
                </p>
            )}

            <p className='font-mono text-xs break-all text-muted-foreground'>
                {subscription.url}
            </p>

            <div className='flex flex-wrap items-center gap-2'>
                <Select
                    value={subscription.importMode}
                    onValueChange={(value) =>
                        update.mutate({
                            id: subscription.id,
                            payload: {
                                importMode: value as CalendarImportMode,
                            },
                        })
                    }>
                    <SelectTrigger size='sm' className='w-60'>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {MODE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button
                    size='sm'
                    variant='outline'
                    disabled={sync.isPending}
                    onClick={() => sync.mutate(subscription.id)}>
                    {sync.isPending && (
                        <HugeiconsIcon
                            icon={Loading03Icon}
                            className='size-4 animate-spin'
                        />
                    )}
                    {sync.isPending ? 'Syncing' : 'Sync now'}
                </Button>

                <Button
                    size='sm'
                    variant='ghost'
                    onClick={() => setConfirming(true)}>
                    Disconnect
                </Button>
            </div>

            <p className='max-w-2xl text-xs text-muted-foreground'>
                {
                    MODE_OPTIONS.find(
                        (option) => option.value === subscription.importMode,
                    )?.hint
                }
            </p>

            <SyncHistory subscriptionId={subscription.id} />

            <ConfirmDialog
                open={confirming}
                onOpenChange={(open) => {
                    if (!open) {
                        setConfirming(false);
                        setReleaseDates(false);
                    }
                }}
                destructive
                loading={disconnect.isPending}
                title={`Disconnect ${name}?`}
                confirmLabel='Disconnect'
                description={
                    <span className='space-y-3 block'>
                        <span className='block'>
                            This does not cancel any bookings. It only stops
                            future updates from {name}.
                        </span>
                        {/* Keeping is the default and the safe one: a channel
                            that stopped syncing is not a channel whose dates
                            became free. */}
                        <label className='flex items-start gap-2 text-sm'>
                            <input
                                type='checkbox'
                                className='mt-1'
                                aria-label={`Make the ${subscription.blockedCount} dates blocked by ${name} available again`}
                                checked={releaseDates}
                                onChange={(event) =>
                                    setReleaseDates(event.target.checked)
                                }
                            />
                            <span>
                                Also make the {subscription.blockedCount} date
                                {subscription.blockedCount === 1 ? '' : 's'} it
                                blocked available again.
                                <span className='block text-xs text-muted-foreground'>
                                    Leave this off to keep them closed as your
                                    own closures.
                                </span>
                            </span>
                        </label>
                    </span>
                }
                onConfirm={() =>
                    disconnect.mutate(
                        { id: subscription.id, releaseDates },
                        { onSettled: () => setConfirming(false) },
                    )
                }
            />
        </li>
    );
}

function AddCalendarForm({
    tripId,
    onDone,
}: {
    tripId: string;
    onDone: () => void;
}) {
    const [platform, setPlatform] = useState<CalendarPlatform>(
        CalendarPlatform.AIRBNB,
    );
    const [platformLabel, setPlatformLabel] = useState('');
    const [url, setUrl] = useState('');
    const [mode, setMode] = useState<CalendarImportMode>(
        CalendarImportMode.WARN_ONLY,
    );
    const [checked, setChecked] = useState<ValidateFeedResult | null>(null);

    const validate = useValidateCalendarFeed();
    const create = useCreateCalendarSubscription(tripId);

    const needsLabel = platform === CalendarPlatform.OTHER;
    const canSave =
        checked?.valid === true && url.trim().length > 0 &&
        (!needsLabel || platformLabel.trim().length > 0);

    const runCheck = () => {
        if (!url.trim()) return;
        setChecked(null);
        validate.mutate(
            { tourId: tripId, url: url.trim() },
            { onSuccess: setChecked },
        );
    };

    return (
        <div className='max-w-2xl space-y-4 border-t pt-4'>
            <div className='space-y-1.5'>
                <Label>Channel</Label>
                <Select
                    value={platform}
                    onValueChange={(value) => {
                        setPlatform(value as CalendarPlatform);
                        setChecked(null);
                    }}>
                    <SelectTrigger size='sm'>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {needsLabel && (
                <div className='space-y-1.5'>
                    <Label>Channel name</Label>
                    <Input
                        value={platformLabel}
                        onChange={(event) =>
                            setPlatformLabel(event.target.value)
                        }
                        placeholder='e.g. Local Tours Co'
                    />
                </div>
            )}

            <div className='space-y-1.5'>
                <Label>Calendar link</Label>
                <div className='flex flex-wrap gap-2'>
                    <Input
                        value={url}
                        onChange={(event) => {
                            setUrl(event.target.value);
                            setChecked(null);
                        }}
                        onBlur={runCheck}
                        placeholder='https://www.airbnb.com/calendar/ical/…'
                        className='min-w-0 flex-1 font-mono text-xs'
                    />
                    <Button
                        size='sm'
                        variant='outline'
                        onClick={runCheck}
                        disabled={validate.isPending || !url.trim()}>
                        {validate.isPending && (
                            <HugeiconsIcon
                                icon={Loading03Icon}
                                className='size-4 animate-spin'
                            />
                        )}
                        {validate.isPending ? 'Checking' : 'Check link'}
                    </Button>
                </div>

                {/* Checking BEFORE saving turns a feed that would have failed
                    silently every hour into a mistake caught while the operator
                    is still looking at the field. */}
                {checked && <ValidationLine result={checked} />}

                <p className='text-xs text-muted-foreground'>
                    Look for &quot;Export calendar&quot; or &quot;Sync
                    calendars&quot; on that channel - not the address of the
                    calendar page.
                </p>
            </div>

            <div className='space-y-1.5'>
                <Label>When that channel is busy</Label>
                <Select
                    value={mode}
                    onValueChange={(value) =>
                        setMode(value as CalendarImportMode)
                    }>
                    <SelectTrigger size='sm'>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {MODE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className='text-xs text-muted-foreground'>
                    {MODE_OPTIONS.find((option) => option.value === mode)?.hint}
                </p>
            </div>

            <div className='flex gap-2'>
                <Button
                    size='sm'
                    disabled={!canSave || create.isPending}
                    onClick={() =>
                        create.mutate(
                            {
                                tourId: tripId,
                                platform,
                                platformLabel: needsLabel
                                    ? platformLabel.trim()
                                    : undefined,
                                url: url.trim(),
                                importMode: mode,
                            },
                            { onSuccess: onDone },
                        )
                    }>
                    {create.isPending && (
                        <HugeiconsIcon
                            icon={Loading03Icon}
                            className='size-4 animate-spin'
                        />
                    )}
                    {create.isPending ? 'Connecting' : 'Connect'}
                </Button>
                <Button size='sm' variant='ghost' onClick={onDone}>
                    Cancel
                </Button>
            </div>
        </div>
    );
}

/**
 * Run history for one connection.
 *
 * Not a debug log - it is how an operator answers "why did my dates change" and
 * "why has nothing synced since Tuesday", and it is the audit trail when an
 * import closed a date that already had bookings. In `WARN_ONLY`, where nothing
 * is written to availability at all, this list is most of what the connection
 * produces.
 *
 * Collapsed by default and fetched only when opened: at a 15-minute cadence most
 * rows say "nothing changed", so it should never be the loudest thing on screen.
 */
function SyncHistory({ subscriptionId }: { subscriptionId: string }) {
    const [open, setOpen] = useState(false);
    const { data, isLoading } = useCalendarSyncLogs(subscriptionId, open);

    return (
        <div className='pt-1'>
            <button
                type='button'
                onClick={() => setOpen((value) => !value)}
                className='text-xs text-muted-foreground underline-offset-2 hover:underline'>
                {open ? 'Hide sync history' : 'Sync history'}
            </button>

            {open && (
                <div className='mt-2 space-y-1'>
                    {isLoading && (
                        <Skeleton className='h-4 w-48' />
                    )}
                    {!isLoading && (data?.data.length ?? 0) === 0 && (
                        <p className='text-xs text-muted-foreground'>
                            No runs recorded yet.
                        </p>
                    )}
                    {data?.data.map((entry) => (
                        <p
                            key={entry.id}
                            className='text-xs text-muted-foreground'>
                            <span className='text-foreground'>
                                {new Date(entry.startedAt).toLocaleString()}
                            </span>{' '}
                            · {describeRun(entry)}
                        </p>
                    ))}
                    {(data?.total ?? 0) > (data?.data.length ?? 0) && (
                        <p className='text-xs text-muted-foreground'>
                            Showing the {data?.data.length} most recent of{' '}
                            {data?.total}.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * One run in a sentence.
 *
 * Says what CHANGED, not that it ran. "Checked, nothing changed" is the honest
 * reading of the common case and reassures without implying dates moved.
 */
function describeRun(entry: SyncLogEntry): string {
    if (entry.outcome === 'FAILED') {
        return entry.errorMessage ?? entry.errorCode ?? 'Failed';
    }
    if (entry.outcome === 'UNCHANGED') return 'Checked, nothing changed';
    if (entry.outcome === 'DRY_RUN') {
        return `Checked ${entry.eventsFound} booked period${entry.eventsFound === 1 ? '' : 's'} - not applied (set to ignore)`;
    }

    const moved: string[] = [];
    if (entry.blocksCreated > 0) moved.push(`${entry.blocksCreated} blocked`);
    if (entry.blocksRemoved > 0) moved.push(`${entry.blocksRemoved} freed`);
    if (entry.conflictsDetected > 0) {
        moved.push(
            `${entry.conflictsDetected} clash${entry.conflictsDetected === 1 ? '' : 'es'} with your bookings`,
        );
    }
    return moved.length > 0
        ? `${moved.join(', ')} (${entry.eventsFound} in the feed)`
        : 'Checked, nothing changed';
}

/** The proof the operator needs: a count, not just a green tick. */
function ValidationLine({ result }: { result: ValidateFeedResult }) {
    if (!result.valid) {
        return (
            <p className='text-xs text-danger-fg'>
                {result.message ?? 'That link could not be read.'}
            </p>
        );
    }
    // Valid but empty is NORMAL for a channel with no upcoming bookings, so it
    // must not read as a problem the operator has to solve before saving.
    if ((result.eventCount ?? 0) === 0) {
        return (
            <p className='text-xs text-warning-fg'>
                This calendar works but has no bookings in it yet. That is
                normal if nothing is booked on that channel.
            </p>
        );
    }
    return (
        <p className='text-xs text-success-fg'>
            Calendar found - {result.eventCount} booked
            {result.eventCount === 1 ? ' period' : ' periods'}
            {result.firstEvent ? `, from ${result.firstEvent}` : ''}.
        </p>
    );
}
