import { AvailabilityAgenda } from '@/components/availability/availability-agenda';

/**
 * Surface B (matrix v1.6, availability review §3.3): the cross-tour daily
 * agenda - the operator's habit surface. Per-tour setup (timetable, calendar,
 * date changes) stays on the tour's own Schedules step.
 */
export default function AvailabilityPage() {
    return (
        <div className=''>
            <div className='mb-6'>
                <h1 className='text-2xl font-medium'>Availability</h1>
                <p className='text-sm text-muted-foreground mt-1'>
                    Every departure across your tours, today first. Counts
                    show Island Tours bookings only - full through another
                    channel? Close the departure here (booked guests always
                    keep their bookings). Timetable setup lives on each tour.
                </p>
            </div>
            <AvailabilityAgenda />
        </div>
    );
}
