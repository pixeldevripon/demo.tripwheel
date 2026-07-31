'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    useRecommendationSettings,
    useUpdateRecommendationSettings,
} from '@/hooks/recommendations/use-recommendations';

/** Numbers are text in the form and a number on the wire, clamped 1-10 either way. */
interface SettingsValues {
    thankYouPageLimit: string;
    confirmationEmailLimit: string;
}

const MIN = 1;
const MAX = 10;

function limitRules(label: string) {
    return {
        validate: (v: string) => {
            const n = Number(v);
            if (!v.trim() || !Number.isInteger(n))
                return `${label} must be a whole number.`;
            if (n < MIN || n > MAX)
                return `${label} must be between ${MIN} and ${MAX}.`;
            return true;
        },
    };
}

/**
 * The per-surface caps on how many recommendation cards render. Extras stay "next
 * in line" - complete and enabled, but not shown until a higher-priority row drops
 * out. Seeded from the live settings; a save invalidates the whole list because a
 * cap change moves which rows win each surface.
 */
export function RecommendationSettingsDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { data: settings } = useRecommendationSettings();
    const { mutate: save, isPending } = useUpdateRecommendationSettings();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<SettingsValues>({
        defaultValues: { thankYouPageLimit: '', confirmationEmailLimit: '' },
    });

    // Seed the form whenever the dialog opens with fresh settings.
    useEffect(() => {
        if (!settings) return;
        reset({
            thankYouPageLimit: String(settings.thankYouPageLimit),
            confirmationEmailLimit: String(settings.confirmationEmailLimit),
        });
    }, [settings, reset, open]);

    function onSubmit(v: SettingsValues) {
        save(
            {
                thankYouPageLimit: Number(v.thankYouPageLimit),
                confirmationEmailLimit: Number(v.confirmationEmailLimit),
            },
            {
                onSuccess: () => {
                    toast.success('Display settings saved.');
                    onOpenChange(false);
                },
                onError: (err) =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to save the settings.',
                    ),
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle>Display settings</DialogTitle>
                    <DialogDescription>
                        How many recommendation cards each surface shows. Extras
                        stay &ldquo;next in line&rdquo;.
                    </DialogDescription>
                </DialogHeader>

                <form
                    id='recommendation-settings-form'
                    onSubmit={handleSubmit(onSubmit)}
                    className='space-y-4'>
                    <Field>
                        <Label htmlFor='thank-you-page-limit'>
                            Thank-you page
                        </Label>
                        <Input
                            id='thank-you-page-limit'
                            type='number'
                            min={MIN}
                            max={MAX}
                            step='1'
                            aria-invalid={!!errors.thankYouPageLimit}
                            {...register(
                                'thankYouPageLimit',
                                limitRules('Thank-you page'),
                            )}
                        />
                        <FieldError>
                            {errors.thankYouPageLimit?.message}
                        </FieldError>
                    </Field>

                    <Field>
                        <Label htmlFor='confirmation-email-limit'>
                            Confirmation email
                        </Label>
                        <Input
                            id='confirmation-email-limit'
                            type='number'
                            min={MIN}
                            max={MAX}
                            step='1'
                            aria-invalid={!!errors.confirmationEmailLimit}
                            {...register(
                                'confirmationEmailLimit',
                                limitRules('Confirmation email'),
                            )}
                        />
                        <FieldError>
                            {errors.confirmationEmailLimit?.message}
                        </FieldError>
                    </Field>
                </form>

                <DialogFooter>
                    <Button
                        variant='outline'
                        onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        type='submit'
                        form='recommendation-settings-form'
                        disabled={isPending}>
                        {isPending ? 'Saving...' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
