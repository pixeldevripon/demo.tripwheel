'use client';

/**
 * The third slice of the old Details form (07 §3, step 7 advanced).
 *
 * Everything a working tour never needs an operator to touch: the heading and
 * breadcrumb overrides, and their own product code. In the old editor all of
 * this sat in the first screen a new operator ever saw, above the fold,
 * competing with the fields that actually decide whether a tour can go live.
 *
 * **The bare "Active" switch is gone** (2026-08-03). It PATCHed `isActive`
 * straight onto the tour - the exact bypass the backend closed in the
 * 2026-08-02 audit, because it left the tour out of the listings while
 * `slug_registry` still advertised its slug. Visibility now has verbs that
 * move both together, and the wizard already offers the one an operator
 * wants: Pause, on the Review step (and in the trips-table row actions).
 *
 * **The OCTO and delivery block is gone** (2026-07-29). It asked seven
 * questions - availability type, redemption method, instant delivery,
 * availability required, allow freesale, delivery formats, delivery methods -
 * whose only reader anywhere in the platform is `octo-tour.serializer.ts`, and
 * OCTO is still pipeline. Every one already carries a Prisma default that IS
 * the answer the form was collecting (`START_TIME`, `DIGITAL`, `true`, `true`,
 * `false`, `[PDF_URL, QRCODE]`, `[VOUCHER]`), so the block existed to let an
 * operator retype the defaults, in vocabulary - "PKPASS URL", "Code 128",
 * "freesale" - that means nothing to someone selling boat trips.
 *
 * The columns stay and the form simply omits the keys: the update path guards
 * each with `dto.x !== undefined`, so stored values survive untouched and a
 * new tour gets the schema default. Nothing to migrate, and restoring the
 * block when OCTO goes live is a UI change only.
 *
 * The two read-only echoes went with it - time zone (derived from the
 * destination) and start times (declared on the Schedule step). A disabled
 * input that restates a value owned by another screen is not information, it
 * is furniture.
 *
 * It keeps the collapsed-by-default treatment the OCTO block had, and it
 * registers the host step's footer commit - so a step that otherwise saves
 * through child mutations still has something for Continue to do.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import { useSyncFormWhenPristine } from '@/hooks/use-sync-form-when-pristine';
import { useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';

import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateTrip } from '@/hooks/trips/use-trips';
import { tripToUpdatePayload } from '@/lib/trips/update-payload';
import type { WizardStepId } from '@/lib/trips/wizard-steps';
import type { TripListItem } from '@/types/trip';
import { useStepCommit } from './use-step-commit';
import { useWizard } from './wizard-context';
import { FieldGrid } from './wizard-fields';
import { WizardSection } from './wizard-section';
import { focusFirstInvalid } from './wizard-step';

const advancedSchema = z.object({
    h1Override: z.string().max(200).optional().or(z.literal('')),
    breadcrumbLabel: z.string().max(60).optional().or(z.literal('')),
    reference: z.string().max(120).optional().or(z.literal('')),
});

type AdvancedValues = {
    h1Override: string;
    breadcrumbLabel: string;
    reference: string;
};

function toDefaults(trip: TripListItem): AdvancedValues {
    return {
        h1Override: trip.h1Override ?? '',
        breadcrumbLabel: trip.breadcrumbLabel ?? '',
        reference: trip.reference ?? '',
    };
}

interface TripAdvancedSectionProps {
    trip: TripListItem;
    /** The step hosting this card - it registers that step's footer commit. */
    step: WizardStepId;
}

export function TripAdvancedSection({ trip, step }: TripAdvancedSectionProps) {
    const { mutateAsync: updateTrip, isPending } = useUpdateTrip();
    // Failures render in place, above the step, instead of as a toast.
    const { setStepError } = useWizard();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty },
    } = useForm<AdvancedValues>({
        resolver: zodResolver(
            advancedSchema
        ) as unknown as Resolver<AdvancedValues>,
        defaultValues: toDefaults(trip),
    });

    useSyncFormWhenPristine(reset, isDirty, () => toDefaults(trip), trip);

    const submit = useCallback(async () => {
        let ok = false;
        await handleSubmit(
            async values => {
                try {
                    await updateTrip({
                        id: trip.id,
                        payload: {
                            ...tripToUpdatePayload(trip),
                            // Nullable strings clear when emptied - the old
                            // form's `value || null`, preserved.
                            h1Override: values.h1Override || null,
                            breadcrumbLabel: values.breadcrumbLabel || null,
                            reference: values.reference || null,
                        },
                    });
                    ok = true;
                } catch (err) {
                    setStepError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to save advanced settings.'
                    );
                    ok = false;
                }
            },
            () => {
                focusFirstInvalid();
                ok = false;
            }
        )();
        return ok;
    }, [handleSubmit, updateTrip, trip, setStepError]);

    useStepCommit(step, { submit, isPending, isDirty });

    const hasError = Object.keys(errors).length > 0;

    return (
        <WizardSection
            id='advanced'
            title='Advanced and integrations'
            description='Heading overrides and your own product code. Safe to ignore.'
            // "Optional" rather than nothing: a blank chip on one row in a
            // column of counts reads as missing data, not as "there is nothing
            // to do here".
            summary='Optional'
            // Its own description says "safe to ignore" - so it should not
            // carry the same weight as the sections that are not.
            muted
            invalid={hasError}>
            <div className='space-y-8'>
                <div className='space-y-6'>
                    <Field>
                        <Label>
                            H1 override{' '}
                            <span className='font-light normal-case text-content-muted'>
                                (English only)
                            </span>
                        </Label>
                        <Input
                            {...register('h1Override')}
                            placeholder='e.g. Mambo Beach Snorkel Tour'
                            aria-invalid={!!errors.h1Override}
                        />
                        <FieldDescription>
                            Use when the auto-generated heading reads awkwardly.
                            Translated pages are unaffected - those use the
                            display title from the translation console.
                        </FieldDescription>
                        <FieldError>{errors.h1Override?.message}</FieldError>
                    </Field>

                    <FieldGrid>
                        <Field>
                            <Label>Breadcrumb label</Label>
                            <Input
                                {...register('breadcrumbLabel')}
                                placeholder='Custom breadcrumb text'
                                aria-invalid={!!errors.breadcrumbLabel}
                            />
                            <FieldDescription>
                                Short label used in breadcrumb navigation.
                            </FieldDescription>
                            <FieldError>
                                {errors.breadcrumbLabel?.message}
                            </FieldError>
                        </Field>
                        <Field>
                            <Label>External reference</Label>
                            <Input
                                {...register('reference')}
                                placeholder='Your own product code / OCTO id'
                                aria-invalid={!!errors.reference}
                            />
                            <FieldDescription>
                                Your external system&apos;s identifier for this
                                product.
                            </FieldDescription>
                            <FieldError>{errors.reference?.message}</FieldError>
                        </Field>
                    </FieldGrid>

                </div>
            </div>
        </WizardSection>
    );
}
