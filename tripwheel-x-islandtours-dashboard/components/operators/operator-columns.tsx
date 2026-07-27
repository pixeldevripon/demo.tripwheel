'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Mail01Icon, Store01Icon } from '@hugeicons/core-free-icons';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { StatusBadge } from '@/components/common/status-badge';
import {
  ACTIVE_STATUS,
  OPERATOR_VERIFICATION,
} from '@/components/common/status-maps';
import { Checkbox } from '@/components/ui/checkbox';
import type { OperatorListItem } from '@/types/operator';
import { getOperatorDisplayName } from '@/types/operator';
import { OperatorRowActions } from './operator-row-actions';

export function buildOperatorColumns(): ColumnDef<OperatorListItem>[] {
  return [
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
      id: 'name',
      header: 'Operator',
      cell: ({ row }) => {
        const op = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="size-8 shrink-0 overflow-hidden rounded-sm bg-muted flex items-center justify-center">
              <HugeiconsIcon icon={Store01Icon} className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <Link
                href={`/tour-operators/${op.id}`}
                className="font-medium hover:underline underline-offset-4 truncate max-w-50 block"
              >
                {getOperatorDisplayName(op)}
              </Link>
              <span className="text-xs text-muted-foreground truncate max-w-50 block">
                {op.user.name}
              </span>
            </div>
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <HugeiconsIcon icon={Mail01Icon} className="size-3 text-muted-foreground shrink-0" />
          <span className="text-sm truncate max-w-56">{row.original.user.email}</span>
        </div>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'verificationStatus',
      header: 'Verification',
      cell: ({ row }) => {
        const cfg = OPERATOR_VERIFICATION[row.original.verificationStatus];
        return (
          <StatusBadge variant={cfg.variant} hint={cfg.hint}>
            {cfg.label}
          </StatusBadge>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => {
        const isActive = row.original.isActive;
        const meta = ACTIVE_STATUS[isActive ? 'active' : 'inactive'];
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
      cell: ({ row }) => <OperatorRowActions operator={row.original} />,
      enableSorting: false,
      enableHiding: false,
      size: 48,
    },
  ];
}
