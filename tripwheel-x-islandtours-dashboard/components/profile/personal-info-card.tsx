'use client';

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
import {
    Check,
    ChevronsUpDown,
    Clock,
    Mail,
    MapPin,
    Phone,
    User,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import type { UserProfile } from '@/types/profile';

interface PersonalInfoCardProps {
    user: UserProfile;
    isEditing: boolean;
}

export function PersonalInfoCard({ user, isEditing }: PersonalInfoCardProps) {
    const {
        register,
        control,
        formState: { errors },
        setValue,
        watch,
    } = useFormContext();
    const [open, setOpen] = useState(false);

    const selectedTz = watch('timezone');

    // Auto-detect timezone if not set
    useEffect(() => {
        if (!selectedTz) {
            setValue('timezone', detectBrowserTimezone());
        }
    }, [selectedTz, setValue]);

    // Get all supported timezones with full info
    const timezoneOptions = useMemo(() => getTimezoneOptions(), []);

    const fields = [
        {
            id: 'name',
            label: 'Full Name',
            icon: User,
        },
        {
            id: 'email',
            label: 'Email Address',
            icon: Mail,
            type: 'email',
            disabled: true,
        },
        {
            id: 'phone',
            label: 'Phone Number',
            icon: Phone,
            type: 'tel',
        },
        {
            id: 'location',
            label: 'Location',
            icon: MapPin,
        },
    ] as const;

    return (
        <Card className='border-none shadow-sm bg-card '>
            <CardHeader className='pb-4'>
                <div className='flex items-center justify-between'>
                    <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                        <User className='w-5 h-5 text-primary' />
                        Personal Information
                    </CardTitle>
                    <Badge
                        variant='secondary'
                        className='font-normal bg-primary/5 text-primary border-primary/10'>
                        {user?.role?.replace('_', ' ') || 'USER'}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    {fields.map(field => (
                        <div key={field.id} className='space-y-2'>
                            <Label
                                htmlFor={field.id}
                                className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
                                {field.label}
                            </Label>
                            <div className='relative'>
                                <field.icon className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
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
                                    className={cn(
                                        'pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 rounded-xl transition-all',
                                        errors[field.id] &&
                                            'border-destructive focus:border-destructive focus:ring-destructive/20',
                                        'disabled' in field &&
                                            field.disabled &&
                                            'cursor-not-allowed opacity-70'
                                    )}
                                />
                            </div>
                            {errors[field.id] && (
                                <p className='text-xs text-destructive mt-1'>
                                    {errors[field.id]?.message as string}
                                </p>
                            )}
                        </div>
                    ))}

                    {/* Timezone Searchable Selector */}
                    <div className='space-y-2'>
                        <Label
                            htmlFor='timezone'
                            className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
                            Timezone
                        </Label>
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
                                        <Clock className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10' />
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant='outline'
                                                role='combobox'
                                                aria-expanded={open}
                                                disabled={!isEditing}
                                                className={cn(
                                                    'w-full justify-between pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 rounded-xl transition-all font-normal text-left overflow-hidden',
                                                    errors.timezone &&
                                                        'border-destructive',
                                                    !isEditing &&
                                                        'cursor-default opacity-100 hover:bg-muted/30'
                                                )}>
                                                <span className='truncate'>
                                                    {field.value
                                                        ? timezoneOptions.find(
                                                              tz =>
                                                                  tz.value ===
                                                                  field.value
                                                          )?.label ||
                                                          field.value
                                                        : 'Select timezone...'}
                                                </span>
                                                {isEditing && (
                                                    <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                    </div>
                                    <PopoverContent className='w-[--radix-popover-trigger-width] p-0 rounded-xl overflow-hidden'>
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
                                                                    currentValue
                                                                );
                                                                setOpen(false);
                                                            }}>
                                                            <Check
                                                                className={cn(
                                                                    'mr-2 h-4 w-4',
                                                                    field.value ===
                                                                        tz.value
                                                                        ? 'opacity-100'
                                                                        : 'opacity-0'
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
                            <p className='text-xs text-destructive mt-1'>
                                {errors.timezone?.message as string}
                            </p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

