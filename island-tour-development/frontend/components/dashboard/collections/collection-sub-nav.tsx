'use client';

import { DashboardTabNav } from '@/components/dashboard/dashboard-tab-nav';

interface CollectionSubNavProps {
  collectionId: string;
}

export function CollectionSubNav({ collectionId }: CollectionSubNavProps) {
  return (
    <DashboardTabNav
      tabs={[
        { label: 'Details', href: `/dashboard/collections/${collectionId}/edit` },
        { label: 'Tours', href: `/dashboard/collections/${collectionId}/tours` },
        { label: 'Translations', href: `/dashboard/collections/${collectionId}/translations` },
        { label: 'Page Content', href: `/dashboard/collections/${collectionId}/page-content` },
        { label: 'FAQs', href: `/dashboard/collections/${collectionId}/faqs` },
      ]}
    />
  );
}
