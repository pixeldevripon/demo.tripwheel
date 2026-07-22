'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  Copy01Icon,
  Mail01Icon,
  MoreHorizontalIcon,
} from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSendReviewRequest } from '@/hooks/customers/use-customers';
import type { CustomerListItem } from '@/types/customer';

export function CustomerRowActions({
  customer,
}: {
  customer: CustomerListItem;
}) {
  const { mutate: sendReviewRequest, isPending } = useSendReviewRequest();
  const canAsk = customer.awaitingReview > 0;

  return (
    <div className="flex items-center justify-end gap-1">
      {/* Promoted out of the menu: asking for a review is the reason this
          screen exists, and an action buried behind "…" is one nobody runs
          across a list of 78 rows. Rendered only where there is something to
          ask about, so it is never a button that does nothing. */}
      {canAsk ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                sendReviewRequest(customer.id);
              }}
            >
              <HugeiconsIcon icon={Mail01Icon} />
              {isPending ? 'Sending…' : 'Ask for review'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Emails the review link for their oldest trip still without one
            {customer.awaitingReview > 1
              ? ` (${customer.awaitingReview} waiting)`
              : ''}
            .
          </TooltipContent>
        </Tooltip>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Customer actions"
            onClick={(e) => e.stopPropagation()}
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() => {
              void navigator.clipboard.writeText(customer.email);
              toast.success('Email address copied.');
            }}
          >
            <HugeiconsIcon icon={Copy01Icon} /> Copy email
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* Kept here too, disabled, so the menu still explains WHY a row has
              no button rather than silently omitting the action. */}
          <DropdownMenuItem
            disabled={isPending || !canAsk}
            onClick={() => sendReviewRequest(customer.id)}
          >
            <HugeiconsIcon icon={Mail01Icon} />
            {canAsk ? 'Send review request' : 'No trip awaiting review'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
