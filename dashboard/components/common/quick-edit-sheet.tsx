'use client';

/**
 * QuickEditSheet (Phase 19) - THE quick-edit surface for catalog entities.
 *
 * Replaces three cloned modal dialogs (destination / category / hub) that
 * differed only in their middle field. A side sheet keeps the list visible
 * behind the edit, so "quick" edits feel quick: the row you came from stays
 * in view and the sheet slides away on save.
 *
 * Entity wrappers own the mutation hook, payload mapping and toast copy;
 * this component owns the form, validation and presentation.
 */

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HugeiconsIcon } from '@hugeicons/react';
import { PencilEdit02Icon } from '@hugeicons/core-free-icons';

import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError } from '@/components/ui/field';
import { IconTile } from '@/components/common/icon-tile';

export interface QuickEditValues {
    name: string;
    secondary: string;
    isActive: boolean;
}

interface QuickEditSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** e.g. "destination" — used in the sheet description. */
    entityNoun: string;
    /** Current entity name, shown so the user knows what they are editing. */
    entityName: string;
    defaults: QuickEditValues;
    secondaryField: {
        label: string;
        placeholder: string;
        /** `url` renders an Input with URL validation; `textarea` a 3-row Textarea. */
        kind: 'url' | 'textarea';
    };
    isPending: boolean;
    /** Called with validated values; the wrapper maps them onto its mutation payload. */
    onSave: (values: QuickEditValues) => void;
}

export function QuickEditSheet({
    open,
    onOpenChange,
    entityNoun,
    entityName,
    defaults,
    secondaryField,
    isPending,
    onSave,
}: QuickEditSheetProps) {
    const schema = useMemo(
        () =>
            z.object({
                name: z.string().min(2, 'Name must be at least 2 characters'),
                secondary:
                    secondaryField.kind === 'url'
                        ? z
                              .string()
                              .refine(
                                  v =>
                                      v === '' ||
                                      (() => {
                                          try {
                                              new URL(v);
                                              return true;
                                          } catch {
                                              return false;
                                          }
                                      })(),
                                  'Must be a valid URL',
                              )
                        : z.string(),
                isActive: z.boolean(),
            }),
        [secondaryField.kind],
    );

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors },
    } = useForm<QuickEditValues>({
        resolver: zodResolver(schema),
        defaultValues: defaults,
    });

    const isActiveValue = watch('isActive');

    useEffect(() => {
        if (open) {
            reset(defaults);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, defaults.name, defaults.secondary, defaults.isActive, reset]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className='flex w-full flex-col gap-0 sm:max-w-md'>
                <SheetHeader className='border-b'>
                    <div className='flex items-start gap-3'>
                        <IconTile icon={PencilEdit02Icon} variant='primary' />
                        <div className='space-y-1'>
                            <SheetTitle>Quick Edit</SheetTitle>
                            <SheetDescription>
                                Update key fields of &ldquo;{entityName}&rdquo;
                                without opening the full {entityNoun} editor.
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <form
                    onSubmit={handleSubmit(onSave)}
                    className='flex min-h-0 flex-1 flex-col'
                >
                    <SheetBody className='flex flex-col gap-4 py-6'>
                        <Field>
                            <Label>Name</Label>
                            <Input
                                {...register('name')}
                                placeholder={`${entityNoun.charAt(0).toUpperCase()}${entityNoun.slice(1)} name`}
                                aria-invalid={!!errors.name}
                            />
                            <FieldError>{errors.name?.message}</FieldError>
                        </Field>

                        <Field>
                            <Label>{secondaryField.label}</Label>
                            {secondaryField.kind === 'textarea' ? (
                                <Textarea
                                    {...register('secondary')}
                                    placeholder={secondaryField.placeholder}
                                    rows={3}
                                />
                            ) : (
                                <Input
                                    {...register('secondary')}
                                    placeholder={secondaryField.placeholder}
                                    aria-invalid={!!errors.secondary}
                                />
                            )}
                            <FieldError>{errors.secondary?.message}</FieldError>
                        </Field>

                        <Field>
                            <div className='flex items-center gap-2'>
                                <Checkbox
                                    id='quick-edit-active'
                                    checked={isActiveValue}
                                    onCheckedChange={checked =>
                                        setValue('isActive', !!checked)
                                    }
                                />
                                <Label
                                    htmlFor='quick-edit-active'
                                    className='cursor-pointer'
                                >
                                    Active
                                </Label>
                            </div>
                        </Field>
                    </SheetBody>

                    <SheetFooter className='mt-auto flex-row justify-end border-t'>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => onOpenChange(false)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button type='submit' disabled={isPending}>
                            {isPending ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}
