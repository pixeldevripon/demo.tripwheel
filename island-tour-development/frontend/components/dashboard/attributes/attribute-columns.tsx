'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
      cell: ({ row }) => <span className="text-sm">{row.original.displayName}</span>,
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
          <div className="flex items-center justify-end gap-1">
            <Button asChild variant="ghost" size="icon-xs">
              <Link href={`/dashboard/attributes/${attr.key}/edit`}>
                <PencilIcon className="size-3.5" />
              </Link>
            </Button>
            {attr.isActive && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onDeactivate(attr)}
              >
                <Trash2Icon className="size-3.5 text-destructive" />
              </Button>
            )}
          </div>
        );
      },
      enableSorting: false,
      size: 80,
    },
  ];
}
