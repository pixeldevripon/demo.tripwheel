'use client';

/**
 * Step 9 - Review and publish (07 §8).
 *
 * The terminal step while creating, and the LANDING screen when editing
 * anything already published (07 §6). That dual role is what lets the wizard
 * be the only navigation: an operator changing one price on a live tour is one
 * click from it, and never has to walk eight steps to get there.
 *
 * The readiness contract is unchanged. `getPublishChecks` and
 * `getListingChecks` are the same pure functions the old rail used, the
 * "Publish Readiness" heading is kept verbatim (e2e text contract), publish
 * checks gate the CTA, and listing checks warn without ever blocking - the
 * distinction the old card omitted and the reason "published but invisible"
 * used to be a surprise.
 *
 * Every summary card reads from the query cache. This step fetches nothing the
 * steps behind it did not already load.
 */

import {
    Alert02Icon,
    Archive02Icon,
    ArrowRight01Icon,
    Cancel01Icon,
    LinkSquare02Icon,
    Megaphone01Icon,
    PauseIcon,
    RotateLeft01Icon,
    Tick02Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/common/status-badge';
import { TRIP_STATUS } from '@/components/common/status-maps';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useRole } from '@/contexts/role-context';
import {
    useApproveTrip,
    usePauseTrip,
    usePublishTrip,
    useRejectTrip,
    useSchedules,
    useSubmitTripForReview,
    useTripTranslationByLocale,
    useUnpauseTrip,
} from '@/hooks/trips/use-trips';
import { useDestination } from '@/hooks/destinations/use-destinations';
import { formatPriceFrom } from '@/lib/currency/current';
import { tourUrl } from '@/lib/public-site';
import { crossFade, springPop } from '@/lib/motion';
import {
    getListingChecks,
    getPublishChecks,
    type ReadinessCheck,
} from '@/lib/trips/readiness';
import {
    isStepComplete,
    TAB_TO_SECTION,
    TAB_TO_STEP,
    type WizardStepId,
} from '@/lib/trips/wizard-steps';
import { cn } from '@/lib/utils';
import { tierMeta } from '@/types/tier';
import type { TripListItem } from '@/types/trip';
import { TripArchiveDialog } from '../../trip-archive-dialog';
import { RejectChangesDialog } from '../../lifecycle/reject-changes-dialog';
import { PendingChangesPanel } from './pending-changes-panel';
import { useWizard } from '../wizard-context';
import { WizardStepBody, WizardStepHeader } from '../wizard-step';

/** A summary line: a bare string is a fact, the object form marks a gap. */
type SummaryLine = string | { text: string; missing?: boolean };

interface StepReviewProps {
    trip: TripListItem;
}

