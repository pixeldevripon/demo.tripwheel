'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CollectionDetailShell } from './collection-detail-shell';
import { CollectionFaqManager } from './collection-faq-manager';
import { useCollection } from '@/hooks/collections/use-collections';

interface CollectionFaqsViewProps {
  id: string;
}

export function CollectionFaqsView({ id }: CollectionFaqsViewProps) {
  const { data: collection, isLoading } = useCollection(id);

  return (
    <CollectionDetailShell id={id} name={collection?.name} isLoading={isLoading} subtitle="FAQs">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-none" />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader className="border-b pb-8">
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <CollectionFaqManager collectionId={id} />
          </CardContent>
        </Card>
      )}
    </CollectionDetailShell>
  );
}
