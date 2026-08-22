'use client';

/**
 * Step 3 - Capacity and booking rules (07 §3).
 *
 * Deliberately asked BEFORE the schedule step (07 §2.2 a). `maxPartySize` is
 * the default seat count every departure falls back on, and it is REQUIRED - a
 * schedule with no capacity override of its own takes this number, so every
 * schedule an operator adds afterwards sells without further thought.
 *
 * It used to be nullable, and null meant the availability engine materialised
 * nothing and the tour silently never listed. That was reported by a readiness
 * check ("Capacity set (max party size or per-schedule override)") which could
 * pass for two different reasons and pointed at two different steps - the most
 * confusing line on the review screen. The column is NOT NULL as of
 * `20260729190000_max_party_size_required`, so the failure mode and the check
 * are both gone.
 *
 * Fields, schema rules and payload coercions are lifted from
 * `TripDetailsTab`; the body is rebuilt through `tripToUpdatePayload` so the
 * PATCH is byte-identical to the one the single 40-field form used to send.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { RichTextEditor } from '@/components/pages/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRole } from '@/contexts/role-context';
import { useUpdateTrip } from '@/hooks/trips/use-trips';
import {
    numberOrNull,
    tripToUpdatePayload,
} from '@/lib/trips/update-payload';
import type { TripListItem } from '@/types/trip';
import { useSyncFormWhenPristine } from '@/hooks/use-sync-form-when-pristine';
import { useStepCommit } from '../use-step-commit';
import { useWizard } from '../wizard-context';
import {
    ConsequenceText,
    FieldGrid,
    formatMinutes,
    SelectField,
    ToggleGrid,
    ToggleRow,
} from '../wizard-fields';
import { WizardSection } from '../wizard-section';
import {
    focusFirstInvalid,
    WizardStepBody,
    WizardStepHeader,
} from '../wizard-step';

const rulesSchema = z
    .object({
    minPartySize: z.coerce.number().int().min(1),
    // REQUIRED. It is the default capacity every departure falls back on, so a
    // tour without one used to materialise nothing and never list - reported
    // only by a readiness check that could pass two different ways. NOT NULL in
    // the database since 20260729190000.
    maxPartySize: z.coerce
        .number({ message: 'Set a maximum number of guests' })
        .int()
        .min(1, 'At least 1 guest'),
    bookingType: z.enum(['PRIVATE', 'SHARED']).optional().or(z.literal('')),
    bookingCutoffMinutes: z.coerce.number().int().min(0).max(10080),
    checkInMinutesBefore: z.coerce
        .number()
        .int()
        .min(0)
        .max(240)
        .optional()
        .or(z.literal('')),
    cancellationHours: z.enum(['24', '48', '72', '168']),
    paymentModel: z.enum([
        'OPERATOR_LINK',
        'ON_ARRIVAL',
        'PAID_IN_FULL',
        'OPERATOR_FULL',
    ]),
    onArrivalPayment: z.enum(['CARD_OR_CASH', 'CASH_ONLY']),
    minAgeYears: z.coerce
        .number()
        .int()
        .min(0)
        .max(120)
        .optional()
        .or(z.literal('')),
    fitnessLevel: z
        .enum(['EASY', 'MODERATE', 'CHALLENGING'])
        .optional()
        .or(z.literal('')),
    weatherDependent: z.boolean(),
    wheelchairAccessible: z.boolean(),
    familyFriendly: z.boolean(),
    suitableForBeginners: z.boolean(),
    // Operator-conditions gate (Pastel #80 / MCK-20). 'NONE' is a real
    // option, not a placeholder - clearing the gate is a choice.
    operatorTermsKind: z.enum(['NONE', 'DOCUMENT', 'ACKNOWLEDGMENT']),
    acknowledgmentItems: z.array(z.string()),
    // TipTap HTML from the shared rich-text editor (the pages one, reused).
    operatorTermsDocument: z.string(),
    })
    // "minimum 8, maximum 2" saved cleanly before this - each field was valid
    // on its own and nothing compared them, on either side of the wire. The
    // capacity summary would then read "8 to 2 guests" and the departure
    // materializer would have a party range it can never satisfy.
    .superRefine((v, ctx) => {
        const min = typeof v.minPartySize === 'number' ? v.minPartySize : null;
        const max = typeof v.maxPartySize === 'number' ? v.maxPartySize : null;
        if (min != null && max != null && max < min) {
            ctx.addIssue({
                code: 'custom',
                path: ['maxPartySize'],
                message: 'Maximum party size cannot be below the minimum.',
            });
        }
        // The confirm-list IS the legal object of the acknowledgment gate -
        // 2 to 6 non-blank first-person facts, same bounds the backend
        // enforces (Pastel #80).
        if (v.operatorTermsKind === 'ACKNOWLEDGMENT') {
            const facts = v.acknowledgmentItems
                .map(s => s.trim())
                .filter(Boolean);
            if (facts.length < 2 || facts.length > 6) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['acknowledgmentItems'],
                    message: 'Add 2 to 6 facts travellers must confirm.',
                });
            }
        }
        // The document IS the legal object of the document gate: an empty
        // editor (a lone <p></p>) is not a document.
        if (
            v.operatorTermsKind === 'DOCUMENT' &&
            v.operatorTermsDocument.replace(/<[^>]*>/g, '').trim().length === 0
        ) {
            ctx.addIssue({
                code: 'custom',
                path: ['operatorTermsDocument'],
                message: 'Write the conditions travellers agree to.',
            });
        }
    });

type RulesValues = {
    minPartySize: string;
    maxPartySize: string;
    bookingType: '' | 'PRIVATE' | 'SHARED';
    bookingCutoffMinutes: string;
    checkInMinutesBefore: string;
    cancellationHours: '24' | '48' | '72' | '168';
    paymentModel:
        | 'OPERATOR_LINK'
        | 'ON_ARRIVAL'
        | 'PAID_IN_FULL'
        | 'OPERATOR_FULL';
    onArrivalPayment: 'CARD_OR_CASH' | 'CASH_ONLY';
    minAgeYears: string;
    fitnessLevel: '' | 'EASY' | 'MODERATE' | 'CHALLENGING';
    weatherDependent: boolean;
    wheelchairAccessible: boolean;
    familyFriendly: boolean;
    suitableForBeginners: boolean;
    operatorTermsKind: 'NONE' | 'DOCUMENT' | 'ACKNOWLEDGMENT';
    acknowledgmentItems: string[];
    operatorTermsDocument: string;
};

const CANCELLATION_VALUES = ['24', '48', '72', '168'] as const;
function toCancellationValue(h: number): RulesValues['cancellationHours'] {
    return (CANCELLATION_VALUES as readonly string[]).includes(String(h))
        ? (String(h) as RulesValues['cancellationHours'])
        : '48';
}

function toDefaults(trip: TripListItem): RulesValues {
    return {
        minPartySize: String(trip.minPartySize),
        // NOT NULL since 20260729190000 - a draft created from the four basics
        // fields carries the schema default (10) until this step is saved.
        maxPartySize: String(trip.maxPartySize),
        bookingType: trip.bookingType ?? '',
        bookingCutoffMinutes: String(trip.bookingCutoffMinutes),
        checkInMinutesBefore:
            trip.checkInMinutesBefore != null
                ? String(trip.checkInMinutesBefore)
                : '',
        cancellationHours: toCancellationValue(trip.cancellationHours),
        paymentModel: trip.paymentModel,
        onArrivalPayment: trip.onArrivalPayment ?? 'CARD_OR_CASH',
        minAgeYears: trip.minAgeYears != null ? String(trip.minAgeYears) : '',
        fitnessLevel: trip.fitnessLevel ?? '',
        weatherDependent: trip.weatherDependent,
        wheelchairAccessible: trip.wheelchairAccessible,
        familyFriendly: trip.familyFriendly,
        suitableForBeginners: trip.suitableForBeginners,
        // On a gated LIVE tour the read is already overlaid with any STAGED
        // change, so the form edits what the operator proposed.
        operatorTermsKind: trip.operatorTermsKind ?? 'NONE',
        acknowledgmentItems: trip.acknowledgmentItems?.en ?? [],
        operatorTermsDocument: trip.operatorTermsDocument?.en ?? '',
    };
}

const PAYMENT_OPTIONS = [
    { value: 'OPERATOR_LINK', label: 'Operator link (deposit)' },
    { value: 'ON_ARRIVAL', label: 'Pay on arrival' },
    { value: 'PAID_IN_FULL', label: 'Paid in full' },
    // The fourth model, listed but not selectable. The platform takes nothing at
    // booking, so the backend refuses to reserve or quote one of these tours -
    // OPERATOR_FULL was dropped for v1 (founder, 2026-07-15) because it would
    // create a confirmed but unpaid booking. Picking it here would publish a tour
    // that 422s every traveller at checkout. It stays in the list so the model set
    // reads as complete rather than as three-of-four, and so a tour already on
    // OPERATOR_FULL still renders its own label instead of a blank select.
    {
        value: 'OPERATOR_FULL',
        label: 'No platform payment (not yet available)',
        disabled: true,
    },
];

const PAYMENT_CONSEQUENCE: Record<string, string> = {
    OPERATOR_LINK:
        'The traveller pays a deposit now; you collect the balance yourself.',
    // Island Tours captures the deposit at booking and the operator settles the
    // rest on site - this is a deposit model, same as OPERATOR_LINK, differing
    // only in where the balance is collected. The old copy said the traveller
    // paid in full on arrival, which contradicted both the commercial model and
    // the "what you accept on site" field right below it.
    ON_ARRIVAL:
        'The traveller pays a deposit to Island Tours now and settles the balance with you on arrival.',
    PAID_IN_FULL: 'The traveller pays the whole price at checkout.',
    OPERATOR_FULL:
        'You take payment entirely outside the platform. Not available yet - Island Tours cannot take bookings for a tour on this model, so switch to one of the others to sell it.',
};

const CANCELLATION_OPTIONS = [
    { value: '24', label: '24 hours' },
    { value: '48', label: '48 hours' },
    { value: '72', label: '72 hours' },
    { value: '168', label: '7 days' },
];

const FITNESS_OPTIONS = [
    { value: 'EASY', label: 'Easy' },
    { value: 'MODERATE', label: 'Moderate' },
    { value: 'CHALLENGING', label: 'Challenging' },
];

const BOOKING_TYPE_OPTIONS = [
    { value: 'PRIVATE', label: 'Private' },
    { value: 'SHARED', label: 'Shared' },
];

interface StepRulesProps {
    trip: TripListItem;
}

export function StepRules({ trip }: StepRulesProps) {
    const { mutateAsync: updateTrip, isPending } = useUpdateTrip();
    // Failures render in place, above the step, instead of as a toast.
    const { setStepError } = useWizard();
    const { role } = useRole();

    // Booking deadlines derive from the cancellation window at read time, so
    // changing it on a published tour would move EXISTING bookings' free
    // cancellation deadlines. The backend rejects it for non-admins once the
    // tour leaves DRAFT.
    const cancellationLocked = trip.status !== 'DRAFT' && role !== 'ADMIN';

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        control,
        reset,
        formState: { errors, isDirty },
    } = useForm<RulesValues>({
        resolver: zodResolver(rulesSchema) as unknown as Resolver<RulesValues>,
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
                            minPartySize: Number(values.minPartySize),
                            maxPartySize: Number(values.maxPartySize),
                            // `|| null`, never `|| undefined`: an undefined key
                            // is dropped in transit and read as "leave it
                            // alone", so unsetting any of these four silently
                            // did nothing.
                            bookingType: values.bookingType || null,
                            bookingCutoffMinutes: Number(
                                values.bookingCutoffMinutes,
                            ),
                            checkInMinutesBefore: numberOrNull(
                                values.checkInMinutesBefore,
                            ),
                            cancellationHours: Number(values.cancellationHours),
                            paymentModel: values.paymentModel,
                            onArrivalPayment: values.onArrivalPayment,
                            minAgeYears: numberOrNull(values.minAgeYears),
                            fitnessLevel: values.fitnessLevel || null,
                            weatherDependent: values.weatherDependent,
                            wheelchairAccessible: values.wheelchairAccessible,
                            familyFriendly: values.familyFriendly,
                            suitableForBeginners: values.suitableForBeginners,
                            // Kind + facts travel as ONE unit (Pastel #80);
                            // null clears the gate. On a LIVE tour the
                            // backend HOLDS the change for review.
                            operatorTermsKind:
                                values.operatorTermsKind === 'NONE'
                                    ? null
                                    : values.operatorTermsKind,
                            ...(values.operatorTermsKind === 'ACKNOWLEDGMENT'
                                ? {
                                      acknowledgmentItems:
                                          values.acknowledgmentItems
                                              .map(s => s.trim())
                                              .filter(Boolean),
                                  }
                                : {}),
                            ...(values.operatorTermsKind === 'DOCUMENT'
                                ? {
                                      operatorTermsDocument:
                                          values.operatorTermsDocument,
                                  }
                                : {}),
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
                            : 'Failed to save booking rules.',
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

    useStepCommit('rules', { submit, isPending, isDirty });

    // Only empty while the operator has the field cleared mid-edit. "1+ guests"
    // used to fill that gap, which reads as "no ceiling" - the exact thing the
    // required maximum exists to rule out.
    const capacitySummary = v.maxPartySize
        ? `${v.minPartySize || 1} to ${v.maxPartySize} guests`
        : 'Not set';

    return (
        <>
            <WizardStepHeader step='rules' />
            <WizardStepBody>
                <WizardSection
                    id='group-size'
                    title='Group size'
                    summary={capacitySummary}
                    defaultOpen
                    invalid={!!(errors.minPartySize || errors.maxPartySize)}>
                    <div className='space-y-6'>
                        <FieldGrid>
                            <Field>
                                <Label>Minimum guests</Label>
                                <Input
                                    {...register('minPartySize')}
                                    type='number'
                                    min={1}
                                    aria-invalid={!!errors.minPartySize}
                                />
                                <FieldDescription>
                                    The smallest booking you will accept.
                                </FieldDescription>
                                <FieldError>
                                    {errors.minPartySize?.message}
                                </FieldError>
                            </Field>
                            <Field>
                                <Label>
                                    Maximum guests{' '}
                                    <span aria-hidden className='text-danger-fg'>
                                        *
                                    </span>
                                </Label>
                                <Input
                                    {...register('maxPartySize')}
                                    type='number'
                                    min={1}
                                    placeholder='e.g. 20'
                                    aria-invalid={!!errors.maxPartySize}
                                />
                                <ConsequenceText>
                                    {v.maxPartySize
                                        ? `Every departure opens with ${v.maxPartySize} seats unless a schedule overrides it.`
                                        : 'Sets the seats on every departure, so each schedule you add sells without needing its own capacity.'}
                                </ConsequenceText>
                                <FieldError>
                                    {errors.maxPartySize?.message}
                                </FieldError>
                            </Field>
                        </FieldGrid>

                        <SelectField
                            control={control}
                            name='bookingType'
                            label='Booking type'
                            placeholder='Select...'
                            options={BOOKING_TYPE_OPTIONS}
                            error={errors.bookingType?.message}
                            description={
                                v.bookingType === 'PRIVATE'
                                    ? 'One booking takes the whole departure.'
                                    : v.bookingType === 'SHARED'
                                      ? 'Travellers from different bookings share the departure.'
                                      : undefined
                            }
                        />

                        {/* The "Instant confirmation" toggle is removed on
                            purpose (client review comment 22): every consumer
                            surface promises instant confirmation and no
                            request-to-book flow exists behind an off state.
                            The backend rejects the key. Do not re-add. */}
                    </div>
                </WizardSection>

                <WizardSection
                    id='booking-window'
                    title='Booking window and cancellation'
                    summary={
                        formatMinutes(v.bookingCutoffMinutes)
                            ? `Closes ${formatMinutes(v.bookingCutoffMinutes)} before`
                            : undefined
                    }
                    invalid={
                        !!(
                            errors.bookingCutoffMinutes ||
                            errors.checkInMinutesBefore ||
                            errors.cancellationHours
                        )
                    }>
                    <div className='space-y-6'>
                        <FieldGrid>
                            <Field>
                                <Label>Booking cutoff (minutes)</Label>
                                <Input
                                    {...register('bookingCutoffMinutes')}
                                    type='number'
                                    min={0}
                                    aria-invalid={!!errors.bookingCutoffMinutes}
                                />
                                <ConsequenceText>
                                    {formatMinutes(v.bookingCutoffMinutes)
                                        ? `Bookings close ${formatMinutes(v.bookingCutoffMinutes)} before each departure.`
                                        : 'Bookings stay open right up to departure.'}
                                </ConsequenceText>
                                <FieldError>
                                    {errors.bookingCutoffMinutes?.message}
                                </FieldError>
                            </Field>
                            <Field>
                                <Label>Check in before (minutes)</Label>
                                <Input
                                    {...register('checkInMinutesBefore')}
                                    type='number'
                                    min={0}
                                    max={240}
                                    placeholder='e.g. 30'
                                    aria-invalid={!!errors.checkInMinutesBefore}
                                />
                                <ConsequenceText>
                                    {formatMinutes(v.checkInMinutesBefore)
                                        ? `Travellers are told to arrive ${formatMinutes(v.checkInMinutesBefore)} early.`
                                        : ''}
                                </ConsequenceText>
                                <FieldError>
                                    {errors.checkInMinutesBefore?.message}
                                </FieldError>
                            </Field>
                        </FieldGrid>

                        <SelectField
                            control={control}
                            name='cancellationHours'
                            label='Free cancellation window'
                            options={CANCELLATION_OPTIONS}
                            disabled={cancellationLocked}
                            error={errors.cancellationHours?.message}
                            description={
                                cancellationLocked
                                    ? 'Locked after publishing - changing it would move the free-cancellation deadline on existing bookings. Contact Island Tours to change it.'
                                    : 'Every published tour carries a free-cancellation window.'
                            }
                        />
                    </div>
                </WizardSection>

                <WizardSection
                    id='payment'
                    title='Payment'
                    summary={
                        PAYMENT_OPTIONS.find(o => o.value === v.paymentModel)
                            ?.label
                    }
                    invalid={
                        !!(errors.paymentModel || errors.onArrivalPayment)
                    }>
                    <div className='space-y-6'>
                        <SelectField
                            control={control}
                            name='paymentModel'
                            label='Payment model'
                            options={PAYMENT_OPTIONS}
                            error={errors.paymentModel?.message}
                            description={
                                PAYMENT_CONSEQUENCE[v.paymentModel] ?? undefined
                            }
                        />

                        {/* Only ON_ARRIVAL tours collect on site, so this is
                            meaningless on any other model. Each booking
                            snapshots it at reserve, so editing it never
                            rewrites what an existing traveller was told. */}
                        {v.paymentModel === 'ON_ARRIVAL' && (
                            <SelectField
                                control={control}
                                name='onArrivalPayment'
                                label='What you accept on site'
                                options={[
                                    {
                                        value: 'CARD_OR_CASH',
                                        label: 'Card or cash',
                                    },
                                    { value: 'CASH_ONLY', label: 'Cash only' },
                                ]}
                                error={errors.onArrivalPayment?.message}
                                description={
                                    v.onArrivalPayment === 'CASH_ONLY'
                                        ? 'Travellers are told to bring the balance in cash, since there is no card machine or ATM on site.'
                                        : 'Travellers can settle the balance either way.'
                                }
                            />
                        )}
                    </div>
                </WizardSection>

                <WizardSection
                    id='audience'
                    title='Who this tour suits'
                    description='Powers the public filters.'
                    summary={
                        v.minAgeYears ? `Ages ${v.minAgeYears}+` : 'All ages'
                    }
                    invalid={!!(errors.minAgeYears || errors.fitnessLevel)}>
                    <div className='space-y-6'>
                        <FieldGrid>
                            <Field>
                                <Label>Minimum age</Label>
                                <Input
                                    {...register('minAgeYears')}
                                    type='number'
                                    min={0}
                                    placeholder='No minimum'
                                    aria-invalid={!!errors.minAgeYears}
                                />
                                <FieldError>
                                    {errors.minAgeYears?.message}
                                </FieldError>
                            </Field>
                            <SelectField
                                control={control}
                                name='fitnessLevel'
                                label='Fitness level'
                                placeholder='Select...'
                                options={FITNESS_OPTIONS}
                                error={errors.fitnessLevel?.message}
                            />
                        </FieldGrid>

                        <ToggleGrid>
                            <ToggleRow
                                id='weatherDependent'
                                label='Weather dependent'
                                description='May be cancelled or moved if conditions turn.'
                                checked={v.weatherDependent}
                                onChange={c =>
                                    setValue('weatherDependent', c, {
                                        shouldDirty: true,
                                    })
                                }
                            />
                            <ToggleRow
                                id='wheelchairAccessible'
                                label='Wheelchair accessible'
                                description='The whole route works for wheelchair users.'
                                checked={v.wheelchairAccessible}
                                onChange={c =>
                                    setValue('wheelchairAccessible', c, {
                                        shouldDirty: true,
                                    })
                                }
                            />
                            <ToggleRow
                                id='familyFriendly'
                                label='Family friendly'
                                description='Suitable for children travelling with adults.'
                                checked={v.familyFriendly}
                                onChange={c =>
                                    setValue('familyFriendly', c, {
                                        shouldDirty: true,
                                    })
                                }
                            />
                            <ToggleRow
                                id='suitableForBeginners'
                                label='Suitable for beginners'
                                description='No prior experience needed.'
                                checked={v.suitableForBeginners}
                                onChange={c =>
                                    setValue('suitableForBeginners', c, {
                                        shouldDirty: true,
                                    })
                                }
                            />
                        </ToggleGrid>
                    </div>
                </WizardSection>

                <WizardSection
                    id='operator-conditions'
                    title='Operator conditions'
                    description='A required checkbox travellers tick at checkout before paying.'
                    summary={
                        v.operatorTermsKind === 'ACKNOWLEDGMENT'
                            ? `Confirm-list · ${
                                  v.acknowledgmentItems.filter(s => s.trim())
                                      .length
                              } facts`
                            : v.operatorTermsKind === 'DOCUMENT'
                              ? 'Conditions document'
                              : 'None'
                    }
                    invalid={
                        !!(
                            errors.acknowledgmentItems ||
                            errors.operatorTermsDocument
                        )
                    }>
                    <div className='space-y-6'>
                        <SelectField
                            control={control}
                            name='operatorTermsKind'
                            label='Conditions gate'
                            options={CONDITIONS_OPTIONS}
                            error={errors.operatorTermsKind?.message}
                            description={
                                v.operatorTermsKind === 'DOCUMENT'
                                    ? 'Travellers read and accept your operator conditions document at checkout. ONE document covers all your tours - editing it here changes it for every tour that uses it.'
                                    : v.operatorTermsKind === 'ACKNOWLEDGMENT'
                                      ? 'Travellers confirm the facts below for their whole group at checkout. Participation facts only - never cancellation, deposit or payment policy.'
                                      : undefined
                            }
                        />

                        {v.operatorTermsKind === 'DOCUMENT' && (
                            <Field>
                                <Label>Your operator conditions (English)</Label>
                                <RichTextEditor
                                    value={v.operatorTermsDocument}
                                    onChange={html =>
                                        setValue(
                                            'operatorTermsDocument',
                                            html,
                                            { shouldDirty: true }
                                        )
                                    }
                                />
                                <FieldDescription>
                                    Safety rules, weather policy, health notes,
                                    on-board conduct. Translations are added in
                                    the Translation Console.
                                </FieldDescription>
                                <FieldError>
                                    {
                                        (
                                            errors.operatorTermsDocument as
                                                | { message?: string }
                                                | undefined
                                        )?.message
                                    }
                                </FieldError>
                            </Field>
                        )}

                        {v.operatorTermsKind === 'ACKNOWLEDGMENT' && (
                            <AcknowledgmentFactsEditor
                                items={v.acknowledgmentItems}
                                error={
                                    (
                                        errors.acknowledgmentItems as
                                            | { message?: string }
                                            | undefined
                                    )?.message
                                }
                                onChange={items =>
                                    setValue('acknowledgmentItems', items, {
                                        shouldDirty: true,
                                    })
                                }
                            />
                        )}

                        {trip.status === 'LIVE' && (
                            <ConsequenceText>
                                This tour is live, so a change here goes to
                                Island Tours for review first - travellers keep
                                seeing the current conditions until it is
                                approved.
                            </ConsequenceText>
                        )}
                    </div>
                </WizardSection>
            </WizardStepBody>
        </>
    );
}

