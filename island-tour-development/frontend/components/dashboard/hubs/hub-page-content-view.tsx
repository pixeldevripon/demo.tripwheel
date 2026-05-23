'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { HubDetailShell } from './hub-detail-shell';
import { HubPageContentForm } from './hub-page-content-form';
import { useHub } from '@/hooks/hubs/use-hubs';

interface HubPageContentViewProps {
  id: string;
}

export function HubPageContentView({ id }: HubPageContentViewProps) {
  const { data: hub, isLoading } = useHub(id, 'en');

  return (
    <HubDetailShell id={id} name={hub?.name} isLoading={isLoading} subtitle="Page Content">
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-24 w-full rounded-none" />
        </div>
      ) : (
        <HubPageContentForm hubId={id} />
      )}
    </HubDetailShell>
  );
}
