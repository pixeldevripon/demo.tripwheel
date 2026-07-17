'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    CallIcon,
    Clock01Icon,
    Location01Icon,
    Loading03Icon,
    Mail01Icon,
    PencilEdit02Icon,
    Tick02Icon,
    UnfoldMoreIcon,
    User03Icon,
} from '@hugeicons/core-free-icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { detectBrowserTimezone, getTimezoneOptions } from '@/utils/intl-utils';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { useUpdateProfile } from '@/hooks/profile/use-profile';
import {
    profileSchema,
    type ProfileFormValues,
} from '@/lib/validations/profile';
import { profileValuesFromUser } from './profile-form-values';
import type { UserProfile } from '@/types/profile';

interface PersonalInfoCardProps {
    user: UserProfile;
}

/**
 * Per-card edit (Phase 20): this card owns its own edit state and form, so
 * editing personal info no longer flips the entire page into edit mode. The
 * form carries the full profile value set; only these fields are editable
 * here, so the save payload matches the old page-wide form exactly.
 */
export function PersonalInfoCard({ user }: PersonalInfoCardProps) {
    const updateMutation = useUpdateProfile();
    const [isEditing, setIsEditing] = useState(false);
    const [open, setOpen] = useState(false);

    const {
        register,
        control,
        formState: { errors },
        setValue,
        watch,
        reset,
        handleSubmit,
    } = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: profileValuesFromUser(user),
    });

    // Keep in sync with fresh server data, but never clobber an edit in flight.
    useEffect(() => {
        if (!isEditing) reset(profileValuesFromUser(user));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isEditing]);

    const selectedTz = watch('timezone');

    // Auto-detect timezone if not set
    useEffect(() => {
        if (!selectedTz) {
            setValue('timezone', detectBrowserTimezone());
        }
    }, [selectedTz, setValue]);

    // Get all supported timezones with full info
    const timezoneOptions = useMemo(() => getTimezoneOptions(), []);

    const onSave = handleSubmit((data: ProfileFormValues) => {
        updateMutation.mutate(
            { data, role: user.role, operatorId: user.operator?.id },
            {
                onSuccess: () => {
                    toast.success('Profile updated successfully');
                    setIsEditing(false);
                },
            },
        );
    });

    function cancelEdit() {
        reset(profileValuesFromUser(user));
        setIsEditing(false);
    }

    const fields = [
        {
            id: 'name',
            label: 'Full Name',
            icon: User03Icon,
        },
        {
            id: 'email',
            label: 'Email Address',
            icon: Mail01Icon,
            type: 'email',
            disabled: true,
        },
        {
            id: 'phone',
            label: 'Phone Number',
            icon: CallIcon,
            type: 'tel',
        },
        {
            id: 'location',
            label: 'Location',
            icon: Location01Icon,
        },
    ] as const;

    return (
        <Card>
            <CardHeader className='pb-4'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div className='flex items-center gap-2'>
                        <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                            <HugeiconsIcon
                                icon={User03Icon}
                                className='size-5 text-primary'
                            />
                            Personal Information
                        </CardTitle>
                        <Badge
                            variant='secondary'
                            className='font-normal bg-primary/5 text-primary border-primary/10'>
                            {user?.role?.replace('_', ' ') || 'USER'}
                        </Badge>
                    </div>
                    {isEditing ? (
                        <div className='flex gap-2'>
                            <Button
                                variant='ghost'
                                size='sm'
                                onClick={cancelEdit}
                                disabled={updateMutation.isPending}>
                                Cancel
                            </Button>
                            <Button
                                size='sm'
                                onClick={onSave}
                                disabled={updateMutation.isPending}>
                                {updateMutation.isPending && (
                                    <HugeiconsIcon
                                        icon={Loading03Icon}
                                        className='size-4 animate-spin'
                                    />
                                )}
                                Save
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={() => setIsEditing(true)}>
                            <HugeiconsIcon
                                icon={PencilEdit02Icon}
                                className='size-4'
                            />
                            Edit
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    {fields.map(field => (
                        <div key={field.id} className='space-y-2'>
                            <Label htmlFor={field.id}>{field.label}</Label>
                            <div className='relative'>
                                <HugeiconsIcon
                                    icon={field.icon}
                                    className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-content-muted'
                                />
                                <Input
                                    id={field.id}
                                    {...register(field.id)}
                                    type={'type' in field ? field.type : 'text'}
                                    disabled={
                                        'disabled' in field && field.disabled
                                            ? true
                                            : !isEditing
                                    }
                                    readOnly={
                                        'disabled' in field && field.disabled
                                    }
                                    aria-invalid={!!errors[field.id]}
                                    className='pl-8'
                                />
                            </div>
                            {errors[field.id] && (
                                <p className='text-xs font-medium text-danger-fg mt-1'>
                                    {errors[field.id]?.message as string}
                                </p>
                            )}
                        </div>
                    ))}

                    {/* Timezone Searchable Selector */}
                    <div className='space-y-2'>
                        <Label htmlFor='timezone'>Timezone</Label>
                        <Controller
                            name='timezone'
                            control={control}
                            render={({ field }) => (
                                <Popover
                                    open={isEditing ? open : false}
                                    onOpenChange={val =>
                                        isEditing && setOpen(val)
                                    }>
                                    <div className='relative'>
                                        <HugeiconsIcon
                                            icon={Clock01Icon}
                                            className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-content-muted z-10'
                                        />
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant='outline'
                                                role='combobox'
                                                aria-expanded={open}
                                                disabled={!isEditing}
                                                className={cn(
                                                    'w-full justify-between pl-8 font-normal text-left overflow-hidden',
                                                    errors.timezone &&
                                                        'border-danger-border',
                                                    !isEditing &&
                                                        'cursor-default',
                                                )}>
                                                <span className='truncate'>
                                                    {field.value
                                                        ? timezoneOptions.find(
                                                              tz =>
                                                                  tz.value ===
                                                                  field.value,
                                                          )?.label ||
                                                          field.value
                                                        : 'Select timezone...'}
                                                </span>
                                                {isEditing && (
                                                    <HugeiconsIcon
                                                        icon={UnfoldMoreIcon}
                                                        className='ml-2 size-4 shrink-0 opacity-50'
                                                    />
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                    </div>
                                    <PopoverContent className='w-[--radix-popover-trigger-width] p-0 overflow-hidden'>
                                        <Command>
                                            <CommandInput placeholder='Search timezone...' />
                                            <CommandList>
                                                <CommandEmpty>
                                                    No timezone found.
                                                </CommandEmpty>
                                                <CommandGroup className='max-h-[300px] overflow-y-auto'>
                                                    {timezoneOptions.map(tz => (
                                                        <CommandItem
                                                            key={tz.value}
                                                            value={tz.value}
                                                            onSelect={currentValue => {
                                                                field.onChange(
                                                                    currentValue,
                                                                );
                                                                setOpen(false);
                                                            }}>
                                                            <HugeiconsIcon
                                                                icon={Tick02Icon}
                                                                className={cn(
                                                                    'mr-2 size-4',
                                                                    field.value ===
                                                                        tz.value
                                                                        ? 'opacity-100'
                                                                        : 'opacity-0',
                                                                )}
                                                            />
                                                            {tz.label}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            )}
                        />
                        {errors.timezone && (
                            <p className='text-xs font-medium text-danger-fg mt-1'>
                                {errors.timezone?.message as string}
                            </p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
