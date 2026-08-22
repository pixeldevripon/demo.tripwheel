/**
 * Trip-core PATCH pass-through (07 §11 step 3).
 *
 * THE safety mechanism of the wizard split. The old Details tab was one form
 * that sent all ~37 trip-core keys on every save. The wizard splits those
 * fields across steps 3, 5 and the step 7 advanced card - so each of those
 * steps must still send the SAME body, with only its own fields differing.
 *
 * `tripToUpdatePayload(trip)` rebuilds that exact body from the loaded trip;
 * a step then spreads its own values over it:
 *
 *   updateTrip({ id, payload: { ...tripToUpdatePayload(trip), maxPartySize } })
 *
 * Why not send a partial PATCH instead? Because "which keys may be omitted" is
 * a backend contract this redesign is not allowed to probe. Byte-identical
 * bodies mean the split cannot change behaviour, full stop. It also removes
 * the whole class of bug where a field silently reverts because the step that
 * now owns it was never opened.
 *
 * The key list mirrors `TripDetailsTab.onSubmit` exactly. Pricing keys are
 * deliberately absent - they were never in that form and belong to the pricing
 * step's own save. Do not add them here.
 */

import type { TripListItem, UpdateTripPayload } from '@/types/trip';

/**
 * "The operator emptied this box" - as the backend understands it.
 *
 * A form field is `''` when cleared, and the obvious `value || undefined` is
 * WRONG: `JSON.stringify` drops undefined keys, and the backend writes every
 * column behind `dto.x !== undefined`, so the clear never reaches the database.
 * The step then refetches, `toDefaults(trip)` reads the unchanged value back,
 * and the box the operator just emptied refills itself - after the footer said
 * "All changes saved".
 *
 * `null` is the clear. Both helpers are typed to return it explicitly so the
 * intent survives the next edit.
 *
 * Both accept a number as well as a string, and MUST keep doing so. Every step
 * declares its form values as all-strings and then casts the resolver
 * (`zodResolver(schema) as unknown as Resolver<Values>`), but zod hands the
 * submit handler its PARSED output - so a `z.coerce.number()` field arrives
 * here as a number while TypeScript still believes it is a string. The cast
 * means tsc cannot catch it; a string-only helper crashes at runtime with
 * "value?.trim is not a function".
 */
export function blankToNull(
    value: string | number | null | undefined,
): string | null {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
}

/** As `blankToNull`, for a numeric field the form holds as text. */
export function numberOrNull(
    value: string | number | null | undefined,
): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (value == null) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
}

export function tripToUpdatePayload(trip: TripListItem): UpdateTripPayload {
    return {
        // `name` is deliberately ABSENT: only the Basics step owns the title
        // and sets it explicitly. Every other step spreading this payload
        // used to resend the cached name, and on a LIVE tour a stale cache
        // (the refetch window right after a gated title save) resent the OLD
        // live title - which the backend's withdraw-on-live-retype heuristic
        // read as the operator reverting, silently discarding the held title
        // (code-review CRITICAL, UX round 3).
        slug: trip.slug,
        categoryIds: trip.categoryIds,
        primaryCategoryId: trip.primaryCategoryId ?? trip.categoryIds[0],
        hubIds: trip.hubIds,

        durationMinutesFrom: trip.durationMinutesFrom ?? undefined,
        durationMinutesTo: trip.durationMinutesTo ?? undefined,

        pickupModel: trip.pickupModel,
        pickupRequired: trip.pickupRequired,
        bookingType: trip.bookingType ?? undefined,

        paymentModel: trip.paymentModel,
        onArrivalPayment: trip.onArrivalPayment,
        // `instantConfirmation` is gone on purpose (client review comment 22):
        // the checkbox is removed - every tour IS instant confirmation - and
        // the backend dropped the key from UpdateTourDto, so sending it now
        // 400s the whole save via forbidNonWhitelisted (the isActive class of
        // breakage, see below).

        minPartySize: trip.minPartySize,
        // NOT NULL since 20260729190000 - no `?? undefined` to write around.
        maxPartySize: trip.maxPartySize,
        bookingCutoffMinutes: trip.bookingCutoffMinutes,
        cancellationHours: trip.cancellationHours,
        checkInMinutesBefore: trip.checkInMinutesBefore ?? undefined,

        departureCity: trip.departureCity ?? undefined,
        meetingPointLat: trip.meetingPointLat ?? undefined,
        meetingPointLng: trip.meetingPointLng ?? undefined,

        minAgeYears: trip.minAgeYears ?? undefined,
        fitnessLevel: trip.fitnessLevel ?? undefined,
        // `?? undefined` (drop the key) rather than a hard false while the
        // backend may not serve the column yet - never write a default over
        // a value this client cannot see.
        sleepAboard: trip.sleepAboard ?? undefined,
        weatherDependent: trip.weatherDependent,
        wheelchairAccessible: trip.wheelchairAccessible,
        familyFriendly: trip.familyFriendly,
        suitableForBeginners: trip.suitableForBeginners,

        // Nullable strings: the old form sent `value || null`, so an emptied
        // field clears rather than being left untouched. Preserved verbatim.
        reference: trip.reference ?? null,
        h1Override: trip.h1Override ?? null,
        breadcrumbLabel: trip.breadcrumbLabel ?? null,

        availabilityType: trip.availabilityType,
        redemptionMethod: trip.redemptionMethod,
        instantDelivery: trip.instantDelivery,
        availabilityRequired: trip.availabilityRequired,
        allowFreesale: trip.allowFreesale,
        deliveryFormats: trip.deliveryFormats,
        deliveryMethods: trip.deliveryMethods,

        // NOT `isActive`. The backend dropped it from UpdateTourDto (audit
        // 2026-08-02 P0) because visibility has two purpose-built verbs -
        // POST /tours/:id/pause and /archive - that flip the slug_registry row
        // in the SAME transaction. A bare PATCH skipped that, so the tour left
        // the listings while the registry still advertised its slug. Sending
        // the key now trips `forbidNonWhitelisted` and 400s the whole save
        // with "property isActive should not exist" - which is how this was
        // found: every step that spreads this payload broke at once.
    };
}
