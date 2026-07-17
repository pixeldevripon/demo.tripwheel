'use client';

import { type ColumnDef } from '@tanstack/react-table';
import {
  AlertTriangleIcon,
  CalendarCheckIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleXIcon,
  Clock3Icon,
  MoreHorizontalIcon,
  TimerOffIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { StatusBadge } from '@/components/common/status-badge';
import { SPOTLIGHT_STATUS } from '@/components/common/status-maps';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/utils';
import type { SpotlightRequest, SpotlightStatus } from '@/types/tier';
import { SPOTLIGHT_MIN_RATING, SPOTLIGHT_MIN_REVIEWS } from '@/types/tier';

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

/* Icon + description are per-status METADATA and stay here; every status
 * COLOR comes from SPOTLIGHT_STATUS + StatusBadge (03 §5.1). */
const statusExtras: Record<
  SpotlightStatus,
  { Icon: LucideIcon; description: string }
> = {
  REQUESTED: { Icon: Clock3Icon, description: 'Waiting for admin review' },
  APPROVED: { Icon: CalendarCheckIcon, description: 'Approved and scheduled' },
  ACTIVE: { Icon: CircleCheckIcon, description: 'Live in Destination Spotlight' },
  REJECTED: { Icon: CircleXIcon, description: 'Declined by admin' },
  EXPIRED: { Icon: TimerOffIcon, description: 'Live window has ended' },
};

function getEligibilitySummary(info?: TourInfo) {
  const reviewCount = info?.reviewCount ?? 0;
  const rating = info?.rating ?? 0;
  const missingReviews = Math.max(SPOTLIGHT_MIN_REVIEWS - reviewCount, 0);
  const ratingOk = rating >= SPOTLIGHT_MIN_RATING;
  const reviewsOk = reviewCount >= SPOTLIGHT_MIN_REVIEWS;

  if (ratingOk && reviewsOk) {
    return {
      isEligible: true,
      text: `${reviewCount} reviews and ${rating.toFixed(1)} rating qualify`,
    };
  }

  const issues = [];
  if (!reviewsOk) issues.push(`${missingReviews} more ${missingReviews === 1 ? 'review' : 'reviews'}`);
  if (!ratingOk) issues.push(`${SPOTLIGHT_MIN_RATING.toFixed(1)}+ rating`);

  return {
    isEligible: false,
    text: `Needs ${issues.join(' and ')}`,
  };
}

function SpotlightStatusCell({ request }: { request: SpotlightRequestWithInfo }) {
  const meta = SPOTLIGHT_STATUS[request.status];
  const extras = statusExtras[request.status];
  const eligibility = getEligibilitySummary(request.tourInfo);
  const Icon = extras.Icon;

  return (
    <div className="min-w-44 space-y-1.5">
      <StatusBadge variant={meta.variant} icon={<Icon className="size-3" />}>
        {meta.label}
      </StatusBadge>
      <p className="text-xs leading-5 text-muted-foreground">{extras.description}</p>
      {request.status === 'REQUESTED' && (
        <StatusBadge
          variant={eligibility.isEligible ? 'success' : 'danger'}
          icon={
            eligibility.isEligible ? (
              <CircleCheckIcon className="size-3" />
            ) : (
              <AlertTriangleIcon className="size-3" />
            )
          }
        >
          {eligibility.isEligible ? 'Eligible' : 'Not eligible'} · {eligibility.text}
        </StatusBadge>
      )}
      {request.status === 'REJECTED' && request.rejectionReason && (
        <p className="max-w-56 text-xs leading-5 text-muted-foreground">
          Reason: {request.rejectionReason}
        </p>
      )}
    </div>
  );
}

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
              href={`/trips/${req.tourId}/edit`}
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
            href={`/tour-operators/${req.operatorId}`}
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
            href={`/destinations/${req.destinationId}`}
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
      cell: ({ row }) => <SpotlightStatusCell request={row.original} />,
      enableSorting: true,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const req = row.original;
        const { isEligible } = getEligibilitySummary(req.tourInfo);
        
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
