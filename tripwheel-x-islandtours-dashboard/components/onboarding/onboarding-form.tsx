'use client';

import { onboardOperator } from '@/app/_actions/onboardingActions';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { OnboardingData, onboardingSchema } from '@/lib/validations/onboarding';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { BusinessIdentityStep } from './business-identity-step';
import { BusinessIntentStep } from './business-intent-step';

const STEPS = [
    {
        id: 'identity',
        title: 'Business Identity',
        description: 'Provide your basic company information.',
    },
    {
        id: 'intent',
        title: 'Business Intent',
        description: 'Help us understand your business goals.',
    },
];

import { useTransition } from 'react';

export function OnboardingForm() {
    const [currentStep, setCurrentStep] = useState(0);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const form = useForm<OnboardingData>({
        resolver: zodResolver(onboardingSchema) as any,
        defaultValues: {
            companyName: '',
            companyCountry: '',
            companyCity: '',
            companyPhone: '',
            plannedTripCount: undefined,
            yearlySalesTarget: undefined,
        },
    });

    const next = async () => {
        const fields =
            currentStep === 0
                ? ([
                      'companyName',
                      'companyCountry',
                      'companyCity',
                      'companyPhone',
                  ] as const)
                : (['plannedTripCount', 'yearlySalesTarget'] as const);

        const isValid = await form.trigger(fields);
        if (isValid) {
            setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
        }
    };

    const prev = () => {
        setCurrentStep(prev => Math.max(prev - 1, 0));
    };

    const onSubmit = (data: OnboardingData) => {
        if (!isLastStep) {
            next();
            return;
        }

        startTransition(async () => {
            try {
                const result = await onboardOperator(data);
                if (result.success) {
                    toast.success('Onboarding completed successfully!');
                    router.refresh();
                    router.push('/');
                } else {
                    toast.error(result.error || 'Something went wrong');
                }
            } catch (error) {
                toast.error('An unexpected error occurred');
            }
        });
    };

    const isLastStep = currentStep === STEPS.length - 1;

    return (
        <Card className='w-full mx-auto'>
            <CardHeader className='space-y-6'>
                <div className='flex items-center gap-3 text-xs font-medium'>
                    <div
                        className={cn(
                            'px-3 py-1.5 rounded-lg transition-colors',
                            currentStep === 0
                                ? 'bg-primary/20 text-primary border border-primary/20'
                                : 'text-n-500'
                        )}>
                        1. Business Identity
                    </div>
                    <div className='w-8 h-px bg-n-800' />
                    <div
                        className={cn(
                            'px-3 py-1.5 rounded-lg transition-colors',
                            currentStep === 1
                                ? 'bg-primary/20 text-primary border border-primary/20'
                                : 'text-n-500'
                        )}>
                        2. Business Intent
                    </div>
                </div>

                <div className='space-y-1.5'>
                    <CardTitle>{STEPS[currentStep].title}</CardTitle>
                    <CardDescription>
                        {STEPS[currentStep].description}
                    </CardDescription>
                </div>
            </CardHeader>

            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent>
                    {currentStep === 0 && <BusinessIdentityStep form={form} />}
                    {currentStep === 1 && <BusinessIntentStep form={form} />}
                </CardContent>

                <CardFooter className='flex justify-between gap-4 mt-2'>
                    <Button
                        type='button'
                        variant='outline'
                        onClick={e => {
                            e.preventDefault();
                            prev();
                        }}
                        disabled={currentStep === 0 || isPending}>
                        Back
                    </Button>

                    {!isLastStep ? (
                        <Button
                            type='button'
                            onClick={e => {
                                e.preventDefault();
                                next();
                            }}
                            className='px-8'>
                            Continue
                        </Button>
                    ) : (
                        <Button
                            type='submit'
                            disabled={isPending}
                            className='px-8'>
                            {isPending ? (
                                <>
                                    <Loader2 className='mr-2 w-4 h-4 animate-spin' />
                                    Submitting...
                                </>
                            ) : (
                                'Complete Setup'
                            )}
                        </Button>
                    )}
                </CardFooter>
            </form>
        </Card>
    );
}

