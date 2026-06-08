'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { CollectionDetailShell } from './collection-detail-shell';
import { CollectionPageContentForm } from './collection-page-content-form';
import { useCollection } from '@/hooks/collections/use-collections';

interface CollectionPageContentViewProps {
  id: string;
}

export function CollectionPageContentView({ id }: CollectionPageContentViewProps) {
  const { data: collection, isLoading } = useCollection(id);

  return (
    <CollectionDetailShell
      id={id}
      name={collection?.name}
      isLoading={isLoading}
      subtitle="Page Content"
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-24 w-full rounded-none" />
        </div>
      ) : (
        <CollectionPageContentForm collectionId={id} />
      )}
    </CollectionDetailShell>
  );
}
