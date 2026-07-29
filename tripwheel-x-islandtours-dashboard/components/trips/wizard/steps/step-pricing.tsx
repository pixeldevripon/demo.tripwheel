'use client';

/**
 * Step 2 - Pricing (07 §3).
 *
 * Asked early on purpose: price is the decision an operator already made
 * before they opened the form, so answering it second makes the wizard feel
 * fast. It is also one of only two steps that can refuse Continue, and it
 * refuses using the superRefine that `trip-pricing-tab.tsx` already had - unit
 * priced tours need a base price and a unit type. Nothing new is required.
 *
 * The currency switch keeps its confirmation dialog verbatim: prices are NOT
 * converted, so every number stays as typed and the operator has to
 * acknowledge that before the select moves.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

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
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useUpdateTrip } from '@/hooks/trips/use-trips';
import { formatPriceFrom } from '@/lib/currency/current';
import type { Currency, TripListItem } from '@/types/trip';
import { AddOnsManager } from '../pricing/add-ons-manager';
import { AgeBandsManager } from '../pricing/age-bands-manager';
import { useStepCommit } from '../use-step-commit';
import { useWizard } from '../wizard-context';
import { ConsequenceText, FieldGrid, SelectField } from '../wizard-fields';
import { WizardSection } from '../wizard-section';
import {
    focusFirstInvalid,
    WizardStepBody,
    WizardStepHeader,
} from '../wizard-step';

const pricingSchema = z
    .object({
        pricingModel: z.enum(['PER_PERSON', 'UNIT']),
        defaultCurrency: z.enum(['USD', 'EUR']),
        basePrice: z
            .string()
            .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid price')
            .optional()
            .or(z.literal('')),
        wholeUnitType: z
            .enum(['GROUP', 'BOAT', 'VEHICLE', 'AIRCRAFT', 'PACKAGE'])
            .optional()
            .or(z.literal('')),
        unitIncludedGuests: z.coerce
            .number()
            .int()
            .min(1)
            .optional()
            .or(z.literal('')),
        extraPersonPrice: z
            .string()
            .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid price')
            .optional()
            .or(z.literal('')),
    })
    .superRefine((v, ctx) => {
        // Unit-priced tours need a whole-unit base price + a unit type.
        if (v.pricingModel === 'UNIT') {
            if (!v.basePrice)
                ctx.addIssue({
                    code: 'custom',
                    path: ['basePrice'],
                    message: 'Unit-priced tours need a base price.',
                });
            if (!v.wholeUnitType)
                ctx.addIssue({
                    code: 'custom',
                    path: ['wholeUnitType'],
                    message: 'Select a unit type.',
                });
        }
    });

type PricingValues = {
    pricingModel: 'PER_PERSON' | 'UNIT';
    defaultCurrency: 'USD' | 'EUR';
    basePrice: string;
    wholeUnitType: '' | 'GROUP' | 'BOAT' | 'VEHICLE' | 'AIRCRAFT' | 'PACKAGE';
    unitIncludedGuests: string;
    extraPersonPrice: string;
};

function toDefaults(trip: TripListItem): PricingValues {
    return {
        pricingModel: trip.pricingModel,
        defaultCurrency: trip.defaultCurrency,
        basePrice: trip.basePrice ?? '',
        wholeUnitType: trip.wholeUnitType ?? '',
        unitIncludedGuests:
            trip.unitIncludedGuests != null
                ? String(trip.unitIncludedGuests)
                : '',
        extraPersonPrice: trip.extraPersonPrice ?? '',
    };
}

const MODEL_OPTIONS = [
    { value: 'PER_PERSON', label: 'Per person' },
    { value: 'UNIT', label: 'Per unit (whole asset)' },
];

const CURRENCY_OPTIONS = [
    { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EUR' },
];

const UNIT_TYPE_OPTIONS = [
    { value: 'GROUP', label: 'Group' },
    { value: 'BOAT', label: 'Boat' },
    { value: 'VEHICLE', label: 'Vehicle' },
    { value: 'AIRCRAFT', label: 'Aircraft' },
    { value: 'PACKAGE', label: 'Package' },
];

interface StepPricingProps {
    trip: TripListItem;
}

export function StepPricing({ trip }: StepPricingProps) {
    const { mutateAsync: updateTrip, isPending } = useUpdateTrip();
    // Failures render in place, above the step, instead of as a toast.
    const { setStepError } = useWizard();
    const [pendingCurrency, setPendingCurrency] = useState<Currency | null>(
        null,
    );

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        control,
        reset,
        formState: { errors, isDirty },
    } = useForm<PricingValues>({
        resolver: zodResolver(
            pricingSchema,
        ) as unknown as Resolver<PricingValues>,
        defaultValues: toDefaults(trip),
    });

    useEffect(() => {
        reset(toDefaults(trip));
    }, [trip, reset]);

    const v = watch();
    const isUnit = v.pricingModel === 'UNIT';
    // The included-guests + extra-person surcharge applies ONLY to GROUP
    // pricing; boat/vehicle/aircraft/package charters are a flat whole-unit
    // price.
    const isGroupUnit = isUnit && v.wholeUnitType === 'GROUP';

    const submit = useCallback(async () => {
        let ok = false;
        await handleSubmit(
            async values => {
                try {
                    await updateTrip({
                        id: trip.id,
                        payload: {
                            pricingModel: values.pricingModel,
                            defaultCurrency: values.defaultCurrency,
                            basePrice: values.basePrice || undefined,
                            wholeUnitType:
                                values.pricingModel === 'UNIT' &&
                                values.wholeUnitType
                                    ? values.wholeUnitType
                                    : undefined,
                            unitIncludedGuests:
                                values.pricingModel === 'UNIT' &&
                                values.unitIncludedGuests
                                    ? Number(values.unitIncludedGuests)
                                    : undefined,
                            extraPersonPrice:
                                values.pricingModel === 'UNIT' &&
                                values.extraPersonPrice
                                    ? values.extraPersonPrice
                                    : undefined,
                        },
                    });
                    ok = true;
                } catch (err) {
                    setStepError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to save pricing.',
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

    useStepCommit('pricing', { submit, isPending, isDirty });

    const fromPrice = trip.priceFrom ?? trip.basePrice;

    return (
        <>
            <WizardStepHeader
                step='pricing'
                aside={
                    fromPrice ? (
                        <div className='text-right'>
                            <p className='text-xs font-medium text-content-muted'>
                                Shows as
                            </p>
                            <p className='text-sm font-medium tabular-nums text-content'>
                                from{' '}
                                {formatPriceFrom(
                                    fromPrice,
                                    trip.defaultCurrency,
                                    'en',
                                )}
                            </p>
                        </div>
                    ) : undefined
                }
            />
            <WizardStepBody>
                <WizardSection
                    id='model'
                    title='How you charge'
                    summary={
                        MODEL_OPTIONS.find(o => o.value === v.pricingModel)
                            ?.label
                    }
                    defaultOpen
                    invalid={
                        !!(
                            errors.basePrice ||
                            errors.wholeUnitType ||
                            errors.unitIncludedGuests ||
                            errors.extraPersonPrice
                        )
                    }>
                    <div className='space-y-6'>
                        <FieldGrid>
                            <SelectField
                                control={control}
                                name='pricingModel'
                                label='Pricing model'
                                options={MODEL_OPTIONS}
                                error={errors.pricingModel?.message}
                                description={
                                    isUnit
                                        ? 'One booking buys the whole unit.'
                                        : 'Each traveller is priced by their age band.'
                                }
                            />
                            {/* Not a plain SelectField: switching currency does
                                NOT convert any number, so the change is routed
                                through a confirmation and only lands on the
                                form once the operator accepts. */}
                            <Field>
                                <Label>Currency</Label>
                                <Controller
                                    name='defaultCurrency'
                                    control={control}
                                    render={({ field }) => (
                                        <Select
                                            value={field.value}
                                            onValueChange={next => {
                                                if (next !== field.value) {
                                                    setPendingCurrency(
                                                        next as Currency,
                                                    );
                                                }
                                            }}>
                                            <SelectTrigger className='w-full'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CURRENCY_OPTIONS.map(o => (
                                                    <SelectItem
                                                        key={o.value}
                                                        value={o.value}>
                                                        {o.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                <FieldDescription>
                                    Every price on this tour is charged in this
                                    currency.
                                </FieldDescription>
                            </Field>
                        </FieldGrid>

                        <FieldGrid>
                            <Field>
                                <Label>
                                    Base price ({v.defaultCurrency})
                                    {isUnit && (
                                        <span
                                            aria-hidden
                                            className='text-danger-fg'>
                                            {' '}
                                            *
                                        </span>
                                    )}
                                </Label>
                                <Input
                                    {...register('basePrice')}
                                    placeholder='e.g. 49.99'
                                    aria-invalid={!!errors.basePrice}
                                />
                                <FieldDescription>
                                    {isUnit
                                        ? 'Covers the whole unit, including the guests below.'
                                        : 'Optional fallback "from" price used when there are no age bands.'}
                                </FieldDescription>
                                <FieldError>
                                    {errors.basePrice?.message}
                                </FieldError>
                            </Field>

                            {isUnit && (
                                <SelectField
                                    control={control}
                                    name='wholeUnitType'
                                    label='Unit type'
                                    placeholder='Select...'
                                    options={UNIT_TYPE_OPTIONS}
                                    error={errors.wholeUnitType?.message}
                                    required
                                />
                            )}
                        </FieldGrid>

                        {isGroupUnit && (
                            <FieldGrid>
                                <Field>
                                    <Label>Guests included in base price</Label>
                                    <Input
                                        {...register('unitIncludedGuests')}
                                        type='number'
                                        min={1}
                                        placeholder='e.g. 10'
                                        aria-invalid={
                                            !!errors.unitIncludedGuests
                                        }
                                    />
                                    <FieldError>
                                        {errors.unitIncludedGuests?.message}
                                    </FieldError>
                                </Field>
                                <Field>
                                    <Label>
                                        Extra person price ({v.defaultCurrency})
                                    </Label>
                                    <Input
                                        {...register('extraPersonPrice')}
                                        placeholder='e.g. 175.00'
                                        aria-invalid={!!errors.extraPersonPrice}
                                    />
                                    <ConsequenceText>
                                        {v.unitIncludedGuests &&
                                        v.extraPersonPrice
                                            ? `Guest ${Number(v.unitIncludedGuests) + 1} and beyond each add ${v.extraPersonPrice}.`
                                            : ''}
                                    </ConsequenceText>
                                    <FieldError>
                                        {errors.extraPersonPrice?.message}
                                    </FieldError>
                                </Field>
                            </FieldGrid>
                        )}
                    </div>
                </WizardSection>

                {/* Age bands are a PER_PERSON construct - the backend rejects
                    them on unit-priced tours, so the section is absent rather
                    than disabled. */}
                {!isUnit && (
                    <WizardSection
                        id='age-bands'
                        title='Price tiers'>
                        <AgeBandsManager
                            tripId={trip.id}
                            currency={trip.defaultCurrency}
                        />
                    </WizardSection>
                )}

                <WizardSection
                    id='add-ons'
                    title='Optional extras'
                    description='Things a traveller can add at checkout.'>
                    <AddOnsManager
                        tripId={trip.id}
                        currency={trip.defaultCurrency}
                    />
                </WizardSection>
            </WizardStepBody>

            <AlertDialog
                open={pendingCurrency !== null}
                onOpenChange={open => !open && setPendingCurrency(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Switch pricing currency to {pendingCurrency}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Prices are not converted. The base price, age bands,
                            add-ons and pickup zone prices all keep the same
                            numbers and will be charged in {pendingCurrency}.
                            Review and adjust each price yourself, then save.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (pendingCurrency) {
                                    setValue(
                                        'defaultCurrency',
                                        pendingCurrency,
                                        { shouldDirty: true },
                                    );
                                }
                                setPendingCurrency(null);
                            }}>
                            Switch to {pendingCurrency}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