export function StepReview({ trip }: StepReviewProps) {
    const { goTo, revealSection } = useWizard();
    const { can, role } = useRole();
    const reduceMotion = useReducedMotion();

    const { data: enTranslation } = useTripTranslationByLocale(trip.id, 'en');
    const { data: schedules } = useSchedules(trip.id);
    // Cached by the location step's maps - this is the only source of the
    // destination SLUG, which the tour payload does not carry.
    const { data: destination } = useDestination(trip.destinationId);

    const { mutate: publishTrip, isPending: isPublishing } = usePublishTrip();
    const { mutate: pauseTrip, isPending: isPausing } = usePauseTrip();
    const { mutate: unpauseTrip, isPending: isUnpausing } = useUnpauseTrip();
    const { mutate: submitForReview, isPending: isSubmitting } =
        useSubmitTripForReview();
    const { mutate: approveTrip, isPending: isApproving } = useApproveTrip();
    const { mutate: rejectTrip, isPending: isRejecting } = useRejectTrip();

    const [rejectOpen, setRejectOpen] = useState(false);
    const [archiveOpen, setArchiveOpen] = useState(false);
    // F7: pause states its consequences before acting.
    const [pauseOpen, setPauseOpen] = useState(false);

    const publishChecks = getPublishChecks(
        trip,
        !!enTranslation?.overview?.trim()
    );
    const listingChecks = getListingChecks(trip);
    const passed = publishChecks.filter(c => c.passed).length;
    const allPassed = passed === publishChecks.length;
    const remaining = publishChecks.length - passed;

    const canManage = can('MANAGE_TRIPS');
    const canSubmit = can('EDIT_TRIP');
    const isAdmin = role === 'ADMIN';
    const isDraft = trip.status === 'DRAFT';
    // The statuses from which an operator may ASK Island Tours to act. PAUSED
    // and ARCHIVED belong here for the same reason as in the row actions: every
    // exit from them is MANAGE_TRIPS, so gating the request on DRAFT left the
    // operator with nothing to do but look at it (operator test report
    // 2026-08-01 §02). Submitting stamps a request; it never moves the status.
    const canRequestReview =
        trip.status === 'DRAFT' ||
        trip.status === 'PAUSED' ||
        trip.status === 'ARCHIVED';
    const requestLabel =
        trip.status === 'PAUSED'
            ? 'Ask to go live again'
            : trip.status === 'ARCHIVED'
              ? 'Ask to bring this back'
              : trip.approvalStatus === 'REJECTED'
                ? 'Resubmit for review'
                : 'Submit for review';
    const statusMeta = TRIP_STATUS[trip.status];

    // One definition of "done", shared with the progress rail - a row and a
    // rail dot can never disagree about the same step.
    const stepDone = (id: WizardStepId) =>
        isStepComplete(id, trip, !!enTranslation?.overview?.trim());

    // `check.tab` is still the old tab id - route it through the same map the
    // readiness chips and bookmarks use.
    const stepFor = (check: ReadinessCheck): WizardStepId =>
        TAB_TO_STEP[check.tab] ?? 'review';

    /**
     * "Fix this" has to land on the FIELD, not merely on the screen that
     * contains it.
     *
     * A step is a stack of eight or nine collapsed rows, so arriving with the
     * offending one folded away is the same dead end as arriving on the wrong
     * step: the operator is told what is wrong, taken somewhere, and still has
     * to hunt. `TAB_TO_SECTION` already names the section that owns each
     * legacy tab's fields - the deep-link path uses it for exactly this - so
     * reuse it and open the section BEFORE navigating. Accordion state is held
     * by the provider and keyed by step, so it survives the step change and
     * the section is already open when the step mounts.
     *
     * Not every check has a section: the media step is one job with no
     * collapsibles, so `images`/`hero` just navigate.
     */
    const fix = (check: ReadinessCheck) => {
        const target = stepFor(check);
        const section = TAB_TO_SECTION[check.tab];
        if (section) revealSection(`${target}:${section}`);
        goTo(target);
    };

    return (
        <>
            <WizardStepHeader
                step='review'
                title={
                    trip.status === 'LIVE'
                        ? 'This tour is live'
                        : allPassed
                          ? 'Ready to publish'
                          : 'Almost there'
                }
                description={
                    trip.status === 'LIVE'
                        ? 'Everything below is what travellers see. Price and booking cutoff changes apply immediately; changes to the title, description or photos go to Island Tours for review first, and travellers keep seeing the approved version meanwhile.'
                        : allPassed
                          ? 'Everything required is in place.'
                          : `${remaining} thing${remaining === 1 ? '' : 's'} left before this tour can go live.`
                }
                aside={
                    <div className='flex items-center gap-2'>
                        {/* The subtitle claims "everything below is what
                            travellers see" - and until now the screen gave no
                            way to go and look. Only for LIVE tours: a draft has
                            no page to open, and a dead link is worse than none.
                            The destination SLUG is not on the tour payload, so
                            it comes from the destination query the wizard
                            already has cached for its maps. */}
                        {trip.status === 'LIVE' && destination?.slug && (
                            <a
                                href={tourUrl(destination.slug, trip.slug)}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-content-muted transition-colors duration-fast hover:bg-surface-sunken hover:text-content'>
                                <HugeiconsIcon
                                    icon={LinkSquare02Icon}
                                    className='size-3.5'
                                />
                                View live page
                            </a>
                        )}
                        <StatusBadge
                            variant={statusMeta.variant}
                            hint={statusMeta.hint}>
                            {statusMeta.label}
                        </StatusBadge>
                        {trip.isSponsored && (
                            <StatusBadge
                                variant='neutral'
                                icon={
                                    <HugeiconsIcon
                                        icon={Megaphone01Icon}
                                        className='size-3'
                                    />
                                }>
                                Sponsored
                            </StatusBadge>
                        )}
                    </div>
                }
            />

            <WizardStepBody>
                {/* Live-tour content gate (client review #19): the pending
                    change set - operator sees what waits, platform decides. */}
                {trip.status === 'LIVE' && <PendingChangesPanel trip={trip} />}

                {/* Review verdict: the admin's actionable note. */}
                {trip.approvalStatus === 'REJECTED' && trip.reviewNote && (
                    <div className='rounded-lg border border-danger-border bg-danger-subtle px-4 py-3'>
                        <p className='text-xs font-medium text-danger-fg'>
                            Changes requested by Island Tours
                        </p>
                        <p className='mt-1 text-sm text-danger-fg'>
                            {trip.reviewNote}
                        </p>
                    </div>
                )}

                <section className='py-6'>
                    <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
                        {/* Literal heading kept - e2e text contract. */}
                        <p className='text-sm font-medium text-content'>
                            Publish Readiness
                        </p>
                        <span
                            className={cn(
                                'rounded-full px-2 py-0.5 text-2xs font-medium',
                                allPassed
                                    ? 'bg-success-subtle text-success-fg'
                                    : 'bg-warning-subtle text-warning-fg'
                            )}>
                            {passed}/{publishChecks.length}
                        </span>
                    </div>

                    <ul className='space-y-1.5'>
                        {publishChecks.map((check, i) => (
                            <CheckRow
                                key={check.key}
                                check={check}
                                index={i}
                                onFix={() => fix(check)}
                            />
                        ))}
                    </ul>

                    <div className='mt-6 border-t border-line pt-4'>
                        <p className='mb-2 text-xs font-medium text-content-muted'>
                            To appear in listings
                        </p>
                        <ul className='space-y-1.5'>
                            {listingChecks.map((check, i) => (
                                <CheckRow
                                    key={check.key}
                                    check={check}
                                    index={publishChecks.length + i}
                                    onFix={() => fix(check)}
                                />
                            ))}
                        </ul>
                        {!trip.isBookable && trip.status === 'LIVE' && (
                            <p className='mt-3 text-xs text-warning-fg'>
                                Published, but not listed yet: this tour has no
                                bookable departures in the next 30 days. It
                                lists automatically once it does.
                            </p>
                        )}
                        {/* The cliff. Both listing checks are present-tense -
                            "are there departures NOW" - so a live tour whose
                            recurring rules have all been deleted still shows
                            green while it has departures left. It does: the
                            materializer only retires UNBOOKED, unedited ones,
                            so anything booked survives the rules that made it.
                            Nothing generates more, so the tour drops out of
                            listings the day the last one passes, silently. */}
                        {trip.status === 'LIVE' &&
                            trip.isBookable &&
                            (schedules?.length ?? 0) === 0 && (
                                <p className='mt-3 text-xs text-warning-fg'>
                                    No weekly schedule. The departures still on
                                    sale are the last ones - once they pass,
                                    this tour stops appearing in listings. Add a
                                    weekly departure time to keep it selling.
                                </p>
                            )}
                    </div>
                </section>

                {/* Summary. Every row jumps to the step that owns it. Two
                    columns of hairline-separated rows, matching how a step's
                    own sections are drawn. */}
                <motion.div
                    // Separators only BETWEEN rows - no rule around the block.
                    // A border-t plus a border-b on every child boxed the group
                    // into a hard-cornered panel, which is the card look this
                    // step just shed.
                    className='grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0 sm:[&>*:not(:nth-last-child(-n+2))]:border-b sm:[&>*]:border-line'
                    initial={reduceMotion ? false : 'hidden'}
                    animate='visible'
                    variants={{
                        visible: { transition: { staggerChildren: 0.035 } },
                    }}>
                    <SummaryCard
                        title='Basics'
                        step='basics'
                        onEdit={goTo}
                        complete={stepDone('basics')}
                        lines={[
                            trip.name,
                            [
                                trip.destinationName ?? '',
                                `${trip.categoryIds.length} categor${trip.categoryIds.length === 1 ? 'y' : 'ies'}`,
                            ]
                                .filter(Boolean)
                                .join(' · '),
                        ]}
                    />
                    <SummaryCard
                        title='Pricing'
                        step='pricing'
                        onEdit={goTo}
                        complete={stepDone('pricing')}
                        lines={[
                            `${trip.pricingModel === 'UNIT' ? `Per ${(trip.wholeUnitType ?? 'unit').toLowerCase()}` : 'Per person'} · ${trip.defaultCurrency}`,
                            (trip.priceFrom ?? trip.basePrice)
                                ? `from ${formatPriceFrom(
                                      (trip.priceFrom ?? trip.basePrice)!,
                                      trip.defaultCurrency,
                                      'en'
                                  )}`
                                : { text: 'No price set', missing: true },
                        ]}
                    />
                    <SummaryCard
                        title='Booking rules'
                        step='rules'
                        onEdit={goTo}
                        complete={stepDone('rules')}
                        lines={[
                            trip.maxPartySize
                                ? `${trip.minPartySize} to ${trip.maxPartySize} guests`
                                : `${trip.minPartySize}+ guests, no maximum`,
                            `Free cancellation ${trip.cancellationHours}h before`,
                        ]}
                    />
                    <SummaryCard
                        title='Schedule'
                        step='schedule'
                        onEdit={goTo}
                        complete={stepDone('schedule')}
                        lines={[
                            trip.durationMinutesFrom
                                ? `${trip.durationMinutesFrom} minutes`
                                : { text: 'No duration set', missing: true },
                            (schedules?.length ?? 0) === 0
                                ? { text: 'No weekly rules', missing: true }
                                : `${schedules?.length} weekly rule${schedules?.length === 1 ? '' : 's'}`,
                        ]}
                    />
                    <SummaryCard
                        title='Location'
                        step='location'
                        onEdit={goTo}
                        complete={stepDone('location')}
                        lines={[
                            trip.departureCity ?? 'No departure city',
                            // The meeting point, in words. "Meeting point set"
                            // is the readiness list's job, not the review's.
                            enTranslation?.meetingPointText?.trim() ||
                                (trip.meetingPointLat != null &&
                                trip.meetingPointLng != null
                                    ? 'Pinned on the map'
                                    : 'No meeting point yet'),
                        ]}
                    />
                    <SummaryCard
                        title='Photos'
                        step='media'
                        onEdit={goTo}
                        complete={stepDone('media')}
                        lines={[
                            (trip.imageCount ?? 0) < 5
                                ? {
                                      text: `${trip.imageCount ?? 0} photo${(trip.imageCount ?? 0) === 1 ? '' : 's'}`,
                                      missing: true,
                                  }
                                : `${trip.imageCount} photos`,
                            trip.heroImage
                                ? 'Cover photo chosen'
                                : { text: 'No cover photo', missing: true },
                        ]}
                    />
                    <SummaryCard
                        title='Description'
                        step='content'
                        onEdit={goTo}
                        complete={stepDone('content')}
                        lines={[
                            // The overview ITSELF, not "Overview written".
                            // Readiness two blocks up already reports whether it
                            // exists; repeating that here spent a review row on
                            // a boolean the operator had just read.
                            enTranslation?.overview?.trim() || {
                                text: 'No overview yet',
                                missing: true,
                            },
                            (trip.highlightCount ?? 0) < 3
                                ? {
                                      text: `${trip.highlightCount ?? 0} of 3 highlights`,
                                      missing: true,
                                  }
                                : `${trip.highlightCount} highlights`,
                        ]}
                    />
                    <SummaryCard
                        title='Reach'
                        step='reach'
                        onEdit={goTo}
                        complete={stepDone('reach')}
                        lines={[
                            `${tierMeta(trip.tierKey).label} tier · ${trip.commissionTier}%`,
                            // "0 hubs" reads as a gap; hubs are optional.
                            trip.hubIds.length
                                ? `${trip.hubIds.length} hub${trip.hubIds.length === 1 ? '' : 's'}`
                                : 'No hubs (optional)',
                        ]}
                    />
                </motion.div>

                {/* Lifecycle. The only place these actions live. */}
                <div className='flex flex-wrap items-center justify-end gap-3 border-t border-line pt-6'>
                    {canRequestReview && !canManage && canSubmit && (
                        <>
                            {trip.approvalStatus === 'PENDING' ? (
                                <p className='text-xs font-medium text-warning-fg'>
                                    In review by Island Tours - you will see the
                                    verdict here.
                                </p>
                            ) : trip.approvalStatus === 'APPROVED' ? (
                                // A tour sits DRAFT+APPROVED between an admin
                                // approving it and an admin publishing it -
                                // two separate actions, and publishing is
                                // MANAGE_TRIPS-only. The operator used to see
                                // an enabled "Submit for review" here, which
                                // `submitForReview` answers with a 409.
                                <p className='text-xs font-medium text-success-fg'>
                                    Approved - Island Tours will publish it
                                    shortly.
                                </p>
                            ) : (
                                <>
                                    {!allPassed && (
                                        <p className='mr-auto text-xs text-content-muted'>
                                            {remaining} item
                                            {remaining === 1 ? '' : 's'} left
                                            before you can submit.
                                        </p>
                                    )}
                                    <Button
                                        disabled={!allPassed || isSubmitting}
                                        onClick={() =>
                                            submitForReview(trip.id, {
                                                onSuccess: () =>
                                                    toast.success(
                                                        'Submitted - Island Tours will review it.'
                                                    ),
                                                onError: err =>
                                                    toast.error(
                                                        err instanceof Error
                                                            ? err.message
                                                            : 'Failed to submit for review.'
                                                    ),
                                            })
                                        }>
                                        {isSubmitting
                                            ? 'Submitting...'
                                            : requestLabel}
                                    </Button>
                                </>
                            )}
                        </>
                    )}

                    {isDraft && canManage && (
                        <>
                            {!allPassed && (
                                <p className='mr-auto text-xs text-content-muted'>
                                    {remaining} item
                                    {remaining === 1 ? '' : 's'} left before
                                    this tour can go live.
                                </p>
                            )}
                            {trip.approvalStatus === 'PENDING' && (
                                <>
                                    <Button
                                        variant='outline'
                                        disabled={isApproving}
                                        onClick={() => setRejectOpen(true)}>
                                        Request changes
                                    </Button>
                                    <Button
                                        variant='outline'
                                        disabled={isApproving}
                                        onClick={() =>
                                            approveTrip(
                                                { id: trip.id },
                                                {
                                                    onSuccess: () =>
                                                        toast.success(
                                                            'Approved - publish when ready.'
                                                        ),
                                                    onError: err =>
                                                        toast.error(
                                                            err instanceof Error
                                                                ? err.message
                                                                : 'Failed to approve.'
                                                        ),
                                                }
                                            )
                                        }>
                                        {isApproving
                                            ? 'Approving...'
                                            : 'Approve'}
                                    </Button>
                                </>
                            )}
                            <Button
                                disabled={
                                    !allPassed ||
                                    isPublishing ||
                                    (!isAdmin &&
                                        trip.approvalStatus !== 'APPROVED')
                                }
                                onClick={() =>
                                    publishTrip(trip.id, {
                                        onSuccess: () =>
                                            toast.success(
                                                'Trip published successfully.'
                                            ),
                                        onError: err =>
                                            toast.error(
                                                err instanceof Error
                                                    ? err.message
                                                    : 'Failed to publish.'
                                            ),
                                    })
                                }>
                                {isPublishing ? 'Publishing...' : 'Publish'}
                            </Button>
                        </>
                    )}

                    {canManage && trip.status === 'LIVE' && (
                        <>
                            <Button
                                variant='outline'
                                disabled={isPausing}
                                onClick={() => setPauseOpen(true)}>
                                <HugeiconsIcon
                                    icon={PauseIcon}
                                    className='size-3.5'
                                />
                                Pause
                            </Button>
                            <AlertDialog
                                open={pauseOpen}
                                onOpenChange={setPauseOpen}>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Pause this tour?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            The tour leaves the public site
                                            immediately and nothing can be
                                            booked while it is paused. Existing
                                            bookings are kept and stay valid -
                                            contact booked guests yourself if
                                            their departure will not run.
                                            Unpausing puts the tour back
                                            exactly as it was. To stop selling
                                            only specific dates, close them on
                                            the calendar in the Schedule step
                                            instead.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => {
                                                setPauseOpen(false);
                                                pauseTrip(trip.id, {
                                                    onSuccess: () =>
                                                        toast.success(
                                                            'Trip paused.',
                                                            {
                                                                duration: 10_000,
                                                                action: {
                                                                    label: 'Undo',
                                                                    onClick:
                                                                        () =>
                                                                            unpauseTrip(
                                                                                trip.id,
                                                                                {
                                                                                    onSuccess:
                                                                                        () =>
                                                                                            toast.success(
                                                                                                'Trip resumed.'
                                                                                            ),
                                                                                    onError:
                                                                                        err =>
                                                                                            toast.error(
                                                                                                err instanceof
                                                                                                    Error
                                                                                                    ? err.message
                                                                                                    : 'Undo failed - the tour is still paused.'
                                                                                            ),
                                                                                }
                                                                            ),
                                                                },
                                                            }
                                                        ),
                                                    onError: err =>
                                                        toast.error(
                                                            err instanceof
                                                                Error
                                                                ? err.message
                                                                : 'Failed to pause.'
                                                        ),
                                                });
                                            }}>
                                            Pause tour
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <Button
                                variant='outline'
                                onClick={() => setArchiveOpen(true)}>
                                <HugeiconsIcon
                                    icon={Archive02Icon}
                                    className='size-3.5'
                                />
                                Archive
                            </Button>
                        </>
                    )}

                    {canManage && trip.status === 'PAUSED' && (
                        <>
                            <Button
                                disabled={isUnpausing}
                                onClick={() =>
                                    unpauseTrip(trip.id, {
                                        onSuccess: () =>
                                            toast.success('Trip resumed.', {
                                                duration: 10_000,
                                                action: {
                                                    label: 'Undo',
                                                    onClick: () =>
                                                        pauseTrip(trip.id, {
                                                            onSuccess: () =>
                                                                toast.success(
                                                                    'Trip paused again.'
                                                                ),
                                                            onError: err =>
                                                                toast.error(
                                                                    err instanceof
                                                                        Error
                                                                        ? err.message
                                                                        : 'Undo failed - the tour is still live.'
                                                                ),
                                                        }),
                                                },
                                            }),
                                        onError: err =>
                                            toast.error(
                                                err instanceof Error
                                                    ? err.message
                                                    : 'Failed to unpause.'
                                            ),
                                    })
                                }>
                                <HugeiconsIcon
                                    icon={RotateLeft01Icon}
                                    className='size-3.5'
                                />
                                Unpause
                            </Button>
                            <Button
                                variant='outline'
                                onClick={() => setArchiveOpen(true)}>
                                <HugeiconsIcon
                                    icon={Archive02Icon}
                                    className='size-3.5'
                                />
                                Archive
                            </Button>
                        </>
                    )}
                </div>
            </WizardStepBody>

            <RejectChangesDialog
                tripName={trip.name}
                open={rejectOpen}
                onOpenChange={setRejectOpen}
                isPending={isRejecting}
                onConfirm={note =>
                    rejectTrip(
                        { id: trip.id, note },
                        {
                            onSuccess: () => {
                                setRejectOpen(false);
                                toast.success(
                                    'Changes requested - the operator sees your note.'
                                );
                            },
                            onError: err =>
                                toast.error(
                                    err instanceof Error
                                        ? err.message
                                        : 'Failed to reject.'
                                ),
                        }
                    )
                }
            />

            <TripArchiveDialog
                tripId={trip.id}
                tripName={trip.name}
                tripStatus={trip.status}
                open={archiveOpen}
                onOpenChange={setArchiveOpen}
            />
        </>
    );
}

