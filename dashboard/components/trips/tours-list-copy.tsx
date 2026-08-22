'use client';

import { useRole } from '@/contexts/role-context';
import { isPlatformWideRole } from '@/lib/rbac-utils';

/**
 * Role-aware copy for the tours list surface: platform staff manage the whole
 * catalogue ("All Tours"), an operator only ever sees their own ("My Tours").
 * One source for the page header, the loading skeleton and the breadcrumbs,
 * so the three can never disagree mid-navigation.
 */
export function useToursListCopy() {
    const { role } = useRole();
    const platform = isPlatformWideRole(role);
    return {
        title: platform ? 'All Tours' : 'My Tours',
        description: platform
            ? 'Create, edit, and manage tour listings from draft to live'
            : 'Create, edit, and manage your tour listings from draft to live',
    };
}

export function ToursPageHeader() {
    const { title, description } = useToursListCopy();
    return (
        <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
            <div>
                <h1 className='text-2xl font-medium'>{title}</h1>
                <p className='text-sm text-muted-foreground mt-1'>
                    {description}
                </p>
            </div>
        </div>
    );
}
