'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { DestinationDetailShell } from './destination-detail-shell';
import { DestinationTranslationForm } from './destination-translation-form';
import { useDestination } from '@/hooks/destinations/use-destinations';

interface DestinationTranslationsViewProps {
  id: string;
}

export function DestinationTranslationsView({ id }: DestinationTranslationsViewProps) {
  const { data: destination, isLoading } = useDestination(id, 'en');

  return (
    <DestinationDetailShell
      id={id}
      name={destination?.name}
      isLoading={isLoading}
      subtitle="Translations"
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-10 w-full rounded-none" />
        </div>
      ) : (
        <DestinationTranslationForm
          destinationId={id}
          destinationName={destination?.name ?? ''}
        />
      )}
    </DestinationDetailShell>
  );
}
