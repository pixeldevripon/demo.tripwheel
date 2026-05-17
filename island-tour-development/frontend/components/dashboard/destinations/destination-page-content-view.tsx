'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { DestinationDetailShell } from './destination-detail-shell';
import { DestinationPageContentForm } from './destination-page-content-form';
import { useDestination } from '@/hooks/destinations/use-destinations';

interface DestinationPageContentViewProps {
  id: string;
}

export function DestinationPageContentView({ id }: DestinationPageContentViewProps) {
  const { data: destination, isLoading } = useDestination(id, 'en');

  return (
    <DestinationDetailShell
      id={id}
      name={destination?.name}
      isLoading={isLoading}
      subtitle="Page Content"
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-24 w-full rounded-none" />
        </div>
      ) : (
        <DestinationPageContentForm destinationId={id} />
      )}
    </DestinationDetailShell>
  );
}
