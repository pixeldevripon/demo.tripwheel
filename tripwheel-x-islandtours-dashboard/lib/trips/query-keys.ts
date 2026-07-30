/**
 * Trip query-key factory (D4: shared key factories live in lib/, so other
 * hook domains - locals-favourites, tiers - can invalidate trip queries
 * without importing another hook domain). hooks/trips re-exports it, so
 * existing `tripKeys` imports from there keep working.
 */
import type {
  AdminTripsQueryParams,
  AvailabilityOverviewParams,
  MyTripsQueryParams,
} from '@/types/trip';

export const tripKeys = {
  all: ['trips'] as const,
  myTrips: (params: MyTripsQueryParams) => [...tripKeys.all, 'my-trips', params] as const,
  adminTrips: (params: AdminTripsQueryParams) => [...tripKeys.all, 'admin-all', params] as const,
  details: () => [...tripKeys.all, 'detail'] as const,
  detail: (id: string) => [...tripKeys.details(), id] as const,
  images: (tripId: string) => [...tripKeys.all, 'images', tripId] as const,
  addOns: (tripId: string) => [...tripKeys.all, 'addons', tripId] as const,
  ageBands: (tripId: string) => [...tripKeys.all, 'age-bands', tripId] as const,
  languages: (tripId: string) => [...tripKeys.all, 'languages', tripId] as const,
  highlights: (tripId: string) => [...tripKeys.all, 'highlights', tripId] as const,
  inclusions: (tripId: string) => [...tripKeys.all, 'inclusions', tripId] as const,
  exclusions: (tripId: string) => [...tripKeys.all, 'exclusions', tripId] as const,
  features: (tripId: string) => [...tripKeys.all, 'features', tripId] as const,
  locations: (tripId: string) => [...tripKeys.all, 'locations', tripId] as const,
  pickupLocations: (tripId: string) => [...tripKeys.all, 'pickup-locations', tripId] as const,
  translations: (tripId: string) => [...tripKeys.all, 'translations', tripId] as const,
  translationByLocale: (tripId: string, locale: string) => [...tripKeys.translations(tripId), locale] as const,
  schedules: (tripId: string) => [...tripKeys.all, 'schedules', tripId] as const,
  exceptions: (tripId: string) => [...tripKeys.all, 'exceptions', tripId] as const,
  // Month-keyed; invalidate with the tripId prefix so every cached month drops.
  manageCalendarAll: (tripId: string) => [...tripKeys.all, 'manage-calendar', tripId] as const,
  manageCalendar: (tripId: string, month: string) =>
    [...tripKeys.manageCalendarAll(tripId), month] as const,
  // F13 status line (next departure + 30-day open count).
  availabilitySummary: (tripId: string) =>
    [...tripKeys.all, 'availability-summary', tripId] as const,
  // Surface B: the cross-tour daily agenda (keyed by window).
  agendaAll: () => [...tripKeys.all, 'agenda'] as const,
  agenda: (from: string | undefined, days: number) =>
    [...tripKeys.agendaAll(), from ?? 'today', days] as const,
  // Global calendar overview (keyed by window + filters). Every availability
  // mutation invalidates the prefix - the grid spans ALL tours.
  overviewAll: () => [...tripKeys.all, 'overview'] as const,
  overview: (params: AvailabilityOverviewParams) =>
    [...tripKeys.overviewAll(), params] as const,
};
