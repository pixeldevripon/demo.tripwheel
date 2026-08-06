'use client';

/**
 * Step 5 - Location and route (07 §3).
 *
 * The one screen where coordinates are entered. The brief filed Itinerary
 * under "Trip details", but a `TourLocation` is a point on a map with a
 * caption, not prose. Keeping the meeting point, the stop list and the pickup
 * points together means the operator works in one mental mode (07 §2.2 b).
 *
 * Two maps, not three: the meeting point and the route. Pickup zones lost
 * theirs when their coordinates turned out to have no reader anywhere in the
 * product - see `trip-pickup-locations-tab`.
 *
 * Three owners on one screen, which is why only the first saves through the
 * footer:
 * - meeting point + pickup MODEL are trip-core fields (PATCH /tours/:id),
 *   rebuilt through `tripToUpdatePayload`;
 * - the itinerary stops and the pickup points are child collections that save
 *   themselves as the operator works, exactly as they do today.
 *
 * `meetingPointText` is NOT here: it is a translation field, and the tour
 * translation upsert writes all English fields in one call from step 7.
 * Splitting that writer across two steps would let one clobber the other.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { findEnglish } from '@/lib/trips/forms';
import { useCallback, useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import type { RoutePoint } from '@/components/common/map-picker';
import {
    MapPickerField,
    RouteMap,
} from '@/components/common/map-picker-field';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDestination } from '@/hooks/destinations/use-destinations';
import {
    useLocations,
    useUpdateLocation,
    useUpdateTrip,
} from '@/hooks/trips/use-trips';
import {
    blankToNull,
    numberOrNull,
    tripToUpdatePayload,
} from '@/lib/trips/update-payload';
import type { TripListItem } from '@/types/trip';
import {
    NEW_STOP_KEY,
    TripLocationsTab,
} from '../../trip-locations-tab';
import { TripPickupLocationsTab } from '../../trip-pickup-locations-tab';
import { useSyncFormWhenPristine } from '@/hooks/use-sync-form-when-pristine';
import { useStepCommit } from '../use-step-commit';
import { useWizard } from '../wizard-context';
import { FieldGrid, SelectField, ToggleRow } from '../wizard-fields';
import { WizardSection } from '../wizard-section';
import {
    focusFirstInvalid,
    WizardStepBody,
    WizardStepHeader,
} from '../wizard-step';

/**
 * A coordinate box takes free text, so it also takes "12,1091".
 *
 * `Number('12,1091')` is NaN, `JSON.stringify(NaN)` is `null`, and the backend
 * treats a null as "clear this column" - so a decimal comma, which is the
 * normal way to write one across the Dutch Caribbean, wiped the meeting point
 * and moved the map instead of reporting a typo. `@IsLatitude()` on the DTO
 * never saw it: `@IsOptional()` skips null outright.
 */
function coordinate(axis: 'Latitude' | 'Longitude', limit: number) {
    return z
        .string()
        .refine(
            s =>
                s.trim() === '' ||
                (Number.isFinite(Number(s)) && Math.abs(Number(s)) <= limit),
            `${axis} must be a number between -${limit} and ${limit} - use a dot, not a comma.`,
        );
}

const locationSchema = z
    .object({
        departureCity: z.string().max(120).optional().or(z.literal('')),
        meetingPointLat: coordinate('Latitude', 90),
        meetingPointLng: coordinate('Longitude', 180),
        pickupModel: z.enum(['NONE', 'INCLUDED', 'PAID_ADDON']),
        pickupRequired: z.boolean(),
    })
    // Half a point is not a point. Saving one axis alone left the map with
    // nothing to draw and the tour page with a meeting point it cannot plot.
    .superRefine((v, ctx) => {
        const lat = v.meetingPointLat.trim();
        const lng = v.meetingPointLng.trim();
        if (!!lat === !!lng) return;
        ctx.addIssue({
            code: 'custom',
            path: [lat ? 'meetingPointLng' : 'meetingPointLat'],
            message: 'A meeting point needs both a latitude and a longitude.',
        });
    });

