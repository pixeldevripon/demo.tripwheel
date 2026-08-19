'use client';

/**
 * Step 8 - Discovery and reach (07 §3).
 *
 * Nothing here blocks publishing, but the step is NOT skippable: every tour
 * runs on a commission tier whether the operator looks at it or not, and the
 * tier decides ranking, commission and deposit percentage. Shipping a tour
 * without the operator ever seeing which terms it runs on is the one thing
 * this step exists to prevent.
 *
 * Also the new home for `hubIds`, which left the old 40-field Details form in
 * the task 3 split. Hubs are discovery tags with no URL effect, so they belong
 * with the other "how do travellers find this" controls rather than with the
 * booking rules.
 *
 * ONE trip-core PATCH, and one footer button. `hubIds` and `ogImage` ride the
 * same body: two writers spreading `tripToUpdatePayload` would race, because
 * that body is the full ~38-key rebuild and whichever landed second would put
 * the other's field back to its mount-time value (07 §10b item 2).
 *
 * The meta pair is a separate record - the tour TRANSLATION for this locale -
 * so it stays a separate writer, but it registers with the footer instead of
 * drawing its own button. Its payload is disjoint from the description step's
 * (`buildTourCopyPayload` filters metaTitle/metaDescription out), so the two
 * translation writers never touch the same keys.
 *
 * Tier and spotlight keep their own buttons on purpose: a tier change locks
 * for 30 days and a spotlight request goes to an admin queue. Neither is
 * something to fire as a side effect of pressing Continue.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import { useSyncFormWhenPristine } from '@/hooks/use-sync-form-when-pristine';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { ImageSelectorField } from '@/components/common/image-selector-field';
import { Field, FieldDescription } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { useRole } from '@/contexts/role-context';
import { useActiveHubs } from '@/hooks/hubs/use-hubs';
import { useUpdateTrip } from '@/hooks/trips/use-trips';
import { tripToUpdatePayload } from '@/lib/trips/update-payload';
import { tierMeta } from '@/types/tier';
import type { TripListItem } from '@/types/trip';
import { TripAttributesTab } from '../../trip-attributes-tab';
import {
    DemandBadgeCard,
    SHOW_DEMAND_BADGE_OVERRIDE,
    SpotlightCard,
    TierCard,
} from '../../trip-promotion-tab';
import { SeoListingSection } from '../../trip-seo-tab';
import { useStepCommit } from '../use-step-commit';
import { useWizard } from '../wizard-context';
import { WizardSection } from '../wizard-section';
import {
    focusFirstInvalid,
    WizardStepBody,
    WizardStepHeader,
} from '../wizard-step';

const reachSchema = z.object({
    hubIds: z.array(z.string()),
    ogImage: z.string().optional().or(z.literal('')),
});

type ReachValues = { hubIds: string[]; ogImage: string };

interface StepReachProps {
    trip: TripListItem;
}

export function StepReach({ trip }: StepReachProps) {
    const { can } = useRole();
    const canEdit = can('EDIT_TRIP');
    const { mutateAsync: updateTrip, isPending } = useUpdateTrip();
    // Failures render in place, above the step, instead of as a toast.
    const { setStepError } = useWizard();
    const { data: hubs } = useActiveHubs(trip.destinationId || undefined);

    const {
        control,
        handleSubmit,
        watch,
        reset,
        formState: { isDirty },
    } = useForm<ReachValues>({
        // Same cast the other steps use: the schema's optional-string output
        // and the form's always-string value are the same thing at runtime.
        resolver: zodResolver(reachSchema) as unknown as Resolver<ReachValues>,
        defaultValues: { hubIds: trip.hubIds, ogImage: trip.ogImage ?? '' },
    });

    useSyncFormWhenPristine(
        reset,
        isDirty,
        () => ({ hubIds: trip.hubIds, ogImage: trip.ogImage ?? '' }),
        trip,
    );

    const hubIds = watch('hubIds');

    const submit = useCallback(async () => {
        let ok = false;
        await handleSubmit(
            async values => {
                try {
                    await updateTrip({
                        id: trip.id,
                        // `ogImage` rides this PATCH rather than firing its
                        // own. Two trip-core writers on one step would race:
                        // this body is the FULL ~38-key rebuild, so whichever
                        // ran second would put the other's field back to the
                        // value it read at mount (07 §10b item 2).
                        payload: {
                            ...tripToUpdatePayload(trip),
                            hubIds: values.hubIds,
                            ogImage: values.ogImage || null,
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
                        err instanceof Error ? err.message : 'Failed to save.',
                    );
                    ok = false;
                }
            },
            // `reachSchema` cannot currently fail - `hubIds` is an unconstrained
            // array - so this branch is unreachable today. It is here because
            // the step without it was one `.min(1)` away from the bug the
            // content step actually shipped: a form that refuses to advance and
            // never says why. Every other step has this branch.
            () => {
                focusFirstInvalid();
                ok = false;
            },
        )();
        return ok;
    }, [handleSubmit, updateTrip, trip, setStepError, reset]);

    useStepCommit('reach', { submit, isPending, isDirty });

    const tier = tierMeta(trip.tierKey);

    return (
        <>
            <WizardStepHeader step='reach' />
            <WizardStepBody>
                {/* Commercial terms lead. This step exists to stop a tour
                    shipping without its operator ever seeing which terms it
                    runs on - and it was fifth, below two sections most
                    operators never open. */}
                <WizardSection
                    id='tier'
                    title='Commercial terms'
                    description='What you pay, where you rank, and what travellers pay up front.'
                    summary={`${tier.label} · ${trip.commissionTier}%`}
                    defaultOpen>
                    <TierCard bare trip={trip} canEdit={canEdit} />
                </WizardSection>

                <WizardSection
                    id='spotlight'
                    title='Destination spotlight'
                    description='A featured block on the destination page. Earned, not bought.'
                    summary='Optional'>
                    <SpotlightCard bare trip={trip} canEdit={canEdit} />
                </WizardSection>

                <WizardSection
                    id='hubs'
                    title='Activity hubs'
                    description='Optional. A hub must allow one of this tour’s categories.'
                    summary={
                        hubIds.length
                            ? `${hubIds.length} hub${hubIds.length === 1 ? '' : 's'}`
                            : 'None'
                    }>
                    <Field>
                        <Label>Hubs</Label>
                        <Controller
                            name='hubIds'
                            control={control}
                            render={({ field }) => (
                                <MultiSelect
                                    options={(hubs ?? []).map(h => ({
                                        value: h.id,
                                        label: h.name,
                                    }))}
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder='Select hubs…'
                                    searchPlaceholder='Search hubs…'
                                />
                            )}
                        />
                        <FieldDescription>
                            Hubs group tours by place or theme on the
                            destination page. They do not change this
                            tour&apos;s URL.
                        </FieldDescription>
                    </Field>
                </WizardSection>

                <WizardSection
                    id='attributes'
                    title='Filterable properties'
                    description='Category-specific details that power the public filters.'
                    summary='Optional'>
                    <TripAttributesTab bare trip={trip} />
                </WizardSection>

                {/* One section, not two. Both answer the same question - what
                    this tour looks like when it is NOT on the tour page - and
                    splitting them meant an operator set the search snippet,
                    saved, then found a second panel for the share image with
                    its own separate save. */}
                <WizardSection
                    id='seo'
                    title='Search and social appearance'
                    description='How this tour looks in a search result and when someone shares the link.'
                    summary={
                        watch('ogImage')
                            ? 'Snippet and share image'
                            : 'Snippet only'
                    }>
                    <div className='space-y-8'>
                        <SeoListingSection trip={trip} step='reach' />
                        <div className='border-t border-line pt-6'>
                            <Field>
                                <Label>Share image</Label>
                                <Controller
                                    name='ogImage'
                                    control={control}
                                    render={({ field }) => (
                                        <ImageSelectorField
                                            value={field.value || null}
                                            onChange={url =>
                                                field.onChange(url ?? '')
                                            }
                                        />
                                    )}
                                />
                                <FieldDescription>
                                    Shown when the link is posted to social
                                    media. Falls back to the cover photo when
                                    empty.
                                </FieldDescription>
                            </Field>
                        </div>
                    </div>
                </WizardSection>

                {/* Parked editorial control - off by default, admin only. */}
                {SHOW_DEMAND_BADGE_OVERRIDE && can('MANAGE_TRIPS') && (
                    <WizardSection
                        id='demand-badge'
                        title='Demand badge override'
                        description='Force the "Likely to sell out" badge on or off, or defer to the nightly computed signal.'>
                        <DemandBadgeCard trip={trip} />
                    </WizardSection>
                )}
            </WizardStepBody>
        </>
    );
}
