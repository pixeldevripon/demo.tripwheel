'use client';

import { Calendar03Icon, TradeUpIcon } from '@hugeicons/core-free-icons';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UseFormReturn } from 'react-hook-form';
import { OnboardingData } from '@/lib/validations/onboarding';

interface BusinessIntentStepProps {
  form: UseFormReturn<OnboardingData>;
}

import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';

export function BusinessIntentStep({ form }: BusinessIntentStepProps) {
  const {
    setValue,
    watch,
    formState: { errors },
  } = form;

  const currentTripCount = watch('plannedTripCount');
  const currentSalesTarget = watch('yearlySalesTarget');

  const tripOptions = [
    { label: '1-3', value: 3 },
    { label: '4-10', value: 10 },
    { label: '11-20', value: 20 },
    { label: '20+', value: 50 },
  ];

  const salesOptions = [
    { label: '< $10k', value: 10000 },
    { label: '$10k - $50k', value: 50000 },
    { label: '$50k - $100k', value: 100000 },
    { label: '$100k+', value: 250000 },
  ];

  return (
    <FieldGroup>
      <Field data-invalid={!!errors.plannedTripCount}>
        <FieldLabel>How many trips do you plan to list per month?</FieldLabel>
        <div className="flex flex-wrap gap-2 mt-2">
          {tripOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setValue('plannedTripCount', option.value, { shouldValidate: true });
              }}
              className={cn(
                "px-4 py-2 rounded border text-sm font-medium transition-all",
                currentTripCount === option.value
                  ? "bg-primary border-primary text-primary-foreground shadow-sm"
                  : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
              )}
            >
              {option.label}
            </button>
          ))}

        </div>
        {errors.plannedTripCount && (
          <p className="text-xs text-destructive mt-1">{errors.plannedTripCount.message}</p>
        )}
      </Field>

      <Field data-invalid={!!errors.yearlySalesTarget}>
        <FieldLabel>What is your expected yearly sales target ($)?</FieldLabel>
        <div className="flex flex-wrap gap-2 mt-2">
          {salesOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setValue('yearlySalesTarget', option.value, { shouldValidate: true });
              }}
              className={cn(
                "px-4 py-2 rounded border text-sm font-medium transition-all",
                currentSalesTarget === option.value
                  ? "bg-primary border-primary text-primary-foreground shadow-sm"
                  : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
              )}
            >
              {option.label}
            </button>
          ))}

        </div>
        {errors.yearlySalesTarget && (
          <p className="text-xs text-destructive mt-1">{errors.yearlySalesTarget.message}</p>
        )}
      </Field>
    </FieldGroup>
  );
}



