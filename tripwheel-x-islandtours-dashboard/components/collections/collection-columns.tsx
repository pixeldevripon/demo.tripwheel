'use client';

import { type ColumnDef } from '@tanstack/react-table';
import {
  PencilIcon,
  Trash2Icon,
  MoreHorizontalIcon,
  ListOrderedIcon,
  LanguagesIcon,
  FileTextIcon,
  HelpCircleIcon,
  SearchIcon,
} from 'lucide-react';
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
import type { Collection } from '@/types/collection';
import { COLLECTION_STATUS_LABELS, type CollectionStatus } from '@/types/enums';

const statusVariant: Record<CollectionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PUBLISHED: 'default',
  ARCHIVED: 'destructive',
};

export interface MakeCollectionColumnsOptions {
  canEdit: boolean;
  canDelete: boolean;
  onDeactivate: (collection: Collection) => void;
}

export function makeCollectionColumns({
  canEdit,
  canDelete,
  onDeactivate,
}: MakeCollectionColumnsOptions): ColumnDef<Collection>[] {
  return [
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
    {
      accessorKey: 'collectionType',
      header: 'Type',
      cell: ({ row }) => <Badge variant="secondary">{row.original.collectionType}</Badge>,
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
        const status = row.original.status;
        return (
          <Badge variant={statusVariant[status]}>
            {COLLECTION_STATUS_LABELS[status]}
          </Badge>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: 'isActive',
      header: 'Active',
      cell: ({ row }) => {
        const isActive = row.original.isActive;
        return (
          <Badge variant={isActive ? 'default' : 'outline'}>
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
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
                <MoreHorizontalIcon />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              {canEdit && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={`/collections/${c.id}/edit`}>
                      <PencilIcon />
                      Edit Details
                    </Link>
                  </DropdownMenuItem>
                  {c.collectionType === 'MANUAL' && (
                    <DropdownMenuItem asChild>
                      <Link href={`/collections/${c.id}/edit?tab=tours`}>
                        <ListOrderedIcon />
                        Manage Tours
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href={`/collections/${c.id}/edit?tab=translations`}>
                      <LanguagesIcon />
                      Manage Translations
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/collections/${c.id}/edit?tab=page-content`}>
                      <FileTextIcon />
                      Page Content
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/collections/${c.id}/edit?tab=faqs`}>
                      <HelpCircleIcon />
                      Manage FAQs
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/collections/${c.id}/edit?tab=seo`}>
                      <SearchIcon />
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
                    <Trash2Icon />
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
