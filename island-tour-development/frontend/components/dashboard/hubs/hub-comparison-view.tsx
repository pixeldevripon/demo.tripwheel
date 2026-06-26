'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HubDetailShell } from './hub-detail-shell';
import { HubComparisonManager } from './hub-comparison-manager';
import { useHub } from '@/hooks/hubs/use-hubs';

interface HubComparisonViewProps {
  id: string;
}

export function HubComparisonView({ id }: HubComparisonViewProps) {
  const { data: hub, isLoading } = useHub(id, 'en');

  return (
    <HubDetailShell id={id} name={hub?.name} isLoading={isLoading} subtitle="Comparison Table">
      <Card>
        <CardHeader className="border-b pb-8">
          <CardTitle>Comparison Table</CardTitle>
        </CardHeader>
        <CardContent className="pt-8">
          <HubComparisonManager hubId={id} />
        </CardContent>
      </Card>
    </HubDetailShell>
  );
}
