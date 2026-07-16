'use client';

import { DashboardTabNav } from '@/components/dashboard-tab-nav';

interface OperatorSubNavProps {
  operatorId: string;
}

export function OperatorSubNav({ operatorId }: OperatorSubNavProps) {
  return (
    <DashboardTabNav
      tabs={[{ label: 'Details', href: `/tour-operators/${operatorId}/edit` }]}
    />
  );
}
