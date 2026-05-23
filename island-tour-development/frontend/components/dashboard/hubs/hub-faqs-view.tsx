'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HubDetailShell } from './hub-detail-shell';
import { HubFaqManager } from './hub-faq-manager';
import { useHub } from '@/hooks/hubs/use-hubs';

interface HubFaqsViewProps {
  id: string;
}

export function HubFaqsView({ id }: HubFaqsViewProps) {
  const { data: hub, isLoading } = useHub(id, 'en');

  return (
    <HubDetailShell id={id} name={hub?.name} isLoading={isLoading} subtitle="FAQs">
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
            <HubFaqManager hubId={id} />
          </CardContent>
        </Card>
      )}
    </HubDetailShell>
  );
}
