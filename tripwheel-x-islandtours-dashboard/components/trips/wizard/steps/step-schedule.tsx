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
import { useCallback, useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSchedules, useUpdateTrip } from '@/hooks/trips/use-trips';
import { tripToUpdatePayload } from '@/lib/trips/update-payload';
import type { TripListItem } from '@/types/trip';
import { TripAvailabilityCalendar } from '../../trip-availability-calendar';
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
    const { setStepError } = useWizard();
    const { data: schedules } = useSchedules(trip.id);

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

    useEffect(() => {
        reset(toDefaults(trip));
    }, [trip, reset]);

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
                            durationMinutesFrom: values.durationMinutesFrom
                                ? Number(values.durationMinutesFrom)
                                : undefined,
                            durationMinutesTo: values.durationMinutesTo
                                ? Number(values.durationMinutesTo)
                                : undefined,
                        },
                    });
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
    }, [handleSubmit, updateTrip, trip, setStepError]);

    useStepCommit('schedule', { submit, isPending, isDirty });

    const declaredTimes = [...new Set(trip.startTimes ?? [])].sort();
    const scheduleCount = schedules?.length ?? 0;
    const activeDays = new Set((schedules ?? []).map(s => s.weekday)).size;

    return (
        <>
            <WizardStepHeader step='schedule' />
            <WizardStepBody>
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
                    description='Weekly schedules and date exceptions can only use times declared here.'
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
                    title='Weekly pattern'
                    description='Departures are generated from these rules.'
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
                    />
                </WizardSection>

                <WizardSection
                    id='calendar'
                    title='Calendar and exceptions'
                    description='Tap a day to close it, reopen it, adjust capacity or add a departure.'>
                    <TripAvailabilityCalendar
                        bare
                        tripId={trip.id}
                        timeZone={trip.timeZone}
                        maxPartySize={trip.maxPartySize}
                        declaredStartTimes={trip.startTimes ?? []}
                    />
                </WizardSection>
            </WizardStepBody>
        </>
    );
}
