'use client';

/**
 * Step 4 - Schedule and availability (07 §3).
 *
 * Everything about time, in the order an operator thinks about it: how long
 * the tour runs, what times it leaves, which weekdays repeat, and which
 * individual dates differ.
 *
 * Two things worth knowing:
 *
 * - **Duration lives here**, not with the trip details. It left the old
 *   40-field form in the task 3 split and this is its home - "how long is it"
 *   is a time question, and it sits next to the start times it constrains.
 * - **The calendar is unchanged.** Same `useManageCalendar` month query, same
 *   one-tap CLOSE_DATE / CLOSE_SLOT / OPEN exception writes, same island
 *   timezone "today", same popover. It is placed in a section and nothing
 *   else. Behaviour here was deliberately not touched.
 *
 * The capacity dependency runs backwards from step 3: `maxPartySize` is
 * already answered by the time an operator arrives, so this step states the
 * seat count as a fact instead of warning about its absence.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { useSyncFormWhenPristine } from '@/hooks/use-sync-form-when-pristine';
import { useForm, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { format } from 'date-fns';

import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    useAvailabilitySummary,
    useConfirmAvailability,
    useExceptions,
    useSchedules,
    useUpdateTrip,
} from '@/hooks/trips/use-trips';
import {
    numberOrNull,
    tripToUpdatePayload,
} from '@/lib/trips/update-payload';
import type { TripListItem } from '@/types/trip';
import { TripAvailabilityCalendar } from '../../trip-availability-calendar';
import { TripDateChanges } from '../../trip-date-changes';
import {
    RecurringSchedulesSection,
    StartTimesSection,
} from '../../trip-schedules-tab';
import { useStepCommit } from '../use-step-commit';
import { useWizard } from '../wizard-context';
import { ConsequenceText, FieldGrid } from '../wizard-fields';
import { WizardSection } from '../wizard-section';
import {
    focusFirstInvalid,
    WizardStepBody,
    WizardStepHeader,
} from '../wizard-step';

const scheduleSchema = z
    .object({
    durationMinutesFrom: z.coerce
        .number()
        .int()
        .min(1)
        .max(10080)
        .optional()
        .or(z.literal('')),
    durationMinutesTo: z.coerce
        .number()
        .int()
        .min(1)
        .max(10080)
        .optional()
        .or(z.literal('')),
    })
    // "3 hours to 1 hour" saved cleanly before this. Nothing else catches it:
    // the backend DTO documents "≥ durationMinutesFrom" in its Swagger
    // description but has no validator behind it, and class-validator cannot
    // express a cross-field rule without a custom constraint (there are two in
    // `common/validators`, neither for this).
    .superRefine((v, ctx) => {
        const from =
            typeof v.durationMinutesFrom === 'number'
                ? v.durationMinutesFrom
                : null;
        const to =
            typeof v.durationMinutesTo === 'number' ? v.durationMinutesTo : null;
        if (from != null && to != null && to < from) {
            ctx.addIssue({
                code: 'custom',
                path: ['durationMinutesTo'],
                message: 'The longest duration cannot be shorter than the shortest.',
            });
        }
    });

type ScheduleValues = {
    durationMinutesFrom: string;
    durationMinutesTo: string;
};

function toDefaults(trip: TripListItem): ScheduleValues {
    return {
        durationMinutesFrom:
            trip.durationMinutesFrom != null
                ? String(trip.durationMinutesFrom)
                : '',
        durationMinutesTo:
            trip.durationMinutesTo != null ? String(trip.durationMinutesTo) : '',
    };
}

/**
 * Mirrors the public card's duration chip (`formatDuration`): under 6h reads
 * in hours, 6-23h "Full day", 24h+ in days. Operator-facing English only.
 */
function durationHint(mins: number): string {
    if (!mins || mins < 1) return '';
    if (mins >= 1440) {
        const d = Math.round(mins / 1440);
        return d <= 1 ? '1 day' : `${d} days`;
    }
    if (mins >= 360) return 'Full day';
    return `${Math.round(mins / 60)}h`;
}

interface StepScheduleProps {
    trip: TripListItem;
}

