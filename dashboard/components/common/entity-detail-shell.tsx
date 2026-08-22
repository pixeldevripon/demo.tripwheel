'use client';

/**
 * EntityDetailShell (Phase 19) - shared breadcrumb + title scaffold for
 * entity detail/edit pages. Four per-entity shells (destination / category /
 * hub / collection) were byte-level clones of this structure; they remain as
 * thin wrappers that only supply their list label and route.
 */

import { Breadcrumb } from '@/components/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';

interface EntityDetailShellProps {
    /** Breadcrumb label of the list page, e.g. "Destinations". */
    listLabel: string;
    /** Route of the list page, e.g. "/destinations". */
    listHref: string;
    /** Shown while the name loads or is missing, e.g. "Destination". */
    fallbackNoun: string;
    id: string;
    name: string | undefined;
    isLoading: boolean;
    subtitle: string;
    children: React.ReactNode;
}

export function EntityDetailShell({
    listLabel,
    listHref,
    fallbackNoun,
    id,
    name,
    isLoading,
    subtitle,
    children,
}: EntityDetailShellProps) {
    return (
        <div className='w-full max-w-6xl'>
            <Breadcrumb
                items={[
                    { label: 'Dashboard', href: '/' },
                    { label: listLabel, href: listHref },
                    {
                        label: isLoading ? (
                            <Skeleton className='h-3 w-20 inline-block' />
                        ) : (
                            (name ?? fallbackNoun)
                        ),
                        href: `${listHref}/${id}/edit`,
                    },
                    { label: subtitle },
                ]}
            />

            <div className='mb-6'>
                <h1 className='text-2xl font-medium'>
                    {isLoading ? (
                        <Skeleton className='h-7 w-48 inline-block' />
                    ) : (
                        (name ?? fallbackNoun)
                    )}
                </h1>
                <p className='text-sm text-content-muted mt-1'>{subtitle}</p>
            </div>

            <div>{children}</div>
        </div>
    );
}

