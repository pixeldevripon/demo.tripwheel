'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { CancelCircleIcon, Copy01Icon, MoreHorizontalIcon, ViewIcon } from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useRole } from '@/contexts/role-context';
import { useCancelBooking } from '@/hooks/bookings/use-bookings';
import type { BookingListItem } from '@/types/booking';
import { refundDue } from './booking-columns';
import { BookingDetailsDialog } from './booking-details-dialog';

/** A booking the admin can still act on (master 6.4 "admin marks cancelled"). */
const CANCELLABLE: BookingListItem['status'][] = [
  'ON_HOLD',
  'PENDING',
  'CONFIRMED',
];

export function BookingRowActions({ booking }: { booking: BookingListItem }) {
  const { can } = useRole();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { mutate: cancelBooking, isPending } = useCancelBooking();

  const canCancel =
    can('EDIT_BOOKING') && CANCELLABLE.includes(booking.status);
  const due = refundDue(booking);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Booking actions">
            <HugeiconsIcon icon={MoreHorizontalIcon} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
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
          {canCancel && (
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
        </DropdownMenuContent>
      </DropdownMenu>

      <BookingDetailsDialog
        booking={booking}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel booking ${booking.displayRef}?`}
        description={
          due
            ? `The request landed inside the free-cancellation window: ${due} is due back to the traveller. Traveller and operator are notified.`
            : 'Outside the free-cancellation window (or nothing was paid to the platform) - no platform refund is due. Traveller and operator are notified.'
        }
        confirmLabel="Mark cancelled"
        destructive
        loading={isPending}
        onConfirm={() =>
          cancelBooking(
            { id: booking.id },
            { onSuccess: () => setCancelOpen(false) },
          )
        }
      />
    </>
  );
}
