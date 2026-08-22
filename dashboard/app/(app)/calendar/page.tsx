import { GlobalCalendar } from '@/components/calendar/global-calendar';

/**
 * The global availability calendar: every departure across every tour (for
 * admins, every operator) on one full-width Month/Week/Day grid, with the
 * management actions - close/reopen, capacity, extra departures, weekly
 * schedules - inline. The calendar owns its own toolbar, so the page adds no
 * heading of its own. The agenda LIST view of the same data stays at
 * /availability; per-tour timetable setup remains on the tour's Schedule step.
 */
export default function CalendarPage() {
    return <GlobalCalendar />;
}
