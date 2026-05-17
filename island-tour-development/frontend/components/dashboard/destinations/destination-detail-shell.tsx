'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/dashboard/breadcrumb';
import { DestinationSubNav } from './destination-sub-nav';

interface DestinationDetailShellProps {
  id: string;
  name: string | undefined;
  isLoading: boolean;
  subtitle: string;
  maxWidth?: 'md' | 'lg';
  children: React.ReactNode;
}

export function DestinationDetailShell({
  id,
  name,
  isLoading,
  subtitle,
  maxWidth = 'md',
  children,
}: DestinationDetailShellProps) {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Destinations', href: '/dashboard/destinations' },
          {
            label: isLoading ? (
              <Skeleton className="h-3 w-20 inline-block" />
            ) : (name ?? 'Destination'),
            href: `/dashboard/destinations/${id}/edit`,
          },
          { label: subtitle },
        ]}
      />

      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">
          {isLoading ? <Skeleton className="h-7 w-48 inline-block" /> : (name ?? 'Destination')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <DestinationSubNav destinationId={id} />

      <div className={maxWidth === 'lg' ? 'max-w-6xl' : 'max-w-6xl'}>
        {children}
      </div>
    </div>
  );
}
