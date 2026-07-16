import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsLocalDate } from '@/common/validators/is-local-date.validator';
import {
  BookingStatus,
  CancelledBy,
  CancellationRefund,
  Currency,
  PaymentModel,
} from '@prisma/client';

// ════════════════════════════════════════════════════════════════════════════
// Response DTOs
// ════════════════════════════════════════════════════════════════════════════

export class BookingUnitItemResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Null for UNIT-priced tours (no age bands).',
  })
  ageBandId!: string | null;
  @ApiProperty({ enum: BookingStatus }) status!: BookingStatus;
  @ApiProperty({ example: '79.99' }) priceRetail!: string;
}

/** Conversion payload for the browser Pixel (master booking_complete contract). */
export class BookingConversionDto {
  @ApiProperty({ example: 'Purchase' }) event!: string;
  @ApiProperty({
    example: 'b1a2…',
    description: 'Dedupe id shared with the server CAPI event.',
  })
  eventId!: string;
  @ApiProperty({
    example: 'EUR',
    description: 'Conversion value is always EUR (rule #22).',
  })
  currency!: string;
  @ApiProperty({
    example: '57.74',
    description: 'Conversion value = commission_amount in EUR.',
  })
  value!: string;
  @ApiProperty() contentId!: string;
  @ApiPropertyOptional({ nullable: true }) contentName!: string | null;
}

/** Operator contact shown on the TYP (named deliberately post-booking - guide §13). */
export class ThankYouOperatorDto {
  @ApiPropertyOptional({ nullable: true, example: 'Miss Ann Boat Trips' })
  name!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'reservation@missannboattrips.com',
  })
  email!: string | null;
  @ApiPropertyOptional({ nullable: true, example: '+599 9 123 4567' })
  phone!: string | null;
}

/** One grouped party line ("2 x Adult"); `ageBandId` is null for UNIT-priced tours. */
export class ThankYouPartyLineDto {
  @ApiPropertyOptional({ nullable: true }) ageBandId!: string | null;
  @ApiProperty({ example: 'Adult' }) label!: string;
  @ApiProperty({ example: 2 }) quantity!: number;
}

/**
 * Result of the TYP "Resend email" action.
 *
 * Deliberately carries no recipient: the TYP already shows the address, and
 * echoing it back would turn a @Public endpoint into an address oracle for
 * anyone holding a publicRef.
 */
export class ResendConfirmationResponseDto {
  @ApiProperty({ example: true }) sent!: boolean;
}

/**
 * Body of the tokenized cancellation-request form (master 6.4/C1). The form
 * never cancels anything - it emails the admin, so the only input is the
 * traveller's optional note.
 */
