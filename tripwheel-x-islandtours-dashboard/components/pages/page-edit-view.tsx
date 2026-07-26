'use client';

import { Globe02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePage, useUpdatePageStatus } from '@/hooks/pages/use-pages';
import { pageUrl } from '@/lib/public-site';
import { PAGE_STATUS_LABELS } from '@/types/pages';
import { toast } from 'sonner';
import { PageForm } from './page-form';

export function PageEditView({ pageId }: { pageId: string }) {
    const { data: page, isLoading } = usePage(pageId);
    const { mutate: setStatus, isPending: statusPending } =
        useUpdatePageStatus();

    if (isLoading || !page) {
        return (
            <div className='space-y-4'>
                <Skeleton className='h-9 w-64' />
                <Skeleton className='h-96 w-full' />
            </div>
        );
    }

    const published = page.status === 'PUBLISHED';
    const english = page.translations.find(t => t.locale === 'en');

    return (
        <div className='space-y-6'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div className='flex items-center gap-3'>
                    <h1 className='font-heading text-2xl font-normal uppercase tracking-[-0.012em] text-it-heading'>
                        {english?.title ?? page.slug}
                    </h1>
                    <Badge variant={published ? 'default' : 'secondary'}>
                        {PAGE_STATUS_LABELS[page.status]}
                    </Badge>
                </div>
                <div className='flex items-center gap-2'>
                    {published && (
                        <Button asChild variant='outline' size='sm'>
                            <a
                                href={pageUrl(page.slug)}
                                target='_blank'
                                rel='noopener noreferrer'>
                                <HugeiconsIcon icon={Globe02Icon} />
                                View live
                            </a>
                        </Button>
                    )}
                    <Button
                        size='sm'
                        variant={published ? 'outline' : 'default'}
                        disabled={statusPending}
                        onClick={() =>
                            setStatus(
                                {
                                    id: page.id,
                                    status: published ? 'DRAFT' : 'PUBLISHED',
                                },
                                {
                                    onSuccess: () =>
                                        toast.success(
                                            published
                                                ? 'Unpublished - the URL now 404s'
                                                : `Published at /${page.slug}`
                                        ),
                                    onError: err => toast.error(err.message),
                                }
                            )
                        }>
                        {published ? 'Unpublish' : 'Publish'}
                    </Button>
                </div>
            </div>

            <PageForm page={page} />
        </div>
    );
}

