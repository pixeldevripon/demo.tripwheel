'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ArrowDown01Icon, Settings04Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';

const sectionList = [
    {
        id: 'quick-setup',
        label: 'Quick Setup Guide',
        description: 'Show the setup guide on dashboard',
    },
    {
        id: 'statistics',
        label: 'Statistics Overview',
        description: 'Display key metrics and analytics',
    },
    {
        id: 'recent-activity',
        label: 'Recent Activity',
        description: 'Show latest updates and changes',
    },
    {
        id: 'matrics',
        label: 'Matrics',
        description: 'Show key metrics and analytics',
    },
];

interface SectionTogglerProps {
    visibleSections: Record<string, boolean>;
    setVisibleSections: (value: any) => void;
}

// Section Toggler Component
export default function SectionToggler({
    visibleSections,
    setVisibleSections,
}: SectionTogglerProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleToggle = (sectionId: string) => {
        setVisibleSections((prev: any) => ({
            ...prev,
            [sectionId]: !prev[sectionId],
        }));
    };

    return (
        <div className='absolute top-[-20px] mx-4 left-0 right-0 z-[9999]'>
            {/* Expandable Panel */}

            <div
                className={cn(
                    'bg-white dark:bg-card transition-all duration-400 ease-linear rounded-lg rounded-br-none rounded-t-none overflow-hidden shadow-2xl border border-border border-t-0',
                    isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                )}>
                <div className='p-6'>
                    <h3 className='text-sm font-medium text-foreground mb-2'>
                        Screen elements
                    </h3>
                    <p className='text-sm text-muted-foreground mb-4'>
                        Some screen elements can be shown or hidden by using the
                        checkboxes. Expand or collapse the elements by clicking
                        on their headings, and arrange them by dragging their
                        headings or by clicking on the up and down arrows.
                    </p>

                    {/* Checkboxes Grid */}
                    <div className='grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3'>
                        {sectionList.map(section => (
                            <div
                                key={section.id}
                                className='flex items-start gap-2'>
                                <Checkbox
                                    id={section.id}
                                    checked={
                                        visibleSections[section.id] ?? false
                                    }
                                    onCheckedChange={() =>
                                        handleToggle(section.id)
                                    }
                                    className='mt-0.5'
                                />
                                <div className='flex-1'>
                                    <Label
                                        htmlFor={section.id}
                                        className='text-sm font-medium leading-tight cursor-pointer'>
                                        {section.label}
                                    </Label>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {/* Screen Options Button */}
            <div className='flex justify-end'>
                <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setIsOpen(!isOpen)}
                    className='gap-2 border-t-0 bg-white dark:bg-card hover:bg-secondary rounded-none rounded-b-lg shadow-sm'>
                    <HugeiconsIcon icon={Settings04Icon} className='size-4' />
                    Screen Options
                    <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        className={cn(
                            'size-4 transition-transform duration-200',
                            isOpen && 'rotate-180'
                        )}
                    />
                </Button>
            </div>
        </div>
    );
}

