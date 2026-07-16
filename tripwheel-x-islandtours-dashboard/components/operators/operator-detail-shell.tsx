'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/breadcrumb';
import { OperatorSubNav } from './operator-sub-nav';

interface OperatorDetailShellProps {
  id: string;
  name: string | undefined;
  isLoading: boolean;
  subtitle: string;
  children: React.ReactNode;
}

export function OperatorDetailShell({
  id,
  name,
  isLoading,
  subtitle,
  children,
}: OperatorDetailShellProps) {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Tour Operators', href: '/dashboard/tour-operators' },
          {
            label: isLoading ? (
              <Skeleton className="h-3 w-20 inline-block" />
            ) : (
              name ?? 'Operator'
            ),
            href: `/dashboard/tour-operators/${id}/edit`,
          },
          { label: subtitle },
        ]}
      />

      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">
          {isLoading ? <Skeleton className="h-7 w-48 inline-block" /> : (name ?? 'Operator')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <OperatorSubNav operatorId={id} />

      <div className="max-w-6xl">{children}</div>
    </div>
  );
}
