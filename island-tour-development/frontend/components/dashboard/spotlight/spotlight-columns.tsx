'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { MapPinIcon, CheckIcon, XIcon, MoreHorizontalIcon } from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDate } from '@/lib/utils';
import type { SpotlightRequest, SpotlightStatus } from '@/types/tier';
import { SPOTLIGHT_STATUS_LABELS } from '@/types/tier';

export interface TourInfo {
  name: string;
  operator: string;
  destination: string;
  image?: string | null;
  rating: number | null;
  reviewCount: number;
}

export type SpotlightRequestWithInfo = SpotlightRequest & {
  tourInfo?: TourInfo;
};

const statusVariant: Record<SpotlightStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  REQUESTED: 'secondary',
  APPROVED: 'default',
  ACTIVE: 'default',
  REJECTED: 'destructive',
  EXPIRED: 'outline',
};

export interface MakeSpotlightColumnsOptions {
  canApprove: boolean;
  onApprove: (req: SpotlightRequestWithInfo) => void;
  onReject: (req: SpotlightRequestWithInfo) => void;
}

export function makeSpotlightColumns({
  canApprove,
  onApprove,
  onReject,
}: MakeSpotlightColumnsOptions): ColumnDef<SpotlightRequestWithInfo>[] {
  return [
    {
      id: 'tour',
      header: 'Tour',
      accessorFn: (row) => row.tourInfo?.name ?? row.tourId,
      cell: ({ row }) => {
        const info = row.original.tourInfo;
        const req = row.original;
        
        return (
          <div className="flex flex-col gap-1">
            <Link
              href={`/dashboard/trips/${req.tourId}/edit`}
              className="flex items-center gap-3 w-fit group"
            >
              {info?.image ? (
                <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={info.image}
                    alt={info.name}
                    className="size-full object-cover"
                  />
                </div>
              ) : (
                <div className="size-10 shrink-0 rounded-md bg-muted" />
              )}
              <div className="flex flex-col">
                <span className="font-medium text-sm group-hover:underline underline-offset-4">
                  {info?.name ?? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {req.tourId.slice(0, 8)}…
                    </span>
                  )}
                </span>
                {info?.reviewCount !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {info.rating ? `${info.rating.toFixed(1)}/5` : 'No rating'} ({info.reviewCount} {info.reviewCount === 1 ? 'review' : 'reviews'})
                  </span>
                )}
              </div>
            </Link>
          </div>
        );
      },
      enableSorting: true,
    },
    {
      id: 'operator',
      header: 'Operator',
      accessorFn: (row) => row.tourInfo?.operator ?? '',
      cell: ({ row }) => {
        const req = row.original;
        const name = req.tourInfo?.operator;
        if (!name) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <Link
            href={`/dashboard/tour-operators/${req.operatorId}`}
            className="text-sm text-muted-foreground hover:underline underline-offset-4"
          >
            {name}
          </Link>
        );
      },
      enableSorting: true,
    },
    {
      id: 'destination',
      header: 'Destination',
      accessorFn: (row) => row.tourInfo?.destination ?? '',
      cell: ({ row }) => {
        const req = row.original;
        const name = req.tourInfo?.destination;
        if (!name) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <Link
            href={`/dashboard/destinations/${req.destinationId}`}
            className="text-sm text-muted-foreground hover:underline underline-offset-4"
          >
            {name}
          </Link>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: 'requestedAt',
      header: 'Requested',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.requestedAt)}
        </span>
      ),
      enableSorting: true,
    },
    {
      id: 'preferred',
      header: 'Preferred Start',
      cell: ({ row }) => {
        const req = row.original;
        if (!req.requestedStartsAt) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <span className="text-sm text-muted-foreground font-medium">
            {new Date(req.requestedStartsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {req.requestedDurationDays ? ` · ${req.requestedDurationDays}d` : ''}
          </span>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const req = row.original;
        const info = req.tourInfo;
        const isEligible = (info?.reviewCount ?? 0) >= 10 && (info?.rating ?? 0) >= 4.5;
        
        return (
          <div className="flex flex-col gap-1 items-start">
            <Badge variant={statusVariant[req.status]}>
              {SPOTLIGHT_STATUS_LABELS[req.status]}
            </Badge>
            {req.status === 'REQUESTED' && (
              <Badge variant={isEligible ? 'default' : 'destructive'} className="text-[10px] h-4 px-1.5 opacity-80">
                {isEligible ? 'Eligible' : 'Ineligible'}
              </Badge>
            )}
          </div>
        );
      },
      enableSorting: true,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const req = row.original;
        const info = req.tourInfo;
        const isEligible = (info?.reviewCount ?? 0) >= 10 && (info?.rating ?? 0) >= 4.5;
        
        if (!canApprove || req.status !== 'REQUESTED') return null;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontalIcon />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={!isEligible}
                onClick={() => onApprove(req)}
              >
                <CheckIcon />
                Approve Spotlight
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onReject(req)}
              >
                <XIcon />
                Reject Request
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      size: 80,
    },
  ];
}
