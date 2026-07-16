'use client';

import { useState } from 'react';
import {
  CopyIcon,
  EyeIcon,
  MoreHorizontalIcon,
  XCircleIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/dashboard/confirm-dialog';
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
          <Button variant="ghost" size="icon-xs" aria-label="Booking actions">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
            <EyeIcon /> View details
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              void navigator.clipboard.writeText(booking.displayRef);
              toast.success('Booking reference copied.');
            }}
          >
            <CopyIcon /> Copy reference
          </DropdownMenuItem>
          {canCancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setCancelOpen(true)}
              >
                <XCircleIcon /> Mark cancelled
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
