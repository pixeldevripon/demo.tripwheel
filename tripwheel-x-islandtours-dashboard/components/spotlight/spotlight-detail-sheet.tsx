'use client';

/**
 * Read-only quick view of everything the queue knows about one spotlight
 * request. Opened by a row click; the trimmed list columns (destination,
 * requested date, preferred start) live here in full, along with the
 * eligibility verdict, the live window, notes and the rejection reason.
 * Approve/Reject stay available for pending rows so a decision can be made
 * without going back to the row menu.
 */

import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Tick02Icon } from '@hugeicons/core-free-icons';

import Link from 'next/link';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/common/status-badge';
import { SPOTLIGHT_STATUS } from '@/components/common/status-maps';
import {
  Row,
  Section,
  SheetPager,
  type SheetPagerProps,
} from '@/components/common/detail-sheet';
import { TourBadgeChip } from '@/components/common/tour-badge';
import { formatDate } from '@/lib/utils';
import { TIER_META } from '@/types/tier';
import {
  getEligibilitySummary,
  statusExtras,
  type SpotlightRequestWithInfo,
} from './spotlight-columns';

interface SpotlightDetailSheetProps extends SheetPagerProps {
  request: SpotlightRequestWithInfo | null;
  canApprove: boolean;
  onApprove: (req: SpotlightRequestWithInfo) => void;
  onReject: (req: SpotlightRequestWithInfo) => void;
  onOpenChange: (open: boolean) => void;
}

export function SpotlightDetailSheet({
  request,
  canApprove,
  onApprove,
  onReject,
  onOpenChange,
  ...pager
}: SpotlightDetailSheetProps) {
  return (
    <Sheet open={request !== null} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-2xl!">
        {request && (
          <SpotlightDetailBody
            request={request}
            canApprove={canApprove}
            onApprove={onApprove}
            onReject={onReject}
            {...pager}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function SpotlightDetailBody({
  request: req,
  canApprove,
  onApprove,
  onReject,
  onPrev,
  onNext,
  position,
}: {
  request: SpotlightRequestWithInfo;
  canApprove: boolean;
  onApprove: (req: SpotlightRequestWithInfo) => void;
  onReject: (req: SpotlightRequestWithInfo) => void;
} & SheetPagerProps) {
  const info = req.tourInfo;
  const statusMeta = SPOTLIGHT_STATUS[req.status];
  const eligibility = getEligibilitySummary(info);
  const tier = info ? TIER_META[info.tierKey] : null;

  return (
    <>
      <SheetHeader className="border-b">
        <div className="flex items-center justify-between gap-3 pr-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <SheetTitle className="truncate">
                {info?.name ?? req.tourId}
              </SheetTitle>
              <StatusBadge variant={statusMeta.variant} hint={statusMeta.hint}>
                {statusMeta.label}
              </StatusBadge>
            </div>
            <SheetDescription>
              {statusExtras[req.status].description}
            </SheetDescription>
          </div>
          <SheetPager onPrev={onPrev} onNext={onNext} position={position} />
        </div>
      </SheetHeader>

      <SheetBody className="divide-y">
        <Section label="Tour">
          <Row
            label="Tour"
            value={
              <Link
                href={`/trips/${req.tourId}/edit`}
                className="hover:underline underline-offset-4"
              >
                {info?.name ?? req.tourId}
              </Link>
            }
          />
          <Row
            label="Operator"
            value={
              info?.operator ? (
                <Link
                  href={`/tour-operators/${req.operatorId}`}
                  className="hover:underline underline-offset-4"
                >
                  {info.operator}
                </Link>
              ) : (
                '-'
              )
            }
          />
          <Row
            label="Destination"
            value={
              info?.destination ? (
                <Link
                  href={`/destinations/${req.destinationId}`}
                  className="hover:underline underline-offset-4"
                >
                  {info.destination}
                </Link>
              ) : (
                '-'
              )
            }
          />
          <Row
            label="Rating"
            value={
              info
                ? `${info.rating ? `${info.rating.toFixed(1)}/5` : 'No rating'} (${info.reviewCount} ${info.reviewCount === 1 ? 'review' : 'reviews'})`
                : '-'
            }
          />
        </Section>

        {info && (
          <Section label="Placement">
            <Row
              label="Tier"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Badge
                    variant={info.tierRank <= 3 ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {tier?.label ?? info.tierKey}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    #{info.tierRank}
                  </span>
                </span>
              }
            />
            <Row label="Card badge" value={<TourBadgeChip type={info.badge} />} />
          </Section>
        )}

        {req.status === 'REQUESTED' && (
          <Section label="Eligibility">
            <Row
              label="Verdict"
              value={
                <StatusBadge
                  variant={eligibility.isEligible ? 'success' : 'danger'}
                >
                  {eligibility.isEligible ? 'Eligible' : 'Not eligible'}
                </StatusBadge>
              }
            />
            <Row label="Detail" value={eligibility.text} />
          </Section>
        )}

        <Section label="Spotlight window">
          <Row
            label="Preferred start"
            value={
              req.requestedStartsAt
                ? `${formatDate(req.requestedStartsAt)}${
                    req.requestedDurationDays
                      ? ` · ${req.requestedDurationDays} days`
                      : ''
                  }`
                : 'No preference given'
            }
          />
          {req.startsAt && (
            <Row label="Starts" value={formatDate(req.startsAt, 'long')} />
          )}
          {req.endsAt && (
            <Row label="Ends" value={formatDate(req.endsAt, 'long')} />
          )}
        </Section>

        <Section label="Timeline">
          <Row label="Requested" value={formatDate(req.requestedAt, 'long')} />
          {req.approvedAt && (
            <Row label="Approved" value={formatDate(req.approvedAt, 'long')} />
          )}
        </Section>

        {req.note && (
          <Section label="Internal note">
            <p className="m-0 text-sm whitespace-pre-wrap">{req.note}</p>
          </Section>
        )}

        {req.rejectionReason && (
          <Section label="Rejection reason">
            <p className="m-0 text-sm whitespace-pre-wrap text-danger-fg">
              {req.rejectionReason}
            </p>
          </Section>
        )}
      </SheetBody>

      {canApprove && req.status === 'REQUESTED' && (
        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button variant="outline" onClick={() => onReject(req)}>
            <HugeiconsIcon icon={Cancel01Icon} />
            Reject
          </Button>
          <Button
            disabled={!eligibility.isEligible}
            onClick={() => onApprove(req)}
          >
            <HugeiconsIcon icon={Tick02Icon} />
            Approve Spotlight
          </Button>
        </SheetFooter>
      )}
    </>
  );
}
