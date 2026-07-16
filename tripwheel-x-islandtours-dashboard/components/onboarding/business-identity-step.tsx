'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UseFormReturn } from 'react-hook-form';
import { OnboardingData } from '@/lib/validations/onboarding';
import { Building2, Globe, MapPin, Phone } from 'lucide-react';

interface BusinessIdentityStepProps {
  form: UseFormReturn<OnboardingData>;
}

import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';

export function BusinessIdentityStep({ form }: BusinessIdentityStepProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <FieldGroup>
      <Field data-invalid={!!errors.companyName}>
        <FieldLabel htmlFor="companyName">Company Name</FieldLabel>
        <Input
          id="companyName"
          placeholder="e.g. Island Tours Ltd."
          {...register('companyName')}
        />
        {errors.companyName && (
          <p className="text-xs text-destructive mt-1">{errors.companyName.message}</p>
        )}
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field data-invalid={!!errors.companyCountry}>
          <FieldLabel htmlFor="companyCountry">Country</FieldLabel>
          <Input
            id="companyCountry"
            placeholder="e.g. Netherlands"
            {...register('companyCountry')}
          />
          {errors.companyCountry && (
            <p className="text-xs text-destructive mt-1">{errors.companyCountry.message}</p>
          )}
        </Field>

        <Field data-invalid={!!errors.companyCity}>
          <FieldLabel htmlFor="companyCity">City</FieldLabel>
          <Input
            id="companyCity"
            placeholder="e.g. Amsterdam"
            {...register('companyCity')}
          />
          {errors.companyCity && (
            <p className="text-xs text-destructive mt-1">{errors.companyCity.message}</p>
          )}
        </Field>
      </div>

      <Field data-invalid={!!errors.companyPhone}>
        <FieldLabel htmlFor="companyPhone">Business Phone</FieldLabel>
        <Input
          id="companyPhone"
          placeholder="e.g. +31 6 12345678 "
          {...register('companyPhone')}
        />

        {errors.companyPhone && (
          <p className="text-xs text-destructive mt-1">{errors.companyPhone.message}</p>
        )}
      </Field>
    </FieldGroup>
  );
}


