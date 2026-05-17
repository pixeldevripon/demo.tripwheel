'use client';

import { DestinationDetailShell } from './destination-detail-shell';
import { DestinationFaqManager } from './destination-faq-manager';
import { useDestination } from '@/hooks/destinations/use-destinations';

interface DestinationFaqsViewProps {
  id: string;
}

export function DestinationFaqsView({ id }: DestinationFaqsViewProps) {
  const { data: destination, isLoading } = useDestination(id, 'en');

  return (
    <DestinationDetailShell
      id={id}
      name={destination?.name}
      isLoading={isLoading}
      subtitle="FAQs"
      maxWidth="lg"
    >
      <DestinationFaqManager destinationId={id} />
    </DestinationDetailShell>
  );
}
