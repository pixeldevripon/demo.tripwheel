'use client';

import { Breadcrumb } from '@/components/breadcrumb';
import { useToursListCopy } from '@/components/trips/tours-list-copy';
import { Skeleton } from '@/components/ui/skeleton';

interface TripDetailShellProps {
    id: string;
    name: string | undefined;
    isLoading: boolean;
    subtitle: string;
    /**
     * The edit view spans the whole content pane: its two-column layout
     * (form + 300px readiness rail) needs the extra room so the FORM column
     * stays as wide as the other modules' forms (destination = max-w-6xl).
     */
    fullWidth?: boolean;
    children: React.ReactNode;
}

export function TripDetailShell({
    id,
    name,
    isLoading,
    subtitle,
    fullWidth = false,
    children,
}: TripDetailShellProps) {
    const { title: listTitle } = useToursListCopy();
    return (
        <div className={fullWidth ? undefined : 'w-full max-w-6xl'}>
            <Breadcrumb
                items={[
                    { label: 'Dashboard', href: '/' },
                    { label: listTitle, href: '/trips' },
                    {
                        label: isLoading ? (
                            <Skeleton className='h-3 w-20 inline-block' />
                        ) : (
                            (name ?? 'Tour')
                        ),
                        href: `/trips/${id}/edit`,
                    },
                    { label: subtitle },
                ]}
            />

            <div className='mb-6'>
                <h1 className='text-2xl font-medium'>
                    {isLoading ? (
                        <Skeleton className='h-7 w-48 inline-block' />
                    ) : (
                        (name ?? 'Trip')
                    )}
                </h1>
                <p className='text-sm text-muted-foreground mt-1'>{subtitle}</p>
            </div>

            <div>{children}</div>
        </div>
    );
}