const CONDITIONS_OPTIONS = [
    { value: 'NONE', label: 'None' },
    { value: 'ACKNOWLEDGMENT', label: 'Participation confirm-list' },
    { value: 'DOCUMENT', label: 'Operator conditions document' },
];

/**
 * The 2-6 first-person facts of the ACKNOWLEDGMENT flavor (Pastel #80) -
 * inline bullets with one quiet delete each, per the entity-form language.
 */
function AcknowledgmentFactsEditor({
    items,
    error,
    onChange,
}: {
    items: string[];
    error?: string;
    onChange: (items: string[]) => void;
}) {
    const [draft, setDraft] = useState('');
    const add = () => {
        const fact = draft.trim();
        // Duplicates add nothing legally and would give a screen-reader two
        // identically-announced Remove buttons - refuse them quietly.
        if (!fact || items.length >= 6 || items.includes(fact)) return;
        onChange([...items, fact]);
        setDraft('');
    };
    return (
        <Field>
            <Label>Facts travellers confirm</Label>
            <ul className='m-0 flex list-none flex-col gap-1.5 p-0'>
                {items.map((item, i) => (
                    <li
                        key={`${i}-${item}`}
                        className='flex items-start gap-2 text-sm'>
                        <span className='mt-2 size-1 shrink-0 rounded-full bg-foreground/60' />
                        <span className='min-w-0 flex-1 break-words'>
                            {item}
                        </span>
                        <button
                            type='button'
                            aria-label={`Remove "${item}"`}
                            onClick={() =>
                                onChange(items.filter((_, idx) => idx !== i))
                            }
                            className='cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:underline'>
                            Remove
                        </button>
                    </li>
                ))}
            </ul>
            <div className='flex gap-2'>
                <Input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            add();
                        }
                    }}
                    placeholder='e.g. Everyone in my group can swim.'
                    aria-invalid={!!error}
                    maxLength={160}
                />
                <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={add}
                    disabled={!draft.trim() || items.length >= 6}>
                    Add
                </Button>
            </div>
            <FieldDescription>
                First person, one fact per line, 2 to 6 lines. English here -
                translations follow through the platform.
            </FieldDescription>
            <FieldError>{error}</FieldError>
        </Field>
    );
}
