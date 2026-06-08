'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { CollectionDetailShell } from './collection-detail-shell';
import { CollectionTranslationForm } from './collection-translation-form';
import { useCollection } from '@/hooks/collections/use-collections';

interface CollectionTranslationsViewProps {
  id: string;
}

export function CollectionTranslationsView({ id }: CollectionTranslationsViewProps) {
  const { data: collection, isLoading } = useCollection(id);

  return (
    <CollectionDetailShell
      id={id}
      name={collection?.name}
      isLoading={isLoading}
      subtitle="Translations"
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-10 w-full rounded-none" />
        </div>
      ) : (
        <CollectionTranslationForm collectionId={id} collectionName={collection?.name ?? ''} />
      )}
    </CollectionDetailShell>
  );
}
