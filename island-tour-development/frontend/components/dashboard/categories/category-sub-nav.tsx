'use client';

import { DashboardTabNav } from '@/components/dashboard/dashboard-tab-nav';

interface CategorySubNavProps {
  categoryId: string;
}

export function CategorySubNav({ categoryId }: CategorySubNavProps) {
  return (
    <DashboardTabNav
      tabs={[
        { label: 'Details', href: `/dashboard/categories/${categoryId}/edit` },
        { label: 'Translations', href: `/dashboard/categories/${categoryId}/translations` },
        { label: 'Page Content', href: `/dashboard/categories/${categoryId}/page-content` },
        { label: 'FAQs', href: `/dashboard/categories/${categoryId}/faqs` },
      ]}
    />
  );
}
