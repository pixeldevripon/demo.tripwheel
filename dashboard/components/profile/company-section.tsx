'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Skeleton } from '@/components/ui/skeleton';
import {
    useOperatorCompanyInfo,
    useUpdateOperatorCompanyInfo,
} from '@/hooks/operators/use-operator-settings';
import {
    useCompanyInfo,
    useUpdateCompanyInfo,
} from '@/hooks/settings/use-settings';
import {
    PROFILE_SECTION_CLASS,
    ProfileSaveButton,
    ProfileSection,
    ProfileTextField,
} from './profile-section';

/**
 * The Company section - company information moved here from Settings on
 * 2026-07-28, in the profile page's flat block language.
 *
 * Role-branched, mirroring `SettingsClient`'s own split: admins edit the
 * PLATFORM legal entity (invoices + public site), operators edit their OWN
 * business. Both are gated by the caller (`ProfileClient` hides the nav item
 * when neither branch applies), so this component assumes it is reachable.
 *
 * Each block owns its form and saves independently: both endpoints take a
 * partial payload, so a block-scoped Save never clears the fields it did not
 * render.
 */
export function CompanySection({ operatorId }: { operatorId?: string }) {
    return operatorId ? (
        <OperatorCompany operatorId={operatorId} />
    ) : (
        <PlatformCompany />
    );
}

function PlatformCompany() {
    // Both blocks read this same query; TanStack dedupes it by key, so gating
    // here means the blocks below always mount with data in hand.
    const { isLoading } = useCompanyInfo();
    if (isLoading) return <CompanySkeleton fields={[4, 3]} />;

    return (
        <div>
            <LegalEntityBlock />
            <RegisteredAddressBlock />
        </div>
    );
}

function OperatorCompany({ operatorId }: { operatorId: string }) {
    const { isLoading } = useOperatorCompanyInfo(operatorId);
    if (isLoading) return <CompanySkeleton fields={[4]} />;

    return (
        <div>
            <OperatorDetailsBlock operatorId={operatorId} />
        </div>
    );
}

const emailField = z
    .string()
    .optional()
    .refine(v => !v || z.email().safeParse(v).success, 'Must be a valid email');

/* ── Admin: platform legal entity ───────────────────────────────────────── */

const legalEntitySchema = z.object({
    companyName: z.string().optional(),
    companyEmail: emailField,
    companyVat: z.string().optional(),
    companySize: z.string().optional(),
});

type LegalEntityValues = z.infer<typeof legalEntitySchema>;

// `companyPhone` / `companyWebsite` exist on the endpoint but stay unrendered -
// they were commented out of the old settings form and the move is not the
// place to reinstate them.
function LegalEntityBlock() {
    const { data } = useCompanyInfo();
    const { mutate, isPending } = useUpdateCompanyInfo();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty },
    } = useForm<LegalEntityValues>({
        resolver: zodResolver(legalEntitySchema),
        defaultValues: {
            companyName: '',
            companyEmail: '',
            companyVat: '',
            companySize: '',
        },
    });

    useEffect(() => {
        if (data) {
            reset({
                companyName: data.companyName ?? '',
                companyEmail: data.companyEmail ?? '',
                companyVat: data.companyVat ?? '',
                companySize: data.companySize ?? '',
            });
        }
    }, [data, reset]);

    const onSave = handleSubmit(values =>
        mutate(values, { onSuccess: () => reset(values) }),
    );

    return (
        <ProfileSection
            title='Legal entity'
            description='Company details used on invoices and across the public site.'
            action={
                <ProfileSaveButton
                    onClick={onSave}
                    disabled={!isDirty}
                    isPending={isPending}
                />
            }>
            <form onSubmit={onSave} className='mt-6 max-w-xl space-y-6'>
                <ProfileTextField
                    label='Company name'
                    registration={register('companyName')}
                    error={errors.companyName?.message}
                />
                <ProfileTextField
                    label='Company email'
                    type='email'
                    placeholder='info@islandtours.com'
                    registration={register('companyEmail')}
                    error={errors.companyEmail?.message}
                />
                <div className='grid gap-6 sm:grid-cols-2'>
                    <ProfileTextField
                        label='VAT / Tax ID'
                        registration={register('companyVat')}
                        error={errors.companyVat?.message}
                    />
                    <ProfileTextField
                        label='Company size'
                        placeholder='10-50'
                        registration={register('companySize')}
                        error={errors.companySize?.message}
                    />
                </div>
            </form>
        </ProfileSection>
    );
}

const addressSchema = z.object({
    companyAddress: z.string().optional(),
    companyCity: z.string().optional(),
    companyState: z.string().optional(),
    companyZip: z.string().optional(),
    companyCountry: z.string().optional(),
});

type AddressValues = z.infer<typeof addressSchema>;

