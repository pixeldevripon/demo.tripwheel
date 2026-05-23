'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/dashboard/breadcrumb';
import { CategorySubNav } from './category-sub-nav';

interface CategoryDetailShellProps {
  id: string;
  name: string | undefined;
  isLoading: boolean;
  subtitle: string;
  maxWidth?: 'md' | 'lg';
  children: React.ReactNode;
}

export function CategoryDetailShell({
  id,
  name,
  isLoading,
  subtitle,
  children,
}: CategoryDetailShellProps) {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Categories', href: '/dashboard/categories' },
          {
            label: isLoading ? (
              <Skeleton className="h-3 w-20 inline-block" />
            ) : (name ?? 'Category'),
            href: `/dashboard/categories/${id}/edit`,
          },
          { label: subtitle },
        ]}
      />

      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold uppercase tracking-wider">
          {isLoading ? <Skeleton className="h-7 w-48 inline-block" /> : (name ?? 'Category')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <CategorySubNav categoryId={id} />

      <div className="max-w-6xl">
        {children}
      </div>
    </div>
  );
}