function CheckRow({
    check,
    index,
    onFix,
}: {
    check: ReadinessCheck;
    index: number;
    onFix: () => void;
}) {
    const reduceMotion = useReducedMotion();
    return (
        // Status icon on the RIGHT so every label starts flush left, in line
        // with the heading above and the summary cards below. A leading icon
        // indented the whole list by 26px for no reading benefit.
        <li className='flex items-center gap-3 text-sm'>
            <span
                className={
                    check.passed ? 'text-content-muted' : 'text-content'
                }>
                {check.label}
            </span>
            {!check.passed && (
                <Button
                    size='sm'
                    variant='ghost'
                    onClick={onFix}
                    // Warning, not primary. An unmet check is the same
                    // severity as the glyph beside it, and teal read as a
                    // fifth navigation link in a column of them.
                    className='ml-auto h-auto py-0.5 text-xs text-warning-fg'>
                    Fix this
                </Button>
            )}
            <AnimatePresence mode='wait' initial={false}>
                <motion.span
                    key={check.passed ? 'on' : 'off'}
                    initial={reduceMotion ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={
                        reduceMotion
                            ? { duration: 0 }
                            : { ...springPop, delay: index * 0.02 }
                    }
                    className={cn('flex shrink-0', check.passed && 'ml-auto')}>
                    <HugeiconsIcon
                        icon={check.passed ? Tick02Icon : Cancel01Icon}
                        className={cn(
                            'size-4',
                            check.passed
                                ? 'text-success-solid'
                                // Warning, not danger. A draft that is not
                                // finished yet is INCOMPLETE, not broken -
                                // red said something had gone wrong when the
                                // operator had simply not got there yet.
                                : 'text-warning-solid'
                        )}
                    />
                </motion.span>
            </AnimatePresence>
        </li>
    );
}

function SummaryCard({
    title,
    step,
    lines,
    complete,
    onEdit,
}: {
    title: string;
    step: WizardStepId;
    /**
     * A plain string is a FACT. `{ text, missing: true }` is a gap.
     *
     * Tinting every secondary line whenever the step was incomplete painted
     * "Free cancellation 48h before" amber on a row whose real problem was
     * capacity - a set, valid value flagged as a fault. A line knows whether
     * it is reporting something absent; the step does not.
     */
    lines: (SummaryLine | null | undefined)[];
    /** No readiness check this step owns is failing. */
    complete: boolean;
    onEdit: (step: WizardStepId) => void;
}) {
    const hasGap = lines.some(
        l => typeof l === 'object' && l !== null && !!l.missing,
    );

    return (
        // A ROW, not a card. Every other surface in the wizard shed its border,
        // ring and fill; eight bordered boxes here made Review look like a
        // different product from the step before it.
        //
        // The whole row is the target. It used to be a plain div with a 28px
        // "Edit" text button in the corner - eight small hit areas where eight
        // full-width ones were free, and the word repeated down the column.
        // The chevron says the same thing without saying it eight times.
        <motion.button
            type='button'
            onClick={() => onEdit(step)}
            variants={{
                hidden: { opacity: 0, y: 8 },
                visible: { opacity: 1, y: 0 },
            }}
            transition={crossFade}
            // No `w-full`. With an explicit 100% width the negative margin can
            // only SHIFT the box, not widen it - so the row sat 12px left of
            // its column and `px-3` pulled the chevron a further 12px in,
            // landing it 24px short of the readiness ticks above, which have no
            // horizontal padding at all. Letting the grid stretch it to auto
            // width makes `-mx-3` bleed both edges and `px-3` return the content
            // to exactly the column edges.
            // NOT rounded. The separator hairline is `border-b` on this same
            // element (the grid sets it), so any border-radius curves the line
            // up at both ends - which is what made these read as rounded boxes
            // rather than as rows with a rule between them. `WizardSection` can
            // keep its rounded hover because its border lives on the PARENT,
            // not on the button.
            className='group -mx-3 flex items-center gap-3 px-3 py-3 text-left transition-colors duration-fast hover:bg-surface-sunken/60'>
            <span className='min-w-0 flex-1'>
                <span className='block text-xs font-medium text-content-muted'>
                    {title}
                </span>
                {lines.filter(Boolean).map((line, i) => {
                    const text = typeof line === 'string' ? line : line!.text;
                    const missing =
                        typeof line === 'string' ? false : !!line!.missing;
                    return (
                        <span
                            key={i}
                            className={cn(
                                'mt-0.5 block truncate text-sm',
                                missing
                                    ? 'text-warning-fg'
                                    : i === 0
                                      ? 'font-medium text-content'
                                      : 'text-content-muted'
                            )}>
                            {text}
                        </span>
                    );
                })}
            </span>
            {/* Only the rows that NEED something speak. No tick: one on every
                settled row put eight glyphs in a grid to report the absence of
                news, and the three steps that own no readiness checks were
                permanently green - a badge for having nothing to do.
                
                The warning fires on either signal: a failing readiness check
                (`!complete`), OR a line that reports something absent. Keying
                it to `complete` alone left rows with amber text and no glyph,
                which read as the icon having gone missing. */}
            {(!complete || hasGap) && (
                <HugeiconsIcon
                    icon={Alert02Icon}
                    className='size-4 shrink-0 text-warning-solid'
                />
            )}
            <HugeiconsIcon
                icon={ArrowRight01Icon}
                className='size-4 shrink-0 text-content-subtle transition-colors duration-fast group-hover:text-content-muted'
            />
        </motion.button>
    );
}