type LocationValues = {
    departureCity: string;
    meetingPointLat: string;
    meetingPointLng: string;
    pickupModel: 'NONE' | 'INCLUDED' | 'PAID_ADDON';
    pickupRequired: boolean;
};

function toDefaults(trip: TripListItem): LocationValues {
    return {
        departureCity: trip.departureCity ?? '',
        meetingPointLat:
            trip.meetingPointLat != null ? String(trip.meetingPointLat) : '',
        meetingPointLng:
            trip.meetingPointLng != null ? String(trip.meetingPointLng) : '',
        pickupModel: trip.pickupModel,
        pickupRequired: trip.pickupRequired,
    };
}

const PICKUP_MODEL_OPTIONS = [
    { value: 'NONE', label: 'No pickup' },
    { value: 'INCLUDED', label: 'Included in the price' },
    { value: 'PAID_ADDON', label: 'Paid add-on' },
];

const PICKUP_CONSEQUENCE: Record<string, string> = {
    NONE: 'Travellers make their own way to the meeting point.',
    INCLUDED: 'You collect travellers at no extra charge.',
    PAID_ADDON: 'Travellers can add pickup for a per-person fee.',
};

interface StepLocationProps {
    trip: TripListItem;
}

export function StepLocation({ trip }: StepLocationProps) {
    const { mutateAsync: updateTrip, isPending } = useUpdateTrip();
    // Failures render in place, above the step, instead of as a toast.
    const { setStepError } = useWizard();

    // Open every map on the tour's island rather than in the middle of the
    // Atlantic. Cached by the destinations query, so it costs one shared fetch
    // for all three pickers on this step.
    const { data: destination } = useDestination(trip.destinationId);

    // The route overview reads the same query the stop list renders from, so
    // the map can never disagree with the rows beside it. Stops without
    // coordinates are skipped rather than dropped to (0, 0) in the Atlantic.
    const { data: locations } = useLocations(trip.id);

    // Unsaved coordinate edits, keyed by stop id (plus NEW_STOP_KEY for the
    // add form). Typing a latitude moves the marker immediately - waiting for
    // a save to see whether the number was right is the slow way to find out
    // you typed a minus sign wrong.
    const [draftPoints, setDraftPoints] = useState<
        Record<string, { lat: number; lng: number } | null>
    >({});

    const onDraftPoint = useCallback(
        (key: string, point: { lat: number; lng: number } | null) => {
            setDraftPoints(prev =>
                prev[key]?.lat === point?.lat && prev[key]?.lng === point?.lng
                    ? prev
                    : { ...prev, [key]: point },
            );
        },
        [],
    );

    const { mutate: updateLocation } = useUpdateLocation();

    /**
     * Dragging a numbered pin persists that stop straight away.
     *
     * It writes rather than staging a draft because the row's own editor holds
     * its own form state - a drag that only moved the map would leave the two
     * disagreeing, and the next Save in that row would silently put the pin
     * back. Only saved stops are draggable; the pending "New stop" marker has
     * no record to write to.
     */
    const [pendingStopPoint, setPendingStopPoint] = useState<{
        lat: number;
        lng: number;
    } | null>(null);

    const handleStopDrag = useCallback(
        (stop: { id?: string }, next: { lat: number; lng: number }) => {
            if (!stop.id) return;
            // The pending pin has no record yet - push it into the add form
            // rather than PATCHing something that does not exist.
            if (stop.id === NEW_STOP_KEY) {
                setPendingStopPoint(next);
                return;
            }
            updateLocation({
                tripId: trip.id,
                locationId: stop.id,
                payload: { latitude: next.lat, longitude: next.lng },
            });
        },
        [updateLocation, trip.id],
    );

    // Pickup zones carry no map. Their coordinates are read by nothing - the
    // tour page prints the window and directions as text, and the confirmation
    // email's map link is built from the snapshotted address string - so the
    // pin, the drag handler and the two number fields all bought an operator
    // exactly nothing. The zone list stands alone (2026-07-29).

    const stops = useMemo(() => {
        const saved = (locations ?? []).map(l => {
            const draft = draftPoints[l.id];
            const lat = draft ? draft.lat : l.latitude;
            const lng = draft ? draft.lng : l.longitude;
            return {
                id: l.id,
                lat,
                lng,
                label: findEnglish(l.translations)?.title ?? null,
            };
        });
        const list: RoutePoint[] = saved.filter(
            (p): p is {
                id: string;
                lat: number;
                lng: number;
                label: string | null;
            } => p.lat != null && p.lng != null,
        );
        const pending = draftPoints[NEW_STOP_KEY];
        return pending
            ? [...list, { ...pending, id: NEW_STOP_KEY, label: 'New stop' }]
            : list;
    }, [locations, draftPoints]);
    const destinationCenter =
        destination?.latitude != null && destination?.longitude != null
            ? { lat: destination.latitude, lng: destination.longitude }
            : null;

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        control,
        reset,
        formState: { errors, isDirty },
    } = useForm<LocationValues>({
        resolver: zodResolver(
            locationSchema,
        ) as unknown as Resolver<LocationValues>,
        defaultValues: toDefaults(trip),
    });

    // Guarded, not a bare `[trip]` effect: this app refetches on window focus
    // (30s stale) and every sibling save invalidates the trip detail, so an
    // unconditional reset lands on top of whatever the operator is typing AND
    // clears isDirty, leaving the step reporting "clean" over unsaved work.
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
                            // null clears; undefined would be dropped by
                            // JSON.stringify and read as "leave it alone", so
                            // emptying the map pin used to do nothing at all.
                            departureCity: blankToNull(values.departureCity),
                            meetingPointLat: numberOrNull(
                                values.meetingPointLat,
                            ),
                            meetingPointLng: numberOrNull(
                                values.meetingPointLng,
                            ),
                            pickupModel: values.pickupModel,
                            pickupRequired: values.pickupRequired,
                        },
                    });
                    // Pristine at the values just persisted, so the
                    // guarded sync above can take over from here.
                    reset(values);
                    ok = true;
                } catch (err) {
                    setStepError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to save location.',
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

    useStepCommit('location', { submit, isPending, isDirty });

    const hasCoords = !!(v.meetingPointLat && v.meetingPointLng);

    return (
        <>
            <WizardStepHeader step='location' />
            <WizardStepBody>
                <WizardSection
                    id='meeting-point'
                    title='Meeting point'
                    summary={
                        v.departureCity ||
                        (hasCoords ? 'Coordinates set' : undefined)
                    }
                    defaultOpen
                    invalid={
                        !!(
                            errors.departureCity ||
                            errors.meetingPointLat ||
                            errors.meetingPointLng
                        )
                    }>
                    {/* Fields left, map right. Stacked, the map pushed the
                        coordinate inputs a full viewport down from the pin
                        they belong to - you could not see the number change as
                        you dragged. Side by side they move together. */}
                    <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
                      <div className='space-y-6'>
                        <Field>
                            <Label>Departure city</Label>
                            <Input
                                {...register('departureCity')}
                                placeholder='e.g. Willemstad'
                                aria-invalid={!!errors.departureCity}
                            />
                            <FieldDescription>
                                Shown on the tour card so travellers know how
                                far it is from where they are staying.
                            </FieldDescription>
                            <FieldError>
                                {errors.departureCity?.message}
                            </FieldError>
                        </Field>

                        <FieldGrid>
                            <Field>
                                <Label>Latitude</Label>
                                <Input
                                    {...register('meetingPointLat')}
                                    placeholder='12.1091'
                                    aria-invalid={!!errors.meetingPointLat}
                                />
                                <FieldError>
                                    {errors.meetingPointLat?.message}
                                </FieldError>
                            </Field>
                            <Field>
                                <Label>Longitude</Label>
                                <Input
                                    {...register('meetingPointLng')}
                                    placeholder='-68.9316'
                                    aria-invalid={!!errors.meetingPointLng}
                                />
                                <FieldError>
                                    {errors.meetingPointLng?.message}
                                </FieldError>
                            </Field>
                        </FieldGrid>
                      </div>

                      {/* Writes the same two numbers the inputs hold -
                          additive UI, no payload change. */}
                      <MapPickerField
                          lat={v.meetingPointLat}
                          lng={v.meetingPointLng}
                          fallbackCenter={destinationCenter}
                          heightClassName='h-72'
                          onChange={next => {
                              setValue('meetingPointLat', next.lat, {
                                  shouldDirty: true,
                              });
                              setValue('meetingPointLng', next.lng, {
                                  shouldDirty: true,
                              });
                          }}
                      />
                    </div>
                </WizardSection>

                <WizardSection
                    id='itinerary'
                    title='Itinerary'
                    description='The stops on the route, in order.'>
                    <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
                        <TripLocationsTab
                            bare
                            tripId={trip.id}
                            onDraftPoint={onDraftPoint}
                            pendingPoint={pendingStopPoint}
                        />
                        {/* The list gives you order; the map gives you shape.
                            Neither answers "does this route make sense" alone. */}
                        {/* Not sticky. Pinning it 96px below the viewport top
                            meant expanding a stop re-anchored the map mid
                            height-animation, so it appeared to jump away from
                            the row you had just opened. Aligned to the top of
                            its column it never moves relative to the list.
                            `self-start` keeps it from stretching to match the
                            column height. */}
                        <div className='lg:self-start'>
                            <RouteMap
                                stops={stops}
                                onStopDrag={handleStopDrag}
                                fallbackCenter={destinationCenter}
                                heightClassName='h-80'
                            />
                            {stops.length > 0 && (
                                <p className='mt-2 text-xs text-content-muted'>
                                    Drag a numbered pin to move that stop.
                                </p>
                            )}
                            {stops.length === 0 && (
                                <p className='mt-2 text-xs text-content-muted'>
                                    Stops appear here once they have
                                    coordinates.
                                </p>
                            )}
                        </div>
                    </div>
                </WizardSection>

                <WizardSection
                    id='pickup'
                    title='Pickup'
                    summary={
                        PICKUP_MODEL_OPTIONS.find(
                            o => o.value === v.pickupModel,
                        )?.label
                    }
                    invalid={!!errors.pickupModel}>
                    <div className='space-y-6'>
                        <SelectField
                            control={control}
                            name='pickupModel'
                            label='Pickup model'
                            options={PICKUP_MODEL_OPTIONS}
                            error={errors.pickupModel?.message}
                            description={PICKUP_CONSEQUENCE[v.pickupModel]}
                        />

                        {/* The pickup point list is meaningless without a
                            pickup model, so it appears with one instead of
                            sitting there dead. Same rule the old editor used
                            to hide the whole Pickups tab. */}
                        {v.pickupModel !== 'NONE' && (
                            <div className='space-y-6'>
                                <ToggleRow
                                    id='pickupRequired'
                                    label='Pickup is required'
                                    description='Travellers must choose a pickup point - they cannot meet you directly.'
                                    checked={v.pickupRequired}
                                    onChange={c =>
                                        setValue('pickupRequired', c, {
                                            shouldDirty: true,
                                        })
                                    }
                                />
                                <TripPickupLocationsTab
                                    bare
                                    tripId={trip.id}
                                    pickupModel={v.pickupModel}
                                    currency={trip.defaultCurrency}
                                />
                            </div>
                        )}
                    </div>
                </WizardSection>
            </WizardStepBody>
        </>
    );
}
