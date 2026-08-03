'use client';

import { useState } from 'react';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useOwnDistribution,
    useToggleOwnDistribution,
} from '@/hooks/partners/use-partners';

/** Field names the API returns, in the operator's language rather than ours. */
const FIELD_LABELS: Record<string, string> = {
    slug: 'a supplier ID',
    companyName: 'your business name',
    contactEmail: 'a contact email',
};

/**
 * The operator's own view of distribution.
 *
 * Two things this screen has to get right, both of them about trust rather than mechanics:
 *
 * 1. **Off must always be one click away.** The operator agreed to distribution; they can
 *    withdraw. Switching off is never blocked by validation, never behind a support ticket,
 *    and takes effect on the next request a channel makes.
 * 2. **The rate is shown as what they keep, not as what we take.** "35% commission" and
 *    "you keep 65" are the same number and land completely differently, and the second is
 *    the one they can actually make a decision with.
 *
 * They cannot set their own rate here. That is a negotiated term, and a field an operator
 * could edit would imply otherwise.
 */
export function OperatorDistributionView() {
    const { data, isLoading } = useOwnDistribution();
    const toggle = useToggleOwnDistribution();
    const [confirmingOff, setConfirmingOff] = useState(false);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className='h-5 w-40' />
                </CardHeader>
                <CardContent className='space-y-3'>
                    <Skeleton className='h-4 w-full max-w-md' />
                    <Skeleton className='h-9 w-32' />
                </CardContent>
            </Card>
        );
    }

    if (!data) return null;

    const {
        distributionEnabled,
        distributionRatePct,
        slug,
        profileComplete,
        missingFields,
        connectedChannels,
    } = data;

    const keepPct =
        distributionRatePct === null ? null : 100 - distributionRatePct;

    return (
        <>
            <Card>
                <CardHeader className='border-b'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <CardTitle>Selling through other channels</CardTitle>
                        <Badge
                            variant={
                                distributionEnabled ? 'default' : 'outline'
                            }>
                            {distributionEnabled ? 'On' : 'Off'}
                        </Badge>
                    </div>
                    <p className='mt-1 max-w-2xl text-sm font-light text-muted-foreground'>
                        Lets partner marketplaces show and sell your tours. They
                        see your live tours, your availability and your prices -
                        never your traveller details.
                    </p>
                </CardHeader>

                <CardContent className='space-y-6 pt-6'>
                    {distributionRatePct !== null ? (
                        <div>
                            <h4 className='text-sm font-medium'>
                                Your agreed rate
                            </h4>
                            {/* What they keep, not what we take. Same number, and this
                                is the framing they can act on. */}
                            <p className='mt-1 text-sm text-muted-foreground'>
                                You keep{' '}
                                <span className='font-medium text-foreground'>
                                    {keepPct}%
                                </span>{' '}
                                of the price a traveller pays on a channel
                                booking. The remaining {distributionRatePct}%
                                covers the channel&apos;s commission and ours.
                            </p>
                            <p className='mt-1 text-sm text-muted-foreground'>
                                Bookings made directly on Island Tours are
                                unaffected and keep your normal rate.
                            </p>
                        </div>
                    ) : (
                        <p className='text-sm text-muted-foreground'>
                            No distribution rate has been agreed yet. Talk to us
                            before switching this on.
                        </p>
                    )}

                    {slug && (
                        <div>
                            <h4 className='text-sm font-medium'>
                                Your supplier ID
                            </h4>
                            <p className='mt-1 text-sm text-muted-foreground'>
                                <code className='font-mono text-xs'>
                                    {slug}
                                </code>{' '}
                                is how partners identify you. Quote it in
                                support messages.
                            </p>
                        </div>
                    )}

                    <div>
                        <h4 className='text-sm font-medium'>
                            Connected channels
                        </h4>
                        {connectedChannels.length === 0 ? (
                            <p className='mt-1 text-sm text-muted-foreground'>
                                None yet. We set these up for you - nothing
                                appears here without an agreement.
                            </p>
                        ) : (
                            <div className='mt-2 flex flex-wrap gap-2'>
                                {connectedChannels.map(name => (
                                    <Badge key={name} variant='secondary'>
                                        {name}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    {!profileComplete && !distributionEnabled && (
                        <div className='rounded-md border bg-muted/40 p-3'>
                            <p className='text-sm font-medium'>
                                Finish your profile first
                            </p>
                            <p className='mt-1 text-sm text-muted-foreground'>
                                Partners need{' '}
                                {missingFields
                                    .map(f => FIELD_LABELS[f] ?? f)
                                    .join(', ')}{' '}
                                before we can list you as a supplier.
                            </p>
                        </div>
                    )}

                    <div className='flex flex-wrap items-center gap-3 border-t pt-4'>
                        {distributionEnabled ? (
                            <Button
                                variant='outline'
                                onClick={() => setConfirmingOff(true)}
                                disabled={toggle.isPending}>
                                Turn off
                            </Button>
                        ) : (
                            <Button
                                onClick={() => toggle.mutate(true)}
                                disabled={toggle.isPending || !profileComplete}>
                                Turn on
                            </Button>
                        )}
                        <span className='text-xs text-muted-foreground'>
                            {distributionEnabled
                                ? 'Turning it off takes effect immediately - channels stop seeing your tours.'
                                : 'You can turn this off again at any time.'}
                        </span>
                    </div>
                </CardContent>
            </Card>

            <ConfirmDialog
                open={confirmingOff}
                onOpenChange={setConfirmingOff}
                destructive
                loading={toggle.isPending}
                title='Turn off channel selling?'
                description={
                    <>
                        Partner marketplaces stop seeing your tours on their
                        next request, and cannot take new bookings for you.
                        Bookings they have already made are unaffected and you
                        still have to honour them. You can turn this back on
                        whenever you like.
                    </>
                }
                confirmLabel='Turn off'
                onConfirm={() =>
                    toggle.mutate(false, {
                        onSettled: () => setConfirmingOff(false),
                    })
                }
            />
        </>
    );
}
