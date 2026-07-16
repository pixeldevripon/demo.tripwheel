'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/breadcrumb';

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
          { label: 'Dashboard', href: '/' },
          { label: 'Destinations', href: '/destinations' },
          {
            label: isLoading ? (
              <Skeleton className="h-3 w-20 inline-block" />
            ) : (name ?? 'Destination'),
            href: `/destinations/${id}/edit`,
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

      <div className={maxWidth === 'lg' ? 'max-w-6xl' : 'max-w-6xl'}>
        {children}
      </div>
    </div>
  );
}
