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

export function tripToUpdatePayload(trip: TripListItem): UpdateTripPayload {
    return {
        name: trip.name,
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
        instantConfirmation: trip.instantConfirmation,

        minPartySize: trip.minPartySize,
        maxPartySize: trip.maxPartySize ?? undefined,
        bookingCutoffMinutes: trip.bookingCutoffMinutes,
        cancellationHours: trip.cancellationHours,
        checkInMinutesBefore: trip.checkInMinutesBefore ?? undefined,

        departureCity: trip.departureCity ?? undefined,
        meetingPointLat: trip.meetingPointLat ?? undefined,
        meetingPointLng: trip.meetingPointLng ?? undefined,

        minAgeYears: trip.minAgeYears ?? undefined,
        fitnessLevel: trip.fitnessLevel ?? undefined,
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

        isActive: trip.isActive,
    };
}
