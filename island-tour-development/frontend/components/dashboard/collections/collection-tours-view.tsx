'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CollectionDetailShell } from './collection-detail-shell';
import { CollectionToursManager } from './collection-tours-manager';
import { useCollection } from '@/hooks/collections/use-collections';

interface CollectionToursViewProps {
  id: string;
}

export function CollectionToursView({ id }: CollectionToursViewProps) {
  const { data: collection, isLoading } = useCollection(id);

  return (
    <CollectionDetailShell id={id} name={collection?.name} isLoading={isLoading} subtitle="Tours">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-none" />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader className="border-b pb-8">
            <CardTitle>Tours</CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <CollectionToursManager collectionId={id} />
          </CardContent>
        </Card>
      )}
    </CollectionDetailShell>
  );
}
