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
import { useSendReviewRequest } from '@/hooks/customers/use-customers';
import type { CustomerListItem } from '@/types/customer';

export function CustomerRowActions({
  customer,
}: {
  customer: CustomerListItem;
}) {
  const { mutate: sendReviewRequest, isPending } = useSendReviewRequest();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Customer actions">
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
        {/* Offered only when there is something to ask about - a request that
            would return "nothing awaiting review" is a button that does
            nothing, and the customer should not have to click to find out. */}
        <DropdownMenuItem
          disabled={isPending || customer.awaitingReview === 0}
          onClick={() => sendReviewRequest(customer.id)}
        >
          <HugeiconsIcon icon={Mail01Icon} />
          {customer.awaitingReview === 0
            ? 'No trip awaiting review'
            : 'Send review request'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
