'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Folder01Icon } from '@hugeicons/core-free-icons';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { StatusBadge } from '@/components/common/status-badge';
import { ACTIVE_STATUS } from '@/components/common/status-maps';
import { Checkbox } from '@/components/ui/checkbox';
import { getCategoryIconName, getCategoryIconComponent } from '@/lib/constants/category-icons';
import type { CategoryWithSubs } from '@/types/category';
import { CategoryRowActions } from './category-row-actions';

function CategoryLucideIcon({ slug, icon }: { slug: string; icon: string | null }) {
  return (
    <HugeiconsIcon
      icon={getCategoryIconComponent(getCategoryIconName(slug, icon))}
      className='size-4 text-muted-foreground'
    />
  );
}

export const categoryColumns: ColumnDef<CategoryWithSubs>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
            ? 'indeterminate'
            : false
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 48,
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const category = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="size-8 shrink-0 overflow-hidden rounded-sm bg-muted flex items-center justify-center">
            {category.heroImage ? (
              <img
                src={category.heroImage}
                alt={category.name}
                className="size-full object-cover"
              />
            ) : (
              <CategoryLucideIcon slug={category.slug} icon={category.icon} />
            )}
          </div>
          <Link
            href={`/categories/${category.id}`}
            className="font-medium hover:underline underline-offset-4 truncate max-w-50"
          >
            {category.name}
          </Link>
        </div>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: 'slug',
    header: 'Slug',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
        {row.original.slug}
      </span>
    ),
    enableSorting: true,
  },
  {
    id: 'subCategories',
    header: 'Sub-categories',
    // The list shows PARENT rows only; each parent presents as a FOLDER
    // holding its filter-only sub-categories (client 2026-08-15 - a flat
    // mixed list hid what was a sub-category at a glance).
    cell: ({ row }) => {
      const subs = row.original.subCategories;
      if (subs.length === 0) {
        return <span className="text-xs text-muted-foreground">—</span>;
      }
      // Simple view, not chips (client 2026-08-15): folder + a plain
      // comma-separated name list; each name is a quiet link.
      return (
        <div className="flex max-w-72 items-start gap-1.5 text-xs text-muted-foreground">
          <HugeiconsIcon icon={Folder01Icon} className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0">
            {subs.map((sub, i) => (
              <span key={sub.id}>
                {i > 0 && ', '}
                <Link
                  href={`/categories/${sub.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-foreground hover:underline underline-offset-2"
                >
                  {sub.name}
                </Link>
              </span>
            ))}
          </span>
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => {
      const meta = ACTIVE_STATUS[row.original.isActive ? 'active' : 'inactive'];
    return (
      <StatusBadge variant={meta.variant} hint={meta.hint}>
        {meta.label}
      </StatusBadge>
    );
    },
    enableSorting: true,
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => <CategoryRowActions category={row.original} />,
    enableSorting: false,
    enableHiding: false,
    size: 48,
  },
];
