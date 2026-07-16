'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  useOperatorCompanyInfo,
  useUpdateOperatorCompanyInfo,
} from '@/hooks/operators/use-operator-settings';
import { SettingsCard, SettingsCardSkeleton, TextField } from './settings-fields';

const schema = z.object({
  companyName: z.string().optional(),
  companyEmail: z
    .string()
    .optional()
    .refine((v) => !v || z.email().safeParse(v).success, 'Must be a valid email'),
  companyCountry: z.string().optional(),
  companyCity: z.string().optional(),
  companyPhone: z.string().optional(),
  plannedTripCount: z.string().optional(),
  yearlySalesTarget: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/** Coerces a numeric text field to a number, or undefined when blank/invalid. */
function toInt(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export function OperatorCompanyForm({ operatorId }: { operatorId: string }) {
  const { data, isLoading } = useOperatorCompanyInfo(operatorId);
  const { mutate, isPending } = useUpdateOperatorCompanyInfo(operatorId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: '', companyEmail: '', companyCountry: '', companyCity: '', companyPhone: '',
      plannedTripCount: '', yearlySalesTarget: '',
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        companyName: data.companyName ?? '',
        companyEmail: data.companyEmail ?? '',
        companyCountry: data.companyCountry ?? '',
        companyCity: data.companyCity ?? '',
        companyPhone: data.companyPhone ?? '',
        plannedTripCount: data.plannedTripCount != null ? String(data.plannedTripCount) : '',
        yearlySalesTarget: data.yearlySalesTarget != null ? String(data.yearlySalesTarget) : '',
      });
    }
  }, [data, reset]);

  function onSubmit(values: FormValues) {
    mutate({
      companyName: values.companyName,
      companyEmail: values.companyEmail,
      companyCountry: values.companyCountry,
      companyCity: values.companyCity,
      companyPhone: values.companyPhone,
      plannedTripCount: toInt(values.plannedTripCount),
      yearlySalesTarget: toInt(values.yearlySalesTarget),
    });
  }

  if (isLoading) return <SettingsCardSkeleton />;

  return (
    <SettingsCard
      title="Company Information"
      description="Your business details. Personal contact info and social links are managed in your profile."
      onSubmit={handleSubmit(onSubmit)}
      isSaving={isPending}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label="Company Name" registration={register('companyName')} error={errors.companyName?.message} />
        <TextField
          label="Company Email"
          type="email"
          registration={register('companyEmail')}
          error={errors.companyEmail?.message}
          placeholder="hello@yourcompany.com"
          description="Optional. A public business email, separate from your login email."
        />
        <TextField label="Company Phone" registration={register('companyPhone')} error={errors.companyPhone?.message} placeholder="+5999 123 4567" />
        <TextField label="Country" registration={register('companyCountry')} error={errors.companyCountry?.message} />
        <TextField label="City" registration={register('companyCity')} error={errors.companyCity?.message} />
        <TextField label="Planned Trips" type="number" registration={register('plannedTripCount')} error={errors.plannedTripCount?.message} description="How many tours you plan to list." />
        <TextField label="Yearly Sales Target" type="number" registration={register('yearlySalesTarget')} error={errors.yearlySalesTarget?.message} description="Estimated annual sales in EUR." />
      </div>
    </SettingsCard>
  );
}
