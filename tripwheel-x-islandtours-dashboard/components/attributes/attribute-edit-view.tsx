'use client';

import { SlidersHorizontalIcon } from 'lucide-react';
import { Breadcrumb } from '@/components/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { AttributeForm } from './attribute-form';
import { useAttribute } from '@/hooks/attributes/use-attributes';

export function AttributeEditView({ attributeKey }: { attributeKey: string }) {
  const { data: attribute, isLoading, isError } = useAttribute(attributeKey);

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Attributes', href: '/attributes' },
          { label: attribute?.displayName ?? 'Edit' },
        ]}
      />

      <div className="flex items-center gap-2 mb-6">
        <SlidersHorizontalIcon className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold uppercase tracking-wider">
          Edit Attribute
        </h1>
      </div>

      <div className="max-w-6xl">
        {isLoading && <Skeleton className="h-96 w-full rounded-none" />}
        {isError && <p className="text-sm text-destructive">Failed to load attribute.</p>}
        {attribute && <AttributeForm attribute={attribute} />}
      </div>
    </div>
  );
}
