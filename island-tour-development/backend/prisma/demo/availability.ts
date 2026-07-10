// DEMO SEED — availability schedules, a few date exceptions, and materialized
// departures (the bookable inventory) for the next 60 days. Bookings claim seats
// against these departures.

import {
  AvailabilityExceptionType,
  AvailabilityScheduleStatus,
  DepartureSource,
  DepartureStatus,
  Prisma,
} from '@prisma/client';
import {
  DEMO_TOUR_REF,
  dayOffset,
  isoWeekday,
  log,
  prisma,
  section,
  timeOf,
  today,
} from './_shared';

const HORIZON_DAYS = 60;
const PAST_DAYS = 45; // also materialize recent past so completed bookings + reviews have real departures

export async function seedAvailability(): Promise<void> {
  section('Availability + departures');

  const tours = await prisma.tour.findMany({
    where: { reference: DEMO_TOUR_REF },
    select: { id: true, slug: true, startTimes: true, maxPartySize: true },
  });
  if (tours.length === 0) {
    log('No demo tours found — skipping availability.');
    return;
  }
  // Per-tour idempotency: seed only tours that have no schedule yet, so demo
  // tours added in a later seed pass (e.g. a hub's tours) still get availability.
  // A global "any exist -> skip all" guard would starve them. `:clean` wipes
  // everything for a full rebuild.
  const seededTourIds = new Set(
    (
      await prisma.availabilitySchedule.findMany({
        where: { tour: { reference: DEMO_TOUR_REF } },
        select: { tourId: true },
        distinct: ['tourId'],
      })
    ).map((s) => s.tourId),
  );
  const pending = tours.filter((t) => !seededTourIds.has(t.id));
  if (pending.length === 0) {
    log('Availability already seeded for all demo tours — skipping.');
    return;
  }

  let schedRows = 0;
  let exceptionRows = 0;
  let departureRows = 0;

  for (const [idx, tour] of pending.entries()) {
    const capacity = tour.maxPartySize ?? 20;
    const startTimes = tour.startTimes.length ? tour.startTimes : ['09:00'];
    // Most tours run all week; close one weekday on every 3rd tour for variety.
    const closedWeekday = idx % 3 === 0 ? idx % 7 : -1;
    const weekdays = [0, 1, 2, 3, 4, 5, 6].filter((w) => w !== closedWeekday);
    const validFrom = today();

    // Schedules: one row per weekday × startTime.
    const scheduleData: Prisma.AvailabilityScheduleCreateManyInput[] = [];
    for (const w of weekdays) {
      for (const st of startTimes) {
        scheduleData.push({
          tourId: tour.id,
          weekday: w,
          startTime: timeOf(st),
          capacityOverride: null,
          validFrom,
          validUntil: null,
          status: AvailabilityScheduleStatus.ACTIVE,
        });
      }
    }
    const sched = await prisma.availabilitySchedule.createMany({
      data: scheduleData,
      skipDuplicates: true,
    });
    schedRows += sched.count;

    // Exceptions: a CLOSE_DATE (maintenance) + a SET_CAPACITY (reduced) on a couple of tours.
    const closeDateOffset = 10 + (idx % 14); // some day inside the horizon
    const capDateOffset = 5 + (idx % 9);
    const exceptions: Prisma.AvailabilityExceptionCreateManyInput[] = [];
    if (idx % 4 === 0) {
      exceptions.push({
        tourId: tour.id,
        date: dayOffset(closeDateOffset),
        startTime: null,
        type: AvailabilityExceptionType.CLOSE_DATE,
        capacity: null,
        note: 'Annual maintenance / crew day off',
      });
    }
    if (idx % 5 === 0) {
      exceptions.push({
        tourId: tour.id,
        date: dayOffset(capDateOffset),
        startTime: timeOf(startTimes[0]),
        type: AvailabilityExceptionType.SET_CAPACITY,
        capacity: Math.max(2, Math.floor(capacity / 2)),
        note: 'Reduced capacity (second boat in service)',
      });
    }
    if (exceptions.length) {
      const ex = await prisma.availabilityException.createMany({
        data: exceptions,
        skipDuplicates: true,
      });
      exceptionRows += ex.count;
    }
    const closedDates = new Set(
      exceptions
        .filter((e) => e.type === AvailabilityExceptionType.CLOSE_DATE)
        .map((e) => (e.date as Date).getTime()),
    );
    const capOverrides = new Map(
      exceptions
        .filter(
          (e) =>
            e.type === AvailabilityExceptionType.SET_CAPACITY &&
            e.capacity != null,
        )
        .map((e) => [`${(e.date as Date).getTime()}`, e.capacity as number]),
    );

    // Materialize departures for the horizon.
    const departureData: Prisma.DepartureCreateManyInput[] = [];
    for (let d = -PAST_DAYS; d <= HORIZON_DAYS; d++) {
      if (d === 0) continue;
      const date = dayOffset(d);
      if (closedDates.has(date.getTime())) continue;
      const wd = isoWeekday(date);
      if (!weekdays.includes(wd)) continue;
      for (const st of startTimes) {
        const cap = capOverrides.get(`${date.getTime()}`) ?? capacity;
        departureData.push({
          tourId: tour.id,
          date,
          startTime: timeOf(st),
          capacity: cap,
          bookedCount: 0,
          status: DepartureStatus.OPEN,
          source: DepartureSource.SCHEDULE,
        });
      }
    }
    if (departureData.length) {
      const dep = await prisma.departure.createMany({
        data: departureData,
        skipDuplicates: true,
      });
      departureRows += dep.count;
    }

    await prisma.tour.update({
      where: { id: tour.id },
      data: {
        isBookable: true,
        availabilityConfirmedAt: new Date(),
        spotsRemaining: capacity,
      },
    });
  }

  log(
    `Availability: ${schedRows} schedules, ${exceptionRows} exceptions, ${departureRows} departures across ${pending.length} tours.`,
  );
}
