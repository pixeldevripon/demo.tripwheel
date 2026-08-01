'use client';

/**
 * The trip creation wizard shell (07 §1, §5.1, §6).
 *
 * ONE journey, two personalities, decided by the tour's lifecycle rather than
 * by the route:
 *
 * - **create** - a DRAFT that has never been published. The operator walks
 *   forward; the rail only unlocks what they have seen; the footer says
 *   "Save and continue".
 * - **edit** - anything published before. Step 9 (Review) is the hub, the rail
 *   is fully unlocked, and the footer returns there after saving.
 *
 * Deriving the mode from `firstPublishedAt` rather than from `/trips/new` vs
 * `/trips/:id/edit` is what makes the two feel like one product: creating a
 * tour spans both routes (step 1 mints the draft and redirects), so a
 * route-derived mode would flip personality mid-creation.
 *
 * `?step=` is the single source of truth for position and accepts legacy
 * `?tab=` values through `resolveStepParam`, so readiness chips, row actions,
 * bookmarks and the e2e specs keep resolving.
 */

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Breadcrumb } from '@/components/breadcrumb';
import { StatusBadge } from '@/components/common/status-badge';
import {
    TRIP_APPROVAL_STATUS,
    TRIP_STATUS,
} from '@/components/common/status-maps';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useTrip } from '@/hooks/trips/use-trips';
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard';
import { dashboardPageEnter } from '@/lib/motion';
import {
    firstIncompleteStep,
    getStepIndex,
    resolveStepParam,
    REVIEW_STEP,
    TAB_TO_SECTION,
    type WizardStepId,
} from '@/lib/trips/wizard-steps';
import type { TripListItem } from '@/types/trip';
import { useWizard, WizardProvider, type WizardMode } from './wizard-context';
import { WizardFooter } from './wizard-footer';
import { WizardProgress } from './wizard-progress';
import { WizardStepError } from './wizard-step-error';
import { WizardStepPanel } from './wizard-step-panel';

interface TripWizardProps {
    /** Absent on /trips/new - step 1 mints the draft. */
    tripId?: string;
}

/**
 * A tour that has never been live is still being built, no matter which route
 * the operator reached it through.
 */
function resolveMode(trip: TripListItem | null | undefined): WizardMode {
    if (!trip) return 'create';
    return trip.firstPublishedAt == null && trip.status === 'DRAFT'
        ? 'create'
        : 'edit';
}

