'use client';

import { FilterHorizontalIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { Breadcrumb } from '@/components/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { useAttribute } from '@/hooks/attributes/use-attributes';
import { AttributeForm } from './attribute-form';

export function AttributeEditView({ attributeKey }: { attributeKey: string }) {
    const { data: attribute, isLoading, isError } = useAttribute(attributeKey);

    return (
        <div className='w-full max-w-6xl'>
            <Breadcrumb
                items={[
                    { label: 'Dashboard', href: '/' },
                    { label: 'Attributes', href: '/attributes' },
                    { label: attribute?.displayName ?? 'Edit' },
                ]}
            />

            <div className='flex items-center gap-2 mb-6'>
                <HugeiconsIcon
                    icon={FilterHorizontalIcon}
                    className='size-5 text-muted-foreground'
                />
                <h1 className='text-2xl font-medium'>Edit Attribute</h1>
            </div>

            <div>
                {isLoading && <Skeleton className='h-96 w-full rounded-none' />}
                {isError && (
                    <p className='text-sm text-destructive'>
                        Failed to load attribute.
                    </p>
                )}
                {attribute && <AttributeForm attribute={attribute} />}
            </div>
        </div>
    );
}