export class RequestCancellationDto {
  @ApiPropertyOptional({
    example: 'Our cruise itinerary changed.',
    description: "Optional 'Anything you'd like us to know?' note",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RequestCancellationResponseDto {
  @ApiProperty({ example: true }) requested!: boolean;
}

/** Thank-you-page payload (TYP route - noindex, no locale prefix). */
export class ThankYouResponseDto {
  @ApiProperty() publicRef!: string;
  @ApiProperty({ example: 'IT-2026-0A1B2C' }) displayRef!: string;
  @ApiProperty({ enum: BookingStatus }) status!: BookingStatus;
  @ApiProperty() tourId!: string;
  @ApiProperty({ example: 'Sunset Catamaran Cruise' }) tourName!: string;
  @ApiPropertyOptional({ nullable: true, example: 'curacao' }) island!:
    | string
    | null;
  // The tour experience time is destination-LOCAL wall-clock. Render it from
  // localDate + startTime/endTime against timeZone. startsAtUtc/endsAtUtc are the
  // only real UTC instants here - use them for ICS/reminders/integrations, never
  // for display. (The old fake-`Z` tourStartDateTime/tourEndDateTime are gone.)
  @ApiProperty({ example: '2026-07-01' }) localDate!: string;
  @ApiPropertyOptional({ nullable: true, example: '09:00' }) startTime!:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true, example: '13:00' }) endTime!:
    | string
    | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'IANA zone localDate/startTime/endTime are expressed in. Render against this; do not parse the local fields as UTC.',
    example: 'America/Curacao',
  })
  timeZone!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Real UTC instant of the local start (integrations/ICS only).',
    example: '2026-07-01T13:00:00.000Z',
  })
  startsAtUtc!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Real UTC instant of the local end (integrations/ICS only).',
    example: '2026-07-01T17:00:00.000Z',
  })
  endsAtUtc!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'Marriott Beach Resort — main lobby',
  })
  pickupAddress!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'True when the traveler asked for pickup at reserve.',
  })
  pickupRequested!: boolean;
  @ApiProperty({ example: 2 }) partySize!: number;
  @ApiProperty({
    type: [ThankYouPartyLineDto],
    description: 'Party grouped by age band (renders "2 adults, 1 child").',
  })
  party!: ThankYouPartyLineDto[];

  // ── Guest (contact snapshot taken at checkout) ──────────────────────────────
  @ApiPropertyOptional({ nullable: true, example: 'Denley' })
  guestFirstName!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'Smith' })
  guestLastName!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'Denley Smith' })
  guestFullName!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'ada@x.io' }) contactEmail!:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true, example: '+5999123456' })
  contactPhone!: string | null;

  // ── Money (charged currency; never the shopper cookie - guide §20.10) ───────
  @ApiProperty({ example: 'EUR' }) currency!: string;
  @ApiProperty({ example: '209.97' }) totalRetail!: string;
  @ApiProperty({
    example: '41.99',
    description: 'Collected by Island Tours up front; "0.00" = nothing online.',
  })
  depositAmount!: string;
  @ApiProperty({
    example: '167.98',
    description: 'Operator-collected remainder; "0.00" = paid in full.',
  })
  balanceAmount!: string;
  @ApiProperty({
    enum: ['OPERATOR_LINK', 'ON_ARRIVAL', 'PAID_IN_FULL', 'OPERATOR_FULL'],
    description:
      'Snapshotted at reserve (rule #21); drives the TYP money copy.',
  })
  paymentModel!: string;
  @ApiPropertyOptional({ nullable: true, example: 'mastercard' })
  paymentMethodBrand!: string | null;
  @ApiPropertyOptional({ nullable: true, example: '4242' })
  paymentMethodLast4!: string | null;

  // ── Tour facts + cancellation window ───────────────────────────────────────
  @ApiPropertyOptional({ nullable: true, example: 540 })
  durationMinutes!: number | null;
  @ApiProperty({
    example: 48,
    description: 'Free-cancellation window in hours (enum-bound; rule #20).',
  })
  cancellationHours!: number;
  @ApiPropertyOptional({
    nullable: true,
    example: '2026-07-01T09:00:00',
    description:
      'Local wall-clock deadline = tour start - cancellationHours. Computed, never stored (guide §14). Render against timeZone.',
  })
  freeCancellationDeadlineLocal!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: '2026-07-01T13:00:00.000Z',
    description: 'Real UTC instant of the deadline (reminders/integrations).',
  })
  freeCancellationDeadlineUtc!: string | null;

  @ApiProperty({ type: ThankYouOperatorDto })
  operator!: ThankYouOperatorDto;

  @ApiPropertyOptional({
    type: BookingConversionDto,
    nullable: true,
    description:
      'Present only for a confirmed booking with a valid EUR commission; null otherwise.',
  })
  conversion!: BookingConversionDto | null;
}

export class BookingResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'IT-2026-0A1B2C' }) displayRef!: string;
  @ApiProperty() publicRef!: string;
  @ApiProperty() tourId!: string;
  @ApiPropertyOptional({ nullable: true }) departureId!: string | null;
  @ApiProperty({ enum: BookingStatus }) status!: BookingStatus;
  @ApiProperty({ example: false }) freesale!: boolean;
  @ApiPropertyOptional({ nullable: true }) utcExpiresAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) utcConfirmedAt!: string | null;
  @ApiProperty({ example: '2026-07-04' }) localDate!: string;
  @ApiPropertyOptional({ nullable: true }) startTime!: string | null;
  @ApiProperty({ enum: ['USD', 'EUR'] }) currency!: string;
  @ApiProperty({ example: '239.97' }) totalRetail!: string;
  @ApiProperty({ example: '47.99' }) depositAmount!: string;
  @ApiProperty({ example: '191.98' }) balanceAmount!: string;
  @ApiPropertyOptional({ example: '0.2000', nullable: true })
  commissionRate!: string | null;
  @ApiPropertyOptional({ example: '47.99', nullable: true })
  commissionAmount!: string | null;
  @ApiProperty({
    enum: ['OPERATOR_LINK', 'ON_ARRIVAL', 'PAID_IN_FULL', 'OPERATOR_FULL'],
  })
  paymentModel!: string;
  @ApiPropertyOptional({ nullable: true })
  cancellationRefund!: CancellationRefund | null;
  @ApiProperty({ type: [BookingUnitItemResponseDto] })
  unitItems!: BookingUnitItemResponseDto[];
}

/** One priced row of a quote breakdown (age-band participants or an add-on). */
export class QuoteLineDto {
  @ApiProperty({ enum: ['participant', 'addon'], example: 'participant' })
  kind!: 'participant' | 'addon';
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Age-band id for a per-person participant line; null otherwise.',
  })
  ageBandId!: string | null;
  @ApiProperty({ example: 'Adult (13+)' }) label!: string;
  @ApiProperty({ example: 2 }) quantity!: number;
  @ApiProperty({ example: '79.99' }) unitPrice!: string;
  @ApiProperty({ example: '159.98' }) lineTotal!: string;
}

