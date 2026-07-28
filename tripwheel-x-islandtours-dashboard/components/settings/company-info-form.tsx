'use client';

import {
    useCompanyInfo,
    useUpdateCompanyInfo,
} from '@/hooks/settings/use-settings';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
    SettingsCard,
    SettingsCardSkeleton,
    TextField,
} from './settings-fields';

const schema = z.object({
    companyName: z.string().optional(),
    companyEmail: z
        .string()
        .optional()
        .refine(
            v => !v || z.email().safeParse(v).success,
            'Must be a valid email'
        ),
    companyPhone: z.string().optional(),
    companyWebsite: z.string().optional(),
    companyAddress: z.string().optional(),
    companyCity: z.string().optional(),
    companyState: z.string().optional(),
    companyZip: z.string().optional(),
    companyCountry: z.string().optional(),
    companyVat: z.string().optional(),
    companySize: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
    companyName: '',
    companyEmail: '',
    companyPhone: '',
    companyWebsite: '',
    companyAddress: '',
    companyCity: '',
    companyState: '',
    companyZip: '',
    companyCountry: '',
    companyVat: '',
    companySize: '',
};

export function CompanyInfoForm() {
    const { data, isLoading } = useCompanyInfo();
    const { mutate, isPending } = useUpdateCompanyInfo();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: EMPTY,
    });

    useEffect(() => {
        if (data) {
            reset({
                companyName: data.companyName ?? '',
                companyEmail: data.companyEmail ?? '',
                companyPhone: data.companyPhone ?? '',
                companyWebsite: data.companyWebsite ?? '',
                companyAddress: data.companyAddress ?? '',
                companyCity: data.companyCity ?? '',
                companyState: data.companyState ?? '',
                companyZip: data.companyZip ?? '',
                companyCountry: data.companyCountry ?? '',
                companyVat: data.companyVat ?? '',
                companySize: data.companySize ?? '',
            });
        }
    }, [data, reset]);

    if (isLoading) return <SettingsCardSkeleton />;

    return (
        <SettingsCard
            title='Company Information'
            description='Legal entity details used on invoices and the public site.'
            onSubmit={handleSubmit(v => mutate(v))}
            isSaving={isPending}>
            <div className='grid gap-6 sm:grid-cols-2'>
                <TextField
                    label='Company Name'
                    registration={register('companyName')}
                    error={errors.companyName?.message}
                />
                <TextField
                    label='Company Email'
                    type='email'
                    registration={register('companyEmail')}
                    error={errors.companyEmail?.message}
                    placeholder='info@islandtours.com'
                />
{/*                 <TextField
                    label='Phone'
                    registration={register('companyPhone')}
                    error={errors.companyPhone?.message}
                    placeholder='+5999 123 4567'
                />
                <TextField
                    label='Website'
                    registration={register('companyWebsite')}
                    error={errors.companyWebsite?.message}
                    placeholder='https://islandtours.com'
                /> */}
            </div>
            <TextField
                label='Address'
                registration={register('companyAddress')}
                error={errors.companyAddress?.message}
            />
            <div className='grid gap-6 sm:grid-cols-2'>
                <TextField
                    label='City'
                    registration={register('companyCity')}
                    error={errors.companyCity?.message}
                />
                <TextField
                    label='State / Province'
                    registration={register('companyState')}
                    error={errors.companyState?.message}
                />
                <TextField
                    label='ZIP / Postal Code'
                    registration={register('companyZip')}
                    error={errors.companyZip?.message}
                />
                <TextField
                    label='Country'
                    registration={register('companyCountry')}
                    error={errors.companyCountry?.message}
                />
                <TextField
                    label='VAT / Tax ID'
                    registration={register('companyVat')}
                    error={errors.companyVat?.message}
                />
                <TextField
                    label='Company Size'
                    registration={register('companySize')}
                    error={errors.companySize?.message}
                    placeholder='10-50'
                />
            </div>
        </SettingsCard>
    );
}

