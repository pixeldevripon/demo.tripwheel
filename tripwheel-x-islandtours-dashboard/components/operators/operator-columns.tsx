'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { StoreIcon, MailIcon } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDate } from '@/lib/utils';
import type { OperatorListItem, OperatorVerificationStatus } from '@/types/operator';
import { getOperatorDisplayName } from '@/types/operator';
import { OperatorRowActions } from './operator-row-actions';

const VERIFICATION_BADGE: Record<
  OperatorVerificationStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; dot: string }
> = {
  VERIFIED: { label: 'Verified', variant: 'default', dot: 'bg-emerald-500' },
  PENDING: { label: 'Pending', variant: 'secondary', dot: 'bg-amber-500' },
  UNVERIFIED: { label: 'Unverified', variant: 'outline', dot: 'bg-muted-foreground' },
  REJECTED: { label: 'Rejected', variant: 'destructive', dot: 'bg-red-500' },
};

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
              <StoreIcon className="size-4 text-muted-foreground" />
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
          <MailIcon className="size-3 text-muted-foreground shrink-0" />
          <span className="text-sm truncate max-w-56">{row.original.user.email}</span>
        </div>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'verificationStatus',
      header: 'Verification',
      cell: ({ row }) => {
        const cfg = VERIFICATION_BADGE[row.original.verificationStatus];
        return (
          <div className="flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full shrink-0 ${cfg.dot}`} />
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
          </div>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => {
        const isActive = row.original.isActive;
        return (
          <div className="flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <Badge variant={isActive ? 'default' : 'secondary'}>
              {isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">{formatDate(row.original.createdAt)}</span>
      ),
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