function RegisteredAddressBlock() {
    const { data } = useCompanyInfo();
    const { mutate, isPending } = useUpdateCompanyInfo();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty },
    } = useForm<AddressValues>({
        resolver: zodResolver(addressSchema),
        defaultValues: {
            companyAddress: '',
            companyCity: '',
            companyState: '',
            companyZip: '',
            companyCountry: '',
        },
    });

    useEffect(() => {
        if (data) {
            reset({
                companyAddress: data.companyAddress ?? '',
                companyCity: data.companyCity ?? '',
                companyState: data.companyState ?? '',
                companyZip: data.companyZip ?? '',
                companyCountry: data.companyCountry ?? '',
            });
        }
    }, [data, reset]);

    const onSave = handleSubmit(values =>
        mutate(values, { onSuccess: () => reset(values) }),
    );

    return (
        <ProfileSection
            title='Registered address'
            description='The address printed on invoices and shown in the site footer.'
            action={
                <ProfileSaveButton
                    onClick={onSave}
                    disabled={!isDirty}
                    isPending={isPending}
                />
            }>
            <form onSubmit={onSave} className='mt-6 max-w-xl space-y-6'>
                <ProfileTextField
                    label='Address'
                    registration={register('companyAddress')}
                    error={errors.companyAddress?.message}
                />
                <div className='grid gap-6 sm:grid-cols-2'>
                    <ProfileTextField
                        label='City'
                        registration={register('companyCity')}
                        error={errors.companyCity?.message}
                    />
                    <ProfileTextField
                        label='State / Province'
                        registration={register('companyState')}
                        error={errors.companyState?.message}
                    />
                    <ProfileTextField
                        label='ZIP / Postal code'
                        registration={register('companyZip')}
                        error={errors.companyZip?.message}
                    />
                    <ProfileTextField
                        label='Country'
                        registration={register('companyCountry')}
                        error={errors.companyCountry?.message}
                    />
                </div>
            </form>
        </ProfileSection>
    );
}

/* ── Operator: their own business ───────────────────────────────────────── */

const operatorDetailsSchema = z.object({
    companyName: z.string().optional(),
    companyEmail: emailField,
    companyPhone: z.string().optional(),
    companyCountry: z.string().optional(),
    companyCity: z.string().optional(),
});

type OperatorDetailsValues = z.infer<typeof operatorDetailsSchema>;

function OperatorDetailsBlock({ operatorId }: { operatorId: string }) {
    const { data } = useOperatorCompanyInfo(operatorId);
    const { mutate, isPending } = useUpdateOperatorCompanyInfo(operatorId);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty },
    } = useForm<OperatorDetailsValues>({
        resolver: zodResolver(operatorDetailsSchema),
        defaultValues: {
            companyName: '',
            companyEmail: '',
            companyPhone: '',
            companyCountry: '',
            companyCity: '',
        },
    });

    useEffect(() => {
        if (data) {
            reset({
                companyName: data.companyName ?? '',
                companyEmail: data.companyEmail ?? '',
                companyPhone: data.companyPhone ?? '',
                companyCountry: data.companyCountry ?? '',
                companyCity: data.companyCity ?? '',
            });
        }
    }, [data, reset]);

    const onSave = handleSubmit(values =>
        mutate(values, { onSuccess: () => reset(values) }),
    );

    return (
        <ProfileSection
            title='Company details'
            description='Your business as travellers and the platform see it.'
            action={
                <ProfileSaveButton
                    onClick={onSave}
                    disabled={!isDirty}
                    isPending={isPending}
                />
            }>
            <form onSubmit={onSave} className='mt-6 max-w-xl space-y-6'>
                <ProfileTextField
                    label='Company name'
                    registration={register('companyName')}
                    error={errors.companyName?.message}
                />
                <ProfileTextField
                    label='Company email'
                    type='email'
                    placeholder='hello@yourcompany.com'
                    description='Optional. A public business email, separate from your login email.'
                    registration={register('companyEmail')}
                    error={errors.companyEmail?.message}
                />
                <ProfileTextField
                    label='Company phone'
                    placeholder='+5999 123 4567'
                    registration={register('companyPhone')}
                    error={errors.companyPhone?.message}
                />
                <div className='grid gap-6 sm:grid-cols-2'>
                    <ProfileTextField
                        label='Country'
                        registration={register('companyCountry')}
                        error={errors.companyCountry?.message}
                    />
                    <ProfileTextField
                        label='City'
                        registration={register('companyCity')}
                        error={errors.companyCity?.message}
                    />
                </div>
            </form>
        </ProfileSection>
    );
}

/* ── Loading ────────────────────────────────────────────────────────────── */

/** One placeholder block per entry in `fields`, sized to its field count. */
function CompanySkeleton({ fields }: { fields: number[] }) {
    return (
        <div>
            {fields.map((count, block) => (
                <div key={block} className={PROFILE_SECTION_CLASS}>
                    <div className='flex items-start justify-between gap-4'>
                        <div className='space-y-2'>
                            <Skeleton className='h-5 w-32' />
                            <Skeleton className='h-4 w-64' />
                        </div>
                        <Skeleton className='h-8 w-16 rounded-md' />
                    </div>
                    <div className='mt-6 max-w-xl space-y-6'>
                        {Array.from({ length: count }).map((_, i) => (
                            <div key={i} className='space-y-2'>
                                <Skeleton className='h-4 w-24' />
                                <Skeleton className='h-9 w-full' />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
