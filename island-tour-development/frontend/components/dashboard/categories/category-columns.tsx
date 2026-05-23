'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { TagIcon, LockIcon } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formateDate } from '@/lib/utils';
import type { CategoryLocalized } from '@/types/category';
import { CategoryRowActions } from './category-row-actions';

export const categoryColumns: ColumnDef<CategoryLocalized>[] = [
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
              <TagIcon className="size-4 text-muted-foreground" />
            )}
          </div>
          <Link
            href={`/dashboard/categories/${category.id}`}
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
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => {
      const isActive = row.original.isActive;
      return (
        <div className="flex items-center gap-1.5">
          <span
            className={`size-1.5 rounded-full shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`}
          />
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: 'isSeeded',
    header: 'Seeded',
    cell: ({ row }) => {
      if (!row.original.isSeeded) return null;
      return (
        <div className="flex items-center gap-1.5">
          <LockIcon className="size-3 text-muted-foreground" />
          <Badge variant="secondary">Protected</Badge>
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {formateDate(row.original.createdAt)}
      </span>
    ),
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
