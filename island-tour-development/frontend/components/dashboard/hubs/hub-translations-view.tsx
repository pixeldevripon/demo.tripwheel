'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { HubDetailShell } from './hub-detail-shell';
import { HubTranslationForm } from './hub-translation-form';
import { useHub } from '@/hooks/hubs/use-hubs';

interface HubTranslationsViewProps {
  id: string;
}

export function HubTranslationsView({ id }: HubTranslationsViewProps) {
  const { data: hub, isLoading } = useHub(id, 'en');

  return (
    <HubDetailShell id={id} name={hub?.name} isLoading={isLoading} subtitle="Translations">
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-none" />
          <Skeleton className="h-10 w-full rounded-none" />
        </div>
      ) : (
        <HubTranslationForm hubId={id} hubName={hub?.name ?? ''} />
      )}
    </HubDetailShell>
  );
}
