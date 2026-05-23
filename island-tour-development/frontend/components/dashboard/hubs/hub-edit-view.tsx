'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { HubDetailShell } from './hub-detail-shell';
import { HubForm } from './hub-form';
import { useHub } from '@/hooks/hubs/use-hubs';

interface HubEditViewProps {
  id: string;
}

export function HubEditView({ id }: HubEditViewProps) {
  const { data: hub, isLoading } = useHub(id, 'en');

  return (
    <HubDetailShell
      id={id}
      name={hub?.name}
      isLoading={isLoading}
      subtitle="Edit hub details"
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-32 w-full rounded-none" />
        </div>
      ) : hub ? (
        <HubForm hub={hub} />
      ) : (
        <p className="text-sm text-muted-foreground">Hub not found.</p>
      )}
    </HubDetailShell>
  );
}
