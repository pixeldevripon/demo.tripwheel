'use client';

import { DashboardTabNav } from '@/components/dashboard/dashboard-tab-nav';

interface HubSubNavProps {
  hubId: string;
}

export function HubSubNav({ hubId }: HubSubNavProps) {
  return (
    <DashboardTabNav
      tabs={[
        { label: 'Details', href: `/dashboard/hubs/${hubId}/edit` },
        { label: 'Translations', href: `/dashboard/hubs/${hubId}/translations` },
        { label: 'Page Content', href: `/dashboard/hubs/${hubId}/page-content` },
        { label: 'FAQs', href: `/dashboard/hubs/${hubId}/faqs` },
        { label: 'Allowed Categories', href: `/dashboard/hubs/${hubId}/allowed-categories` },
      ]}
    />
  );
}
