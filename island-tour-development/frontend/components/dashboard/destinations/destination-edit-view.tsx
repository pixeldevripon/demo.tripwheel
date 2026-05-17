'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { DestinationDetailShell } from './destination-detail-shell';
import { DestinationForm } from './destination-form';
import { useDestination } from '@/hooks/destinations/use-destinations';

interface DestinationEditViewProps {
  id: string;
}

export function DestinationEditView({ id }: DestinationEditViewProps) {
  const { data: destination, isLoading } = useDestination(id, 'en');

  return (
    <DestinationDetailShell
      id={id}
      name={destination?.name}
      isLoading={isLoading}
      subtitle="Edit destination details"
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-32 w-full rounded-none" />
        </div>
      ) : destination ? (
        <DestinationForm destination={destination} />
      ) : (
        <p className="text-sm text-muted-foreground">Destination not found.</p>
      )}
    </DestinationDetailShell>
  );
}
