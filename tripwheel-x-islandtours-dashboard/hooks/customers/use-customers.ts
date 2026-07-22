'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { customersApi } from '@/lib/api/customers';
import type {
  CustomersQueryParams,
  EmailCustomersPayload,
} from '@/types/customer';

export const customerKeys = {
  all: ['customers'] as const,
  list: (params: CustomersQueryParams) =>
    [...customerKeys.all, 'list', params] as const,
};

export function useCustomers(params: CustomersQueryParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => customersApi.list(params),
  });
}

/**
 * Manual review request. The toast states the OUTCOME rather than "sent":
 * `sent: false` with a reason is a normal result here (nothing to ask about),
 * not an error, and reporting it as success would be a lie the operator acts on.
 */
export function useSendReviewRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersApi.sendReviewRequest(id),
    onSuccess: (res) => {
      if (res.sent) {
        toast.success(`Review request sent to ${res.email}`);
        void qc.invalidateQueries({ queryKey: customerKeys.all });
      } else if (res.reason === 'no_booking_awaiting_review') {
        toast.info('Nothing to ask about - every completed trip is reviewed.');
      } else {
        toast.error(`Not sent (${res.reason ?? 'unknown'})`);
      }
    },
    onError: (e: Error) => toast.error(e.message || 'Could not send'),
  });
}

export function useEmailCustomers() {
  return useMutation({
    mutationFn: (payload: EmailCustomersPayload) => customersApi.email(payload),
    onSuccess: (res) => {
      const extra = [
        res.failed ? `${res.failed} failed` : null,
        res.deduped ? `${res.deduped} duplicate address skipped` : null,
      ]
        .filter(Boolean)
        .join(', ');
      toast.success(
        `Sent to ${res.sent} customer${res.sent === 1 ? '' : 's'}${extra ? ` (${extra})` : ''}`,
      );
    },
    onError: (e: Error) => toast.error(e.message || 'Send failed'),
  });
}
