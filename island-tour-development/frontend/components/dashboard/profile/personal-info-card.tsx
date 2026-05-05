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
import { useMemo, useState } from 'react';

interface PersonalInfoCardProps {
    user: any;
    isEditing: boolean;
}

export function PersonalInfoCard({ user, isEditing }: PersonalInfoCardProps) {
    const [open, setOpen] = useState(false);
    const [selectedTz, setSelectedTz] = useState(user?.timezone || '');

    // Auto-detect timezone if not set
    useMemo(() => {
        if (!selectedTz) {
            setSelectedTz(detectBrowserTimezone());
        }
    }, [selectedTz]);

    // Get all supported timezones with full info
    const timezoneOptions = useMemo(() => getTimezoneOptions(), []);

    const fields = [
        {
            id: 'full-name',
            label: 'Full Name',
            icon: User,
            defaultValue: user?.name || 'John Doe',
        },
        {
            id: 'email',
            label: 'Email Address',
            icon: Mail,
            defaultValue: user?.email || 'john.doe@example.com',
            type: 'email',
        },
        {
            id: 'phone',
            label: 'Phone Number',
            icon: Phone,
            defaultValue: user?.phone || '+1 (555) 000-0000',
            type: 'tel',
        },
        {
            id: 'location',
            label: 'Location',
            icon: MapPin,
            defaultValue: user?.location || 'New York, USA',
        },
    ] as const;

    return (
        <Card className='border-none shadow-sm bg-card rounded-2xl'>
            <CardHeader className='pb-4'>
                <div className='flex items-center justify-between'>
                    <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                        <User className='w-5 h-5 text-primary' />
                        Personal Information
                    </CardTitle>
                    <Badge
                        variant='secondary'
                        className='font-normal bg-primary/5 text-primary border-primary/10'>
                        Public Profile
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
                                    type={'type' in field ? field.type : 'text'}
                                    defaultValue={field.defaultValue}
                                    disabled={!isEditing}
                                    className='pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 rounded-xl transition-all'
                                />
                            </div>
                        </div>
                    ))}

                    {/* Timezone Searchable Selector */}
                    <div className='space-y-2'>
                        <Label
                            htmlFor='timezone'
                            className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
                            Timezone
                        </Label>
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger asChild>
                                <div className='relative'>
                                    <Clock className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10' />
                                    <Button
                                        variant='outline'
                                        role='combobox'
                                        aria-expanded={open}
                                        disabled={!isEditing}
                                        className='w-full justify-between pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 rounded-xl transition-all font-normal'>
                                        <span className='truncate'>
                                            {selectedTz
                                                ? timezoneOptions.find(
                                                      tz =>
                                                          tz.value ===
                                                          selectedTz
                                                  )?.label
                                                : 'Select timezone...'}
                                        </span>
                                        <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                                    </Button>
                                </div>
                            </PopoverTrigger>
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
                                                        setSelectedTz(
                                                            currentValue
                                                        );
                                                        setOpen(false);
                                                    }}>
                                                    <Check
                                                        className={cn(
                                                            'mr-2 h-4 w-4',
                                                            selectedTz ===
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
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

