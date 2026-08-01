'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  Alert02Icon,
  ArrowTurnBackwardIcon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  MoreHorizontalIcon,
  StarIcon,
  ViewIcon,
} from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useRole } from '@/contexts/role-context';
import {
  useCancelBooking,
  useConfirmForfeit,
  useDismissCancellationReport,
  useDismissNonPayment,
  useReportCancellation,
  useReportNonPayment,
  useRestoreBooking,
} from '@/hooks/bookings/use-bookings';
import { reviewUrl } from '@/lib/public-site';
import type { BookingListItem } from '@/types/booking';
import { refundDue } from '@/lib/bookings/format';

/** A booking the admin can still act on (master 6.4 "admin marks cancelled"). */
const CANCELLABLE: BookingListItem['status'][] = [
  'ON_HOLD',
  'PENDING',
  'CONFIRMED',
];

export function BookingRowActions({
  booking,
  onViewDetails,
}: {
  booking: BookingListItem;
  /** Opens the shared details sheet (owned by the table so prev/next work). */
  onViewDetails: () => void;
}) {
  const { can } = useRole();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [reportCancelOpen, setReportCancelOpen] = useState(false);
  const [reportCancelReason, setReportCancelReason] = useState('');
  const { mutate: cancelBooking, isPending } = useCancelBooking();
  const { mutate: restoreBooking, isPending: isRestoring } =
    useRestoreBooking();
  const { mutate: reportNonPayment, isPending: isReporting } =
    useReportNonPayment();
  const { mutate: confirmForfeit, isPending: isForfeiting } =
    useConfirmForfeit();
  const { mutate: dismissNonPayment, isPending: isDismissing } =
    useDismissNonPayment();
  const { mutate: reportCancellation, isPending: isReportingCancel } =
    useReportCancellation();
  const {
    mutate: dismissCancellationReport,
    isPending: isDismissingCancelReport,
  } = useDismissCancellationReport();

  // Conflict #2 (access-roles matrix): cancelling a confirmed booking
  // executes a refund - real money. Operators REPORT the cancellation
  // (below); only an admin (MANAGE_BOOKINGS) marks cancelled. The backend
  // 403s any non-admin regardless of what renders here.
  const canCancel =
    can('MANAGE_BOOKINGS') && CANCELLABLE.includes(booking.status);
  // Restore (QA 2026-08-01): the admin's way back from a mistaken
  // cancellation. Forfeited bookings are terminal (deposit kept), and a
  // CANCELLED row that never confirmed was only an abandoned checkout hold -
  // nothing to restore, so no action is offered. Every other refusal (refund
  // issued, departure ran, seats resold) is the backend's call - it explains
  // itself in the error toast.
  const canRestore =
    can('MANAGE_BOOKINGS') &&
    booking.status === 'CANCELLED' &&
    booking.utcForfeitedAt == null &&
    booking.utcConfirmedAt != null;
  const cancelReported = booking.utcOperatorCancellationReportedAt != null;
  // The operator-side report: any EDIT_BOOKING holder without the admin
  // cancel power, on a confirmed booking not yet reported.
  const canReportCancellation =
    can('EDIT_BOOKING') &&
    !can('MANAGE_BOOKINGS') &&
    booking.status === 'CONFIRMED' &&
    !cancelReported;
  const canDecideCancelReport =
    can('MANAGE_BOOKINGS') &&
    booking.status === 'CONFIRMED' &&
    cancelReported;
  // Non-payment forfeit (guide s15): OPERATOR_LINK only, on a confirmed booking.
  // The operator files the report; only an admin (MANAGE_BOOKINGS) may confirm
  // the forfeit or dismiss the report - never automatic.
  const reported = booking.utcNonPaymentReportedAt != null;
  const canReportNonPayment =
    can('EDIT_BOOKING') &&
    booking.paymentModel === 'OPERATOR_LINK' &&
    booking.status === 'CONFIRMED' &&
    !reported;
  const canDecideForfeit =
    can('MANAGE_BOOKINGS') &&
    booking.status === 'CONFIRMED' &&
    reported &&
    booking.utcForfeitedAt == null;
  const due = refundDue(booking);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Booking actions">
            <HugeiconsIcon icon={MoreHorizontalIcon} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={onViewDetails}>
            <HugeiconsIcon icon={ViewIcon} /> View details
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              void navigator.clipboard.writeText(booking.displayRef);
              toast.success('Booking reference copied.');
            }}
          >
            <HugeiconsIcon icon={Copy01Icon} /> Copy reference
          </DropdownMenuItem>
          {/* FE-12b. Present only on a customer's OWN bookings - the backend
              omits `review` entirely for admin/operator listings, because
              `reviewToken` is a write credential. Gated on the server's
              `canReview`, the same predicate the create endpoint enforces, so
              this can never offer a review the API would refuse. */}
          {booking.review?.canReview && booking.review.reviewToken && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a
                  href={reviewUrl(booking.review.reviewToken)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <HugeiconsIcon icon={StarIcon} /> Leave a review
                </a>
              </DropdownMenuItem>
            </>
          )}
          {canReportCancellation && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setReportCancelOpen(true)}>
                <HugeiconsIcon icon={Alert02Icon} /> Report cancellation
              </DropdownMenuItem>
            </>
          )}
          {canDecideCancelReport && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setCancelOpen(true)}
              >
                <HugeiconsIcon icon={CancelCircleIcon} /> Execute cancellation
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isDismissingCancelReport}
                onClick={() => dismissCancellationReport(booking.id)}
              >
                <HugeiconsIcon icon={CheckmarkCircle02Icon} /> Dismiss cancel
                report
              </DropdownMenuItem>
            </>
          )}
          {canReportNonPayment && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setReportOpen(true)}>
                <HugeiconsIcon icon={Alert02Icon} /> Report non-payment
              </DropdownMenuItem>
            </>
          )}
          {canDecideForfeit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setForfeitOpen(true)}
              >
                <HugeiconsIcon icon={CancelCircleIcon} /> Confirm forfeit
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isDismissing}
                onClick={() => dismissNonPayment(booking.id)}
              >
                <HugeiconsIcon icon={CheckmarkCircle02Icon} /> Dismiss report
              </DropdownMenuItem>
            </>
          )}
          {canCancel && !canDecideCancelReport && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setCancelOpen(true)}
              >
                <HugeiconsIcon icon={CancelCircleIcon} /> Mark cancelled
              </DropdownMenuItem>
            </>
          )}
          {canRestore && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setRestoreOpen(true)}>
                <HugeiconsIcon icon={ArrowTurnBackwardIcon} /> Restore booking
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel booking ${booking.displayRef}?`}
        description={
          cancelReported
            ? `The operator reported this cancellation${booking.operatorCancellationReason ? ` ("${booking.operatorCancellationReason}")` : ''}. Executing it refunds the traveller in full and counts against the operator's cancellation rate.`
            : due
              ? `The request landed inside the free-cancellation window: ${due} is due back to the traveller. Traveller and operator are notified.`
              : 'Outside the free-cancellation window (or nothing was paid to the platform) - no platform refund is due. Traveller and operator are notified.'
        }
        confirmLabel={cancelReported ? 'Execute cancellation' : 'Mark cancelled'}
        destructive
        loading={isPending}
        onConfirm={() =>
          cancelBooking(
            // An operator-reported cancellation always refunds in FULL: the
            // operator pulled the tour, so the window verdict is overridden.
            { id: booking.id, payload: cancelReported ? { force: true } : {} },
            { onSuccess: () => setCancelOpen(false) },
          )
        }
      />

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title={`Restore booking ${booking.displayRef}?`}
        description="Reverses the cancellation: the seats are booked again (refused if they were resold meanwhile), the operator's settlement obligation is reinstated and the traveller is re-sent their confirmation email. Not possible once a refund was issued - ask the traveller to rebook in that case."
        confirmLabel="Restore booking"
        loading={isRestoring}
        onConfirm={() =>
          restoreBooking(booking.id, {
            onSuccess: () => setRestoreOpen(false),
          })
        }
      />

      {/* Operator cancellation report (conflict #2): reason + confirm. */}
      <Dialog open={reportCancelOpen} onOpenChange={setReportCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Report cancellation for {booking.displayRef}?
            </DialogTitle>
            <DialogDescription>
              Use this when you cannot run the tour. You are not cancelling
              anything yourself - Island Tours executes the cancellation and
              refunds the traveller in full. This counts toward your
              cancellation rate.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportCancelReason}
            onChange={(e) => setReportCancelReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Why can't the tour run? (shown to Island Tours)"
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isReportingCancel}
              onClick={() => setReportCancelOpen(false)}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={isReportingCancel}
              onClick={() =>
                reportCancellation(
                  {
                    id: booking.id,
                    reason: reportCancelReason.trim() || undefined,
                  },
                  {
                    onSuccess: () => {
                      setReportCancelOpen(false);
                      setReportCancelReason('');
                    },
                  },
                )
              }
            >
              Report cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        title={`Report non-payment for ${booking.displayRef}?`}
        description="Use this when the traveller never paid you the remaining balance. Nothing happens automatically - an admin reviews the report and decides whether the deposit is forfeited and the spot released."
        confirmLabel="Report non-payment"
        loading={isReporting}
        onConfirm={() =>
          reportNonPayment(booking.id, {
            onSuccess: () => setReportOpen(false),
          })
        }
      />

      <ConfirmDialog
        open={forfeitOpen}
        onOpenChange={setForfeitOpen}
        title={`Forfeit booking ${booking.displayRef}?`}
        description="This terminates the booking: the deposit is KEPT (no refund to the traveller) and the spot returns to inventory. Only confirm after verifying the operator's non-payment report. This cannot be undone."
        confirmLabel="Confirm forfeit"
        destructive
        loading={isForfeiting}
        onConfirm={() =>
          confirmForfeit(booking.id, {
            onSuccess: () => setForfeitOpen(false),
          })
        }
      />
    </>
  );
}
