/**
 * Customer shapes - mirrors `CustomerListItemDto` in
 * `backend/src/customers/dto/customer.dto.ts`. Hand-written, so a backend
 * rename fails SILENTLY here: keep the two in step.
 */

export interface CustomerListItem {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  operatorId: string;
  operatorName: string | null;
  bookingsCount: number;
  /** EUR-normalized lifetime spend, as a decimal string. */
  totalSpendEur: string;
  firstBookingAt: string | null;
  lastBookingAt: string | null;
  /** Approved reviews this customer has left for this operator. */
  reviewsLeft: number;
  /**
   * Completed bookings still awaiting a review. The actionable number - it is
   * why this screen exists rather than the bookings list.
   */
  awaitingReview: number;
}

export interface PaginatedCustomers {
  total: number;
  page: number;
  limit: number;
  data: CustomerListItem[];
}

export interface CustomersQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  operatorId?: string;
  awaitingReviewOnly?: boolean;
}

export interface EmailCustomersPayload {
  customerIds: string[];
  subject: string;
  /** `{firstName}` is substituted per recipient. */
  body: string;
}

export interface EmailCustomersResult {
  sent: number;
  failed: number;
  /** Same address across several operators is emailed once, not once per row. */
  deduped: number;
}

export interface SendReviewRequestResult {
  sent: boolean;
  email?: string;
  /** `no_booking_awaiting_review` | `no_email` | `send_failed` */
  reason?: string;
}
