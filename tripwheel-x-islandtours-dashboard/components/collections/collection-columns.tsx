'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon, File02Icon, HelpCircleIcon, LeftToRightListNumberIcon, MoreHorizontalIcon, PencilEdit02Icon, Search01Icon, TranslateIcon } from '@hugeicons/core-free-icons';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { StatusBadge } from '@/components/common/status-badge';
import {
  ACTIVE_STATUS,
  COLLECTION_STATUS,
  COLLECTION_TYPE,
} from '@/components/common/status-maps';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Collection } from '@/types/collection';

export interface MakeCollectionColumnsOptions {
  canEdit: boolean;
  canDelete: boolean;
  onDeactivate: (collection: Collection) => void;
  /** Include the Island column (the cross-island "All Islands" view). */
  showIsland?: boolean;
}

export function makeCollectionColumns({
  canEdit,
  canDelete,
  onDeactivate,
  showIsland = false,
}: MakeCollectionColumnsOptions): ColumnDef<Collection>[] {
  return [
    // Selection column, first - only for managers, since a read-only viewer
    // has no bulk action to run against the selection.
    ...(canDelete
      ? [
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
          } satisfies ColumnDef<Collection>,
        ]
      : []),
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => {
        if (!canEdit) return <span className="text-sm font-medium">{row.original.name}</span>;
        return (
          <Link
            href={`/collections/${row.original.id}/edit`}
            className="text-sm font-medium hover:underline underline-offset-4"
          >
            {row.original.name}
          </Link>
        );
      },
      enableSorting: true,
    },
    ...(showIsland
      ? [
          {
            id: 'island',
            header: 'Island',
            accessorFn: (c: Collection) => c.destination?.name ?? '',
            cell: ({ row }: { row: { original: Collection } }) => (
              <span className="text-xs text-muted-foreground">
                {row.original.destination?.name ?? '-'}
              </span>
            ),
            enableSorting: true,
          } satisfies ColumnDef<Collection>,
        ]
      : []),
    {
      accessorKey: 'collectionType',
      header: 'Type',
      cell: ({ row }) => {
        const meta = COLLECTION_TYPE[row.original.collectionType];
        return (
          <StatusBadge variant={meta.variant} hint={meta.hint}>
            {meta.label}
          </StatusBadge>
        );
      },
      enableSorting: true,
    },
    {
      id: 'tours',
      header: 'Tours',
      cell: ({ row }) => {
        const c = row.original;
        return (
          <span className="text-xs text-muted-foreground">
            {c.collectionType === 'MANUAL' ? `${(c.tourIds ?? []).length} tours` : 'dynamic'}
          </span>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const meta = COLLECTION_STATUS[row.original.status];
        return (
          <StatusBadge variant={meta.variant} hint={meta.hint}>
            {meta.label}
          </StatusBadge>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: 'isActive',
      header: 'Active',
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
      cell: ({ row }) => {
        const c = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <HugeiconsIcon icon={MoreHorizontalIcon} />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              {canEdit && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={`/collections/${c.id}/edit`}>
                      <HugeiconsIcon icon={PencilEdit02Icon} />
                      Edit Details
                    </Link>
                  </DropdownMenuItem>
                  {c.collectionType === 'MANUAL' && (
                    <DropdownMenuItem asChild>
                      <Link href={`/collections/${c.id}/edit?tab=tours`}>
                        <HugeiconsIcon icon={LeftToRightListNumberIcon} />
                        Manage Tours
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href={`/translations/collection/${c.id}/es`}>
                      <HugeiconsIcon icon={TranslateIcon} />
                      Manage Translations
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/collections/${c.id}/edit?tab=page-content`}>
                      <HugeiconsIcon icon={File02Icon} />
                      Page Content
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/collections/${c.id}/edit?tab=faqs`}>
                      <HugeiconsIcon icon={HelpCircleIcon} />
                      Manage FAQs
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/collections/${c.id}/edit?tab=seo`}>
                      <HugeiconsIcon icon={Search01Icon} />
                      SEO
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              {canDelete && c.isActive && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDeactivate(c)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} />
                    Deactivate
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