/**
 * Server-authoritative price quote (master §5, guide §20.4). A read-only preview
 * with NO side effects (no seat claim, no persistence). The `reserve` endpoint is
 * the authoritative write and recomputes the same math, so a quote is never trusted
 * as the source of truth for a persisted booking.
 *
 * Multi-currency/FX (source vs booking currency conversion) is a later phase; today
 * everything is priced in the tour's default currency, so the `source*` fields equal
 * their booking-currency counterparts and `sourceFxRateToBooking` is always "1".
 */
export class BookingQuoteResponseDto {
  @ApiProperty({
    description:
      'Opaque quote id (informational; not yet persisted/revalidated).',
  })
  quoteId!: string;
  @ApiProperty({
    example: '2026-07-16T12:15:00.000Z',
    description:
      'UTC instant this quote should no longer be trusted for display.',
  })
  expiresAt!: string;
  @ApiProperty({ enum: Currency, description: "The tour's default currency." })
  tourCurrency!: Currency;
  @ApiProperty({
    enum: Currency,
    description:
      'Booking currency (== tourCurrency until FX conversion ships).',
  })
  currency!: Currency;
  @ApiProperty({
    example: '1',
    description: 'Source→booking FX rate (1 for now).',
  })
  sourceFxRateToBooking!: string;
  @ApiPropertyOptional({
    nullable: true,
    example: '1',
    description: 'Booking→EUR FX rate; null when unknown (non-EUR, pre-FX).',
  })
  fxRateToEur!: string | null;
  @ApiProperty({ example: '209.97' }) sourceTotalRetail!: string;
  @ApiProperty({ example: '209.97' }) totalRetail!: string;
  @ApiProperty({ example: '41.99' }) sourceDepositAmount!: string;
  @ApiProperty({ example: '41.99' }) depositAmount!: string;
  @ApiProperty({ example: '167.98' }) sourceBalanceAmount!: string;
  @ApiProperty({ example: '167.98' }) balanceAmount!: string;
  @ApiProperty({
    example: '0.2000',
    description: 'Commission fraction (effective tier + any active Spotlight).',
  })
  commissionRate!: string;
  @ApiPropertyOptional({
    nullable: true,
    example: '41.99',
    description:
      'EUR commission; null when it cannot be resolved (non-EUR, pre-FX).',
  })
  commissionAmount!: string | null;
  @ApiProperty({
    enum: PaymentModel,
    description:
      'Drives which amount is charged today (deposit vs full vs none).',
  })
  paymentModel!: PaymentModel;
  @ApiProperty({ example: 2, description: 'Guest headcount priced.' })
  pax!: number;
  @ApiProperty({ type: [QuoteLineDto] }) lines!: QuoteLineDto[];
}

// ════════════════════════════════════════════════════════════════════════════
// Shared sub-DTOs
// ════════════════════════════════════════════════════════════════════════════

export class ReserveItemDto {
  @ApiProperty({ example: 'age-band-uuid' })
  @IsString()
  ageBandId!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    example: 8,
    description:
      'Traveler age (master child ages); enforced against the tour minimum age.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  travelerAge?: number;
}

