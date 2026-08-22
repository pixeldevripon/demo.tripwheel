'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon, MoreHorizontalIcon, PencilEdit02Icon } from '@hugeicons/core-free-icons';

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
import type { AttributeDefinition } from '@/types/attribute';

export interface MakeAttributeColumnsOptions {
  canManage: boolean;
  onDeactivate: (attr: AttributeDefinition) => void;
}

export function makeAttributeColumns({ canManage, onDeactivate }: MakeAttributeColumnsOptions): ColumnDef<AttributeDefinition>[] {
  return [
    {
      accessorKey: 'key',
      header: 'Key',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.key}</span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'displayName',
      header: 'Display Name',
      cell: ({ row }) => {
        if (!canManage) return <span className="text-sm font-medium">{row.original.displayName}</span>;
        return (
          <Link 
            href={`/attributes/${row.original.key}/edit`} 
            className="text-sm font-medium hover:underline underline-offset-4"
          >
            {row.original.displayName}
          </Link>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: 'dataType',
      header: 'Type',
      cell: ({ row }) => <Badge variant="secondary">{row.original.dataType}</Badge>,
      enableSorting: true,
    },
    {
      accessorKey: 'appliesToCategories',
      header: 'Scope',
      cell: ({ row }) => {
        const appliesTo = row.original.appliesToCategories ?? [];
        return (
          <span className="text-xs text-muted-foreground">
            {appliesTo.length === 0 ? 'Global' : appliesTo.join(', ')}
          </span>
        );
      },
      enableSorting: false,
    },
    {
      id: 'flags',
      header: 'Flags',
      cell: ({ row }) => {
        const flags = [
          row.original.isFilterable && 'filter',
          row.original.isSortable && 'sort'
        ].filter(Boolean).join(' · ');
        
        return (
          <span className="text-xs text-muted-foreground">
            {flags || '-'}
          </span>
        );
      },
      enableSorting: false,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        if (!canManage) return null;
        const attr = row.original;
        
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
              <DropdownMenuItem asChild>
                <Link href={`/attributes/${attr.key}/edit`}>
                  <HugeiconsIcon icon={PencilEdit02Icon} />
                  Edit Attribute
                </Link>
              </DropdownMenuItem>
              {attr.isActive && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDeactivate(attr)}
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
