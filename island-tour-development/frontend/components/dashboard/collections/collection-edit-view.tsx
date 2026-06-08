'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { CollectionDetailShell } from './collection-detail-shell';
import { CollectionForm } from './collection-form';
import { useCollection } from '@/hooks/collections/use-collections';

export function CollectionEditView({ id }: { id: string }) {
  const { data: collection, isLoading, isError } = useCollection(id);

  return (
    <CollectionDetailShell
      id={id}
      name={collection?.name}
      isLoading={isLoading}
      subtitle="Edit collection details"
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-32 w-full rounded-none" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load collection.</p>
      ) : collection ? (
        <CollectionForm collection={collection} />
      ) : (
        <p className="text-sm text-muted-foreground">Collection not found.</p>
      )}
    </CollectionDetailShell>
  );
}