export class ReserveAddOnDto {
  @ApiProperty({ example: 'addon-uuid' })
  @IsString()
  addOnId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ContactDto {
  @ApiProperty({ example: 'Ada' })
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiProperty({ example: 'Byron' })
  @IsString()
  @MinLength(1)
  lastName!: string;

  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+12125550100' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '1011' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'CW' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: ['en'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locales?: string[];
}

// ════════════════════════════════════════════════════════════════════════════
// Request DTOs
// ════════════════════════════════════════════════════════════════════════════

export class ReserveBookingDto {
  @ApiPropertyOptional({
    example: 'f8c3de3d-1fea-4d7c-a8b0-29f63c4c3454',
    description: 'Client-supplied id - idempotency key. Generated if omitted.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiProperty({ example: 'departure-uuid' })
  @IsString()
  departureId!: string;

  @ApiPropertyOptional({
    type: [ReserveItemDto],
    description:
      'PER_PERSON tours: one line per age band (required). Omit for UNIT tours - send `guests` instead.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReserveItemDto)
  items?: ReserveItemDto[];

  @ApiPropertyOptional({
    example: 6,
    description:
      'UNIT (whole-unit / charter) tours: total guest headcount (required for UNIT, rejected for PER_PERSON). Drives the charter surcharge and capacity.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  guests?: number;

  @ApiPropertyOptional({
    example: [34, 30, 8],
    description:
      'UNIT tours: optional per-guest ages (enforced against the tour minimum age).',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  travelerAges?: number[];

  @ApiPropertyOptional({ type: [ReserveAddOnDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReserveAddOnDto)
  addOns?: ReserveAddOnDto[];

  @ApiPropertyOptional({
    example: 30,
    description: 'Hold window (default 30, max 60).',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  expirationMinutes?: number;

  @ApiPropertyOptional({ example: 'Honeymoon trip', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  pickupRequested?: boolean;

  @ApiPropertyOptional({ example: 'pickup-uuid' })
  @IsOptional()
  @IsString()
  pickupLocationId?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Figma checkout marketing opt-in ("Send me the good stuff...").',
  })
  @IsOptional()
  @IsBoolean()
  newsletterOptIn?: boolean;

  @ApiPropertyOptional({
    enum: Currency,
    description:
      'Shopper (booking) currency. Defaults to the tour currency. The tour price is converted server-side and snapshotted; the traveler is charged in this currency.',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({
    example: 'quote-uuid',
    description:
      'Server quote id (guide §20.3). Accepted for forward-compat; reserve currently recomputes the quote server-side and is authoritative (quotes are not yet persisted).',
  })
  @IsOptional()
  @IsUUID()
  quoteId?: string;

  // NOTE: couponCode/discountAmount are intentionally NOT accepted (flaw #2). A
  // client-supplied discount is untrusted without a server-side coupon-validation
  // engine; re-add them (validated) when that engine ships.
}

export class QuoteBookingDto {
  @ApiProperty({ example: 'tour-uuid' })
  @IsString()
  tourId!: string;

  @ApiProperty({ example: 'departure-uuid' })
  @IsString()
  departureId!: string;

  @ApiPropertyOptional({
    type: [ReserveItemDto],
    description:
      'PER_PERSON tours: one line per age band (required). Omit for UNIT tours - send `guests` instead.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReserveItemDto)
  items?: ReserveItemDto[];

  @ApiPropertyOptional({
    example: 6,
    description:
      'UNIT (whole-unit / charter) tours: total guest headcount (required for UNIT, rejected for PER_PERSON).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  guests?: number;

  @ApiPropertyOptional({
    example: [34, 30, 8],
    description:
      'UNIT tours: optional per-guest ages (enforced against the tour minimum age).',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  travelerAges?: number[];

  @ApiPropertyOptional({ type: [ReserveAddOnDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReserveAddOnDto)
  addOns?: ReserveAddOnDto[];

  @ApiPropertyOptional({ example: 'pickup-uuid' })
  @IsOptional()
  @IsString()
  pickupLocationId?: string;

  @ApiPropertyOptional({
    enum: Currency,
    description:
      'Shopper currency (forward-compat). Multi-currency conversion is a later phase, so the quote is currently priced in the tour default currency regardless.',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  // NOTE: couponCode intentionally omitted (flaw #2) - discount preview waits for a
  // server-side coupon-validation engine.
}

export class ConfirmBookingDto {
  @ApiProperty({ type: ContactDto })
  @ValidateNested()
  @Type(() => ContactDto)
  contact!: ContactDto;

  @ApiPropertyOptional({ example: 'IT-RES-0042' })
  @IsOptional()
  @IsString()
  resellerReference?: string;

  @ApiPropertyOptional({ example: 'Please seat us together', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'Customer requested' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Override the cancellation-window refund policy (admin/operator).',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiPropertyOptional({
    example: '2026-06-28T14:03:00.000Z',
    description:
      'UTC instant the traveler requested cancellation. Refund eligibility is judged at this instant, not the (possibly later) admin action time. Defaults to any prior request stamp, else now.',
  })
  @IsOptional()
  @IsDateString()
  requestedAt?: string;
}

export class ExtendBookingDto {
  @ApiPropertyOptional({
    example: 30,
    description: 'New hold window (default 30, max 60).',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  expirationMinutes?: number;
}

export class UpdateBookingDto {
  @ApiPropertyOptional({ type: ContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  contact?: ContactDto;

  @ApiPropertyOptional({ example: 'Updated note', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  pickupRequested?: boolean;

  @ApiPropertyOptional({ example: 'pickup-uuid' })
  @IsOptional()
  @IsString()
  pickupLocationId?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Query DTOs
// ════════════════════════════════════════════════════════════════════════════

export class ListBookingsQueryDto {
  @ApiPropertyOptional({ example: 'tour-uuid' })
  @IsOptional()
  @IsString()
  tourId?: string;

  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsLocalDate()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsLocalDate()
  to?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// Re-export for service typing convenience.
export type { CancelledBy };
