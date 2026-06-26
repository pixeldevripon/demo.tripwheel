'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HubDetailShell } from './hub-detail-shell';
import { HubOurPicksManager } from './hub-our-picks-manager';
import { useHub } from '@/hooks/hubs/use-hubs';

interface HubOurPicksViewProps {
  id: string;
}

export function HubOurPicksView({ id }: HubOurPicksViewProps) {
  const { data: hub, isLoading } = useHub(id, 'en');

  return (
    <HubDetailShell id={id} name={hub?.name} isLoading={isLoading} subtitle="Our Picks">
      <Card>
        <CardHeader className="border-b pb-8">
          <CardTitle>Our Picks</CardTitle>
        </CardHeader>
        <CardContent className="pt-8">
          <HubOurPicksManager hubId={id} />
        </CardContent>
      </Card>
    </HubDetailShell>
  );
}
