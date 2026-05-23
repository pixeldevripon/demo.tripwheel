'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HubDetailShell } from './hub-detail-shell';
import { HubAllowedCategoriesManager } from './hub-allowed-categories-manager';
import { useHub } from '@/hooks/hubs/use-hubs';

interface HubAllowedCategoriesViewProps {
  id: string;
}

export function HubAllowedCategoriesView({ id }: HubAllowedCategoriesViewProps) {
  const { data: hub, isLoading } = useHub(id, 'en');

  return (
    <HubDetailShell id={id} name={hub?.name} isLoading={isLoading} subtitle="Allowed Categories">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-none" />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader className="border-b pb-8">
            <CardTitle>Allowed Categories</CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <p className="text-sm text-muted-foreground mb-6">
              Control which tour categories can be assigned to trips in this hub. Leave empty to allow all categories.
            </p>
            <HubAllowedCategoriesManager hubId={id} />
          </CardContent>
        </Card>
      )}
    </HubDetailShell>
  );
}
