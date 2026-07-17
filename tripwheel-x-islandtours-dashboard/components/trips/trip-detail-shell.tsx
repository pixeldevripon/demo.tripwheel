'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/breadcrumb';

interface TripDetailShellProps {
  id: string;
  name: string | undefined;
  isLoading: boolean;
  subtitle: string;
  /**
   * The edit view spans the whole content pane: its two-column layout
   * (form + 300px readiness rail) needs the extra room so the FORM column
   * stays as wide as the other modules' forms (destination = max-w-6xl).
   */
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function TripDetailShell({
  id,
  name,
  isLoading,
  subtitle,
  fullWidth = false,
  children,
}: TripDetailShellProps) {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'My Trips', href: '/trips' },
          {
            label: isLoading ? (
              <Skeleton className="h-3 w-20 inline-block" />
            ) : (name ?? 'Trip'),
            href: `/trips/${id}/edit`,
          },
          { label: subtitle },
        ]}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">
          {isLoading ? <Skeleton className="h-7 w-48 inline-block" /> : (name ?? 'Trip')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <div className={fullWidth ? undefined : 'max-w-6xl'}>
        {children}
      </div>
    </div>
  );
}
