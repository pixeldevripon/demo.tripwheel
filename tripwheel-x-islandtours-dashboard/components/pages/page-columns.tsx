'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  Delete02Icon,
  Globe02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  ViewIcon,
  ViewOffSlashIcon,
} from '@hugeicons/core-free-icons';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { pageUrl } from '@/lib/public-site';
import { PAGE_STATUS_LABELS, type PageListItem, type PageStatus } from '@/types/pages';

const statusVariant: Record<
  PageStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  DRAFT: 'secondary',
  PUBLISHED: 'default',
  ARCHIVED: 'destructive',
};

export interface MakePageColumnsOptions {
  canManage: boolean;
  onPublishToggle: (page: PageListItem) => void;
  onDelete: (page: PageListItem) => void;
}

export function makePageColumns({
  canManage,
  onPublishToggle,
  onDelete,
}: MakePageColumnsOptions): ColumnDef<PageListItem>[] {
  return [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => {
        const title = row.original.title ?? '(untitled)';
        if (!canManage)
          return <span className="text-sm font-medium">{title}</span>;
        return (
          <Link
            href={`/pages/${row.original.id}/edit`}
            className="text-sm font-medium hover:underline underline-offset-4"
          >
            {title}
          </Link>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: 'slug',
      header: 'Permalink',
      cell: ({ row }) => (
        <code className="text-xs text-muted-foreground">
          /{row.original.slug}
        </code>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={statusVariant[row.original.status]}>
          {PAGE_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'updatedAt',
      header: 'Updated',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.original.updatedAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
      enableSorting: true,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const page = row.original;
        const published = page.status === 'PUBLISHED';
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <HugeiconsIcon icon={MoreHorizontalIcon} />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              {canManage && (
                <DropdownMenuItem asChild>
                  <Link href={`/pages/${page.id}/edit`}>
                    <HugeiconsIcon icon={PencilEdit02Icon} />
                    Edit
                  </Link>
                </DropdownMenuItem>
              )}
              {published && (
                <DropdownMenuItem asChild>
                  <a
                    href={pageUrl(page.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <HugeiconsIcon icon={Globe02Icon} />
                    View live
                  </a>
                </DropdownMenuItem>
              )}
              {canManage && (
                <DropdownMenuItem onClick={() => onPublishToggle(page)}>
                  <HugeiconsIcon icon={published ? ViewOffSlashIcon : ViewIcon} />
                  {published ? 'Unpublish' : 'Publish'}
                </DropdownMenuItem>
              )}
              {canManage && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={published}
                    onClick={() => onDelete(page)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} />
                    {published ? 'Delete (unpublish first)' : 'Delete'}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      size: 80,
    },
  ];
}
