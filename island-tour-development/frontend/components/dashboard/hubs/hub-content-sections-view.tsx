'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HubDetailShell } from './hub-detail-shell';
import { HubContentSectionsManager } from './hub-content-sections-manager';
import { useHub } from '@/hooks/hubs/use-hubs';

interface HubContentSectionsViewProps {
  id: string;
}

export function HubContentSectionsView({ id }: HubContentSectionsViewProps) {
  const { data: hub, isLoading } = useHub(id, 'en');

  return (
    <HubDetailShell id={id} name={hub?.name} isLoading={isLoading} subtitle="Content Sections">
      <Card>
        <CardHeader className="border-b pb-8">
          <CardTitle>Content Sections</CardTitle>
        </CardHeader>
        <CardContent className="pt-8">
          <HubContentSectionsManager hubId={id} />
        </CardContent>
      </Card>
    </HubDetailShell>
  );
}
