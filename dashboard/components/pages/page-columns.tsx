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
import { StatusBadge } from '@/components/common/status-badge';
import { PAGE_STATUS } from '@/components/common/status-maps';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { homepageUrl, pageUrl } from '@/lib/public-site';
import type { PagesTableRow } from '@/types/pages';

export interface MakePageColumnsOptions {
  canManage: boolean;
  onPublishToggle: (page: PagesTableRow) => void;
  onDelete: (page: PagesTableRow) => void;
}

/** Where a row's Edit action goes - the homepage has its own singleton screen. */
function editHref(row: PagesTableRow): string {
  return row.isHomepage ? '/homepage' : `/pages/${row.id}/edit`;
}

export function makePageColumns({
  canManage,
  onPublishToggle,
  onDelete,
}: MakePageColumnsOptions): ColumnDef<PagesTableRow>[] {
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
            href={editHref(row.original)}
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
          {row.original.isHomepage ? '/' : `/${row.original.slug}`}
        </code>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const meta = PAGE_STATUS[row.original.status];
        return (
          <StatusBadge variant={meta.variant} hint={meta.hint}>
            {meta.label}
          </StatusBadge>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: 'updatedAt',
      header: 'Updated',
      cell: ({ row }) => {
        // The homepage carries no timestamp (`/home-page` returns none), so it
        // renders a dash rather than a made-up date.
        const updatedAt = row.original.updatedAt;
        if (!updatedAt)
          return <span className="text-xs text-muted-foreground">&mdash;</span>;
        return (
          <span className="text-xs text-muted-foreground">
            {new Date(updatedAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        );
      },
      enableSorting: true,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const page = row.original;
        const published = page.status === 'PUBLISHED';
        // The homepage is permanent: it cannot be unpublished (the site root
        // would 404) and it cannot be deleted (there is no record to delete).
        // Edit and View live are the whole menu.
        const isHomepage = page.isHomepage === true;
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
                  <Link href={editHref(page)}>
                    <HugeiconsIcon icon={PencilEdit02Icon} />
                    Edit
                  </Link>
                </DropdownMenuItem>
              )}
              {(isHomepage || published) && (
                <DropdownMenuItem asChild>
                  <a
                    href={isHomepage ? homepageUrl() : pageUrl(page.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <HugeiconsIcon icon={Globe02Icon} />
                    View live
                  </a>
                </DropdownMenuItem>
              )}
              {canManage && !isHomepage && (
                <DropdownMenuItem onClick={() => onPublishToggle(page)}>
                  <HugeiconsIcon icon={published ? ViewOffSlashIcon : ViewIcon} />
                  {published ? 'Unpublish' : 'Publish'}
                </DropdownMenuItem>
              )}
              {canManage && !isHomepage && (
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
