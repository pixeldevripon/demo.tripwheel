'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/breadcrumb';

interface HubDetailShellProps {
  id: string;
  name: string | undefined;
  isLoading: boolean;
  subtitle: string;
  children: React.ReactNode;
}

export function HubDetailShell({ id, name, isLoading, subtitle, children }: HubDetailShellProps) {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Hubs', href: '/hubs' },
          {
            label: isLoading ? (
              <Skeleton className="h-3 w-20 inline-block" />
            ) : (name ?? 'Hub'),
            href: `/hubs/${id}/edit`,
          },
          { label: subtitle },
        ]}
      />

      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">
          {isLoading ? <Skeleton className="h-7 w-48 inline-block" /> : (name ?? 'Hub')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <div className="max-w-6xl">{children}</div>
    </div>
  );
}