export function TripWizard({ tripId }: TripWizardProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const reduceMotion = useReducedMotion();

    const { data: trip, isLoading } = useTrip(tripId ?? '');

    const mode = resolveMode(tripId ? trip : null);

    // No trip yet means only step 1 can render - nothing else has anything to
    // save against.
    //
    // With a trip, an explicit `?step=` always wins. A BARE url is the
    // interesting case, and it depends on where the tour is in its life:
    //
    //  - edit (published before): the review hub, the honest answer to "what
    //    is left to do" on a tour that is already out there.
    //  - create (an unpublished draft): the first step with work left on it.
    //    Falling through to Review here teleported an operator mid-build to
    //    step 9 of an empty tour - and `/trips/{id}` redirects WITHOUT a
    //    `?step=`, as does a reload after an error, so it was easy to hit and
    //    impossible to explain (operator test report 2026-08-01 §01).
    const rawParam = searchParams.get('step') ?? searchParams.get('tab');
    const bareFallback =
        mode === 'create' && trip ? firstIncompleteStep(trip) : REVIEW_STEP;
    const requested = resolveStepParam(
        rawParam,
        tripId ? bareFallback : 'basics'
    );
    const step: WizardStepId = tripId ? requested : 'basics';
    // A legacy tab deep link names a section, not just a step - open it.
    const deepLinkSection = rawParam ? TAB_TO_SECTION[rawParam] : undefined;

    // Direction for the enter/exit slide: forward slides left, Back slides
    // right. Kept in a ref so computing it never triggers a render.
    const lastIndex = useRef(getStepIndex(step));
    const direction = getStepIndex(step) >= lastIndex.current ? 1 : -1;
    lastIndex.current = getStepIndex(step);

    const [dirty, setDirty] = useState(false);
    const [pendingStep, setPendingStep] = useState<WizardStepId | null>(null);
    useUnsavedGuard(dirty);

    const navigate = useCallback(
        (next: WizardStepId) => {
            if (!tripId) return;
            router.replace(`/trips/${tripId}/edit?step=${next}`, {
                scroll: false,
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        [router, tripId]
    );

    // Leaving a step with unsaved edits is the one place the wizard interrupts.
    // Saving is always one click away in the footer, so the dialog only has to
    // make discarding deliberate.
    const onStepChange = useCallback(
        (next: WizardStepId, force = false) => {
            // `force` is the post-save path. The footer has just awaited a
            // successful commit, but `dirty` is still true: it comes from
            // react-hook-form's `isDirty`, which only clears when the step
            // re-runs `reset(toDefaults(trip))` - and that waits on the
            // mutation invalidating the query, the refetch landing, and a new
            // `trip` propagating down. Reading the flag at that moment asked
            // "Leave this step without saving?" about the click that saved it.
            if (dirty && !force) {
                setPendingStep(next);
                return;
            }
            navigate(next);
        },
        [dirty, navigate, setPendingStep]
    );

    if (tripId && isLoading) return <WizardSkeleton />;

    if (tripId && !trip) {
        return (
            <div className='mx-auto w-full max-w-4xl'>
                <p className='text-sm text-content-muted'>Trip not found.</p>
            </div>
        );
    }

    const statusMeta = trip ? TRIP_STATUS[trip.status] : null;
    const approvalMeta =
        trip &&
        trip.status === 'DRAFT' &&
        (trip.approvalStatus === 'PENDING' ||
            trip.approvalStatus === 'REJECTED')
            ? TRIP_APPROVAL_STATUS[trip.approvalStatus]
            : null;

    return (
        <WizardProvider
            mode={mode}
            tripId={tripId ?? null}
            step={step}
            onStepChange={onStepChange}>
            <DirtyBridge onChange={setDirty} />
            {deepLinkSection && (
                <DeepLinkSection step={step} section={deepLinkSection} />
            )}
            {/* Left-aligned, like every other module in the dashboard. A
                centred column reads as a marketing page and leaves the
                sidebar looking detached from the content.

                No surface overrides here: inputs keep the stock
                `surface-raised` fill they have on Profile, Settings and every
                other form in the dashboard. Forcing them to pure white to
                compensate for the missing cards made them glare against the
                tinted page - the soft off-white IS the house input, and the
                wizard has no business inventing its own. */}
            <div className='w-full max-w-5xl'>
                <Breadcrumb
                    items={[
                        { label: 'Dashboard', href: '/' },
                        { label: 'My Trips', href: '/trips' },
                        { label: trip?.name ?? 'New Trip' },
                    ]}
                />

                <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
                    <h1 className='text-xl font-medium text-content'>
                        {trip?.name ?? 'New trip'}
                    </h1>
                    {statusMeta && (
                        <div className='flex items-center gap-2'>
                            <StatusBadge
                                variant={statusMeta.variant}
                                hint={statusMeta.hint}>
                                {statusMeta.label}
                            </StatusBadge>
                            {approvalMeta && (
                                <StatusBadge
                                    variant={approvalMeta.variant}
                                    hint={approvalMeta.hint}>
                                    {approvalMeta.label}
                                </StatusBadge>
                            )}
                        </div>
                    )}
                </div>

                {/* The rail stays reachable from anywhere in a long step. */}
                <div className='sticky top-0 z-20 -mx-2 mb-6 bg-shell-content/95 px-2 py-2 backdrop-blur-sm'>
                    <WizardProgress trip={trip ?? null} />
                </div>

                {/* Same width as the rail above and the footer below. The
                    narrower column left a dead strip down the right of every
                    step, and the step content stopped lining up with the
                    progress rail it belongs to. */}
                <div className='w-full'>
                    <WizardStepError />

                    <AnimatePresence mode='wait' initial={false}>
                        {/* Fade and settle, not slide. The step content now
                            sits on a bordered plane, and sliding a bordered
                            edge sideways past the viewport reads as a glitch;
                            a short rise lets the sheet arrive instead. */}
                        <motion.div
                            key={step}
                            initial={
                                reduceMotion
                                    ? { opacity: 0 }
                                    : { opacity: 0, y: direction * 8 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            exit={
                                reduceMotion
                                    ? { opacity: 0 }
                                    : { opacity: 0, y: direction * -6 }
                            }
                            transition={
                                reduceMotion
                                    ? { duration: 0 }
                                    : dashboardPageEnter
                            }>
                            <WizardStepPanel step={step} trip={trip ?? null} />
                        </motion.div>
                    </AnimatePresence>
                </div>

                <WizardFooter />
            </div>

            <AlertDialog
                open={pendingStep !== null}
                onOpenChange={open => !open && setPendingStep(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Leave this step without saving?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            You have unsaved changes on this step. Close this
                            and use Save to keep them, or discard them and move
                            on.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep editing</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                const next = pendingStep;
                                setPendingStep(null);
                                setDirty(false);
                                if (next) navigate(next);
                            }}>
                            Discard changes
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </WizardProvider>
    );
}

/**
 * Reports the ACTIVE step's dirty flag back up to the shell, which owns the
 * leave-guard. The shell renders the provider, so it cannot read its own
 * context - this one-line child can.
 */
function DirtyBridge({ onChange }: { onChange: (dirty: boolean) => void }) {
    const { isDirty } = useWizard();
    useEffect(() => {
        onChange(isDirty);
    }, [isDirty, onChange]);
    return null;
}

/**
 * Opens the section a legacy `?tab=` link named, so arriving from a readiness
 * chip or a bookmark lands on the thing to fix rather than on a folded card.
 */
function DeepLinkSection({
    step,
    section,
}: {
    step: WizardStepId;
    section: string;
}) {
    const { revealSection } = useWizard();
    useEffect(() => {
        revealSection(`${step}:${section}`);
    }, [revealSection, step, section]);
    return null;
}

function WizardSkeleton() {
    return (
        <div className='mx-auto w-full max-w-5xl'>
            <Skeleton className='mb-4 h-3 w-56' />
            <Skeleton className='mb-6 h-7 w-64' />
            <Skeleton className='mb-8 h-12 w-full' />
            <Skeleton className='mb-6 h-9 w-72' />
            <div className='space-y-4'>
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className='h-20 w-full rounded-lg' />
                ))}
            </div>
        </div>
    );
}

