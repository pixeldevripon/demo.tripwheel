import type {
  CustomersQueryParams,
  EmailCustomersPayload,
  EmailCustomersResult,
  PaginatedCustomers,
  SendReviewRequestResult,
} from '@/types/customer';
import { apiFetch, buildQuery } from './fetch';

/**
 * Customers - who has booked, and who still owes a review.
 *
 * Scope is enforced SERVER-side by the caller's role: an operator only ever
 * receives their own customers, and no query param can widen that. Nothing here
 * filters on the client, because client-side scoping is a suggestion.
 */
export const customersApi = {
  list(params: CustomersQueryParams = {}): Promise<PaginatedCustomers> {
    return apiFetch<PaginatedCustomers>(`/customers${buildQuery({ ...params })}`);
  },

  /** Manual twin of the hourly job, for one customer's oldest unreviewed trip. */
  sendReviewRequest(id: string): Promise<SendReviewRequestResult> {
    return apiFetch<SendReviewRequestResult>(`/customers/${id}/review-request`, {
      method: 'POST',
    });
  },

  /** Bulk compose. Admin only (MANAGE_USERS); deduplicated by address. */
  email(payload: EmailCustomersPayload): Promise<EmailCustomersResult> {
    return apiFetch<EmailCustomersResult>('/customers/email', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
