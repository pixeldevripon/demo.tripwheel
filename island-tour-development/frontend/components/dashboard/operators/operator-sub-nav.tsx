'use client';

import { DashboardTabNav } from '@/components/dashboard/dashboard-tab-nav';

interface OperatorSubNavProps {
  operatorId: string;
}

export function OperatorSubNav({ operatorId }: OperatorSubNavProps) {
  return (
    <DashboardTabNav
      tabs={[{ label: 'Details', href: `/dashboard/tour-operators/${operatorId}/edit` }]}
    />
  );
}
