'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/dashboard/breadcrumb';

interface TripDetailShellProps {
  id: string;
  name: string | undefined;
  isLoading: boolean;
  subtitle: string;
  children: React.ReactNode;
}

export function TripDetailShell({
  id,
  name,
  isLoading,
  subtitle,
  children,
}: TripDetailShellProps) {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'My Trips', href: '/dashboard/trips' },
          {
            label: isLoading ? (
              <Skeleton className="h-3 w-20 inline-block" />
            ) : (name ?? 'Trip'),
            href: `/dashboard/trips/${id}/edit`,
          },
          { label: subtitle },
        ]}
      />

      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">
          {isLoading ? <Skeleton className="h-7 w-48 inline-block" /> : (name ?? 'Trip')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <div className="max-w-6xl">
        {children}
      </div>
    </div>
  );
}