export function StepSchedule({ trip }: StepScheduleProps) {
    const { mutateAsync: updateTrip, isPending } = useUpdateTrip();
    // Failures render in place, above the step, instead of as a toast.
    const { setStepError, revealSection } = useWizard();

    // Agenda deep link (?step=schedule&date=YYYY-MM-DD): land with the
    // Calendar section open and that date marked on the grid. The calendar
    // itself validates the date (past / beyond-horizon values are ignored).
    const searchParams = useSearchParams();
    const rawJumpDate = searchParams.get('date');
    const jumpDate =
        rawJumpDate && /^\d{4}-\d{2}-\d{2}$/.test(rawJumpDate)
            ? rawJumpDate
            : undefined;
    useEffect(() => {
        if (jumpDate) revealSection('schedule:calendar');
    }, [jumpDate, revealSection]);
    const { data: schedules } = useSchedules(trip.id);
    const { data: summary } = useAvailabilitySummary(trip.id);
    // Same query the register itself renders from - deduped by react-query,
    // read here only for the collapsed-section summary.
    const { data: exceptions } = useExceptions(trip.id);

    // F14 / dev spec §6.4: opening this surface IS a review of the calendar,
    // so the visit stamps availability_confirmed_at. Fire-and-forget - a
    // failed stamp must never disturb the step.
    const { mutate: confirmAvailability } = useConfirmAvailability();
    useEffect(() => {
        confirmAvailability(trip.id);
    }, [trip.id, confirmAvailability]);

    const {
        register,
        handleSubmit,
        watch,
        reset,
        formState: { errors, isDirty },
    } = useForm<ScheduleValues>({
        resolver: zodResolver(
            scheduleSchema,
        ) as unknown as Resolver<ScheduleValues>,
        defaultValues: toDefaults(trip),
    });

    useSyncFormWhenPristine(reset, isDirty, () => toDefaults(trip), trip);

    const v = watch();

    const submit = useCallback(async () => {
        let ok = false;
        await handleSubmit(
            async values => {
                try {
                    await updateTrip({
                        id: trip.id,
                        payload: {
                            ...tripToUpdatePayload(trip),
                            // null, not undefined: "Leave empty for a fixed
                            // duration" is a promise this step has to keep,
                            // and an undefined key never reaches the column.
                            durationMinutesFrom: numberOrNull(
                                values.durationMinutesFrom,
                            ),
                            durationMinutesTo: numberOrNull(
                                values.durationMinutesTo,
                            ),
                        },
                    });
                    // Pristine at the values just persisted. Without
                    // this the step keeps saying "Unsaved changes" over work
                    // that is already saved, and `useSyncFormWhenPristine`
                    // will not re-sync the refetch either, because it
                    // (correctly) refuses to clobber a dirty form.
                    reset(values);
                    ok = true;
                } catch (err) {
                    setStepError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to save duration.',
                    );
                    ok = false;
                }
            },
            () => {
                focusFirstInvalid();
                ok = false;
            },
        )();
        return ok;
    }, [handleSubmit, updateTrip, trip, setStepError, reset]);

    useStepCommit('schedule', { submit, isPending, isDirty });

    const declaredTimes = [...new Set(trip.startTimes ?? [])].sort();
    const scheduleCount = schedules?.length ?? 0;
    const activeDays = new Set((schedules ?? []).map(s => s.weekday)).size;

    // E.9: all times are tour-local (the island's clock, no DST on the ABC
    // islands). One quiet line so an operator editing from Europe never has to
    // wonder whose 09:00 this is. Destination name first; the IANA city is the
    // fallback for the brief window before the join resolves.
    const localPlace =
        trip.destinationName ??
        trip.timeZone.split('/').pop()?.replace(/_/g, ' ') ??
        trip.timeZone;

    // §3.2a status line: one read answering "is this tour selling?". The
    // warning variant is the F13 fix - a LIVE tour with an empty 30-day
    // horizon is out of every ranked listing (§7.2), and before this line the
    // operator's first hint was the revenue graph. Drafts skip the warning:
    // they have no listing to lose, and the readiness checklist owns that
    // conversation.
    const horizonEmpty = summary != null && summary.openInNext30Days === 0;
    const statusLine =
        summary?.nextDeparture != null ? (
            <p className='text-xs pt-2 text-muted-foreground'>
                Next departure:{' '}
                <span className='font-medium text-foreground'>
                    {format(
                        new Date(
                            `${summary.nextDeparture.date}T00:00:00`,
                        ),
                        'EEE MMM d',
                    )}
                    , {summary.nextDeparture.startTime}
                </span>{' '}
                · {summary.openInNext30Days} open departure
                {summary.openInNext30Days === 1 ? '' : 's'} in the next 30
                days. All times are local to {localPlace}.
            </p>
        ) : (
            <p className='text-xs text-muted-foreground'>
                All times are local to {localPlace}.
            </p>
        );

    return (
        <>
            <WizardStepHeader step='schedule' />
            <WizardStepBody>
                {statusLine}
                {horizonEmpty && trip.status === 'LIVE' && (
                    <div className='rounded-md border border-warning-border bg-warning-subtle px-3 py-2.5'>
                        <p className='text-xs text-warning-fg'>
                            <span className='font-medium'>
                                No open departures in the next 30 days.
                            </span>{' '}
                            This tour is hidden from ranked listings until a
                            date opens (it stays reachable by direct link).
                            Add a weekly departure time or reopen a closed
                            date below to bring it back.
                        </p>
                    </div>
                )}
                <WizardSection
                    id='duration'
                    title='Duration'
                    summary={durationHint(Number(v.durationMinutesFrom))}
                    defaultOpen
                    invalid={
                        !!(
                            errors.durationMinutesFrom ||
                            errors.durationMinutesTo
                        )
                    }>
                    <FieldGrid>
                        <Field>
                            <Label>Duration from (minutes)</Label>
                            <Input
                                {...register('durationMinutesFrom')}
                                type='number'
                                min={1}
                                placeholder='e.g. 180'
                                aria-invalid={!!errors.durationMinutesFrom}
                            />
                            <ConsequenceText>
                                {durationHint(Number(v.durationMinutesFrom))
                                    ? `Shows on the tour card as "${durationHint(Number(v.durationMinutesFrom))}".`
                                    : ''}
                            </ConsequenceText>
                            <FieldError>
                                {errors.durationMinutesFrom?.message}
                            </FieldError>
                        </Field>
                        <Field>
                            <Label>Duration to (minutes)</Label>
                            <Input
                                {...register('durationMinutesTo')}
                                type='number'
                                min={1}
                                placeholder='Optional'
                                aria-invalid={!!errors.durationMinutesTo}
                            />
                            <FieldDescription>
                                Leave empty for a fixed duration.
                            </FieldDescription>
                            <FieldError>
                                {errors.durationMinutesTo?.message}
                            </FieldError>
                        </Field>
                    </FieldGrid>
                </WizardSection>

                <WizardSection
                    id='start-times'
                    title='Departure times'
                    description='The weekly schedule and one-off date changes can only use times declared here.'
                    summary={
                        declaredTimes.length
                            ? declaredTimes.slice(0, 3).join(', ') +
                              (declaredTimes.length > 3
                                  ? ` +${declaredTimes.length - 3}`
                                  : '')
                            : 'None yet'
                    }>
                    <StartTimesSection
                        bare
                        tripId={trip.id}
                        declaredStartTimes={trip.startTimes ?? []}
                        schedules={schedules ?? []}
                    />
                </WizardSection>

                <WizardSection
                    id='weekly'
                    title='Weekly schedule'
                    description='The departure times this tour repeats every week. The calendar below shows the result.'
                    summary={
                        scheduleCount
                            ? `${scheduleCount} rule${scheduleCount === 1 ? '' : 's'} across ${activeDays} day${activeDays === 1 ? '' : 's'}`
                            : 'Not set'
                    }>
                    <RecurringSchedulesSection
                        bare
                        tripId={trip.id}
                        maxPartySize={trip.maxPartySize}
                        declaredStartTimes={trip.startTimes ?? []}
                        pricingModel={trip.pricingModel}
                    />
                </WizardSection>

                <WizardSection
                    id='calendar'
                    title='Calendar'
                    description='Every departure as travellers can book it. Tap a day to close it, reopen it or add an extra departure.'>
                    <TripAvailabilityCalendar
                        bare
                        tripId={trip.id}
                        timeZone={trip.timeZone}
                        maxPartySize={trip.maxPartySize}
                        declaredStartTimes={trip.startTimes ?? []}
                        pricingModel={trip.pricingModel}
                        initialDate={jumpDate}
                    />
                </WizardSection>

                <WizardSection
                    id='date-changes'
                    title='Date changes'
                    description='One-off changes to specific dates. The weekly schedule itself stays untouched.'
                    summary={
                        exceptions?.length
                            ? `${exceptions.length} change${exceptions.length === 1 ? '' : 's'}`
                            : 'Empty'
                    }
                    muted>
                    <TripDateChanges
                        tripId={trip.id}
                        timeZone={trip.timeZone}
                    />
                </WizardSection>
            </WizardStepBody>
        </>
    );
}
