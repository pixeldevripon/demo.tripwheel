'use client';

import { DashboardTabNav } from '@/components/dashboard/dashboard-tab-nav';

interface DestinationSubNavProps {
  destinationId: string;
}

export function DestinationSubNav({ destinationId }: DestinationSubNavProps) {
  return (
    <DashboardTabNav
      tabs={[
        { label: 'Details', href: `/dashboard/destinations/${destinationId}/edit` },
        { label: 'Translations', href: `/dashboard/destinations/${destinationId}/translations` },
        { label: 'Page Content', href: `/dashboard/destinations/${destinationId}/page-content` },
        { label: 'FAQs', href: `/dashboard/destinations/${destinationId}/faqs` },
      ]}
    />
  );
}
