'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { toast } from 'sonner';
import { addMonths, format, startOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useCreateException,
  useManageCalendar,
  useRemoveException,
} from '@/hooks/trips/use-trips';
import type {
  ManageCalendarDay,
  ManageCalendarDayStatus,
  TourDeparture,
} from '@/types/trip';

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const STATUS_LABEL: Record<ManageCalendarDayStatus, string> = {
  open: 'Open',
  partial: 'Partially closed',
  closed: 'Closed',
  no_service: 'No departures',
};

interface TripAvailabilityCalendarProps {
  tripId: string;
  /** Tour-local IANA zone - "today"/"past" must follow the ISLAND's clock. */
  timeZone: string;
  /** Tour default capacity; null = ADD_SLOT needs an explicit capacity. */
  maxPartySize: number | null;
  /** The tour's declared start times - offered as one-tap chips when adding
      an extra departure (typing stays possible for a brand-new time). */
  declaredStartTimes: string[];
}

/**
 * One-tap availability layer over the schedules/exceptions system: a month
 * grid where the daily operational actions (close a day, close a slot, add a
 * departure, change capacity, reopen) are each one or two taps, instead of the
 * multi-step Date Exceptions form kept below for planned work. Every action is
 * an ordinary exception write - no new mutation surface. Days with booked
 * seats require a confirming tap before a close (it cancels their departures).
 */
export function TripAvailabilityCalendar({
  tripId,
  timeZone,
  maxPartySize,
  declaredStartTimes,
}: TripAvailabilityCalendarProps) {
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const month = format(monthDate, 'yyyy-MM');
  const { data: days, isLoading, isFetching } = useManageCalendar(tripId, month);
  const [openDate, setOpenDate] = useState<string | null>(null);

  // 'en-CA' renders YYYY-MM-DD directly; computed in the TOUR's zone so an
  // operator in Europe can still close the island's "today" after midnight CET.
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  const canGoPrev = month > todayKey.slice(0, 7);

  // Monday-first offset of the month's first day (getDay(): 0=Sunday).
  const leadingBlanks = (monthDate.getDay() + 6) % 7;
  // Blank math uses the MONTH's own length, and cells only render rows that
  // belong to it: with placeholderData the previous month's rows linger while
  // the next streams in, and rendering them under the new month's weekday
  // offset would misalign the whole grid for that window.
  const daysInMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  ).getDate();
  const monthDays = (days ?? []).filter((d) => d.date.startsWith(month));
  const trailingBlanks = (7 - ((leadingBlanks + daysInMonth) % 7)) % 7;

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold">Availability</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Tap a day to close it, reopen it, adjust capacity or add a departure.
            </p>
          </div>
          <div className="flex items-center">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setMonthDate((m) => addMonths(m, -1))}
              disabled={!canGoPrev}
              aria-label="Previous month"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            </Button>
            <span className="min-w-32 text-center text-sm font-medium tabular-nums">
              {format(monthDate, 'MMMM yyyy')}
              {isFetching && !isLoading && (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="ml-1.5 inline size-3 animate-spin text-muted-foreground"
                />
              )}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setMonthDate((m) => addMonths(m, 1))}
              aria-label="Next month"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-3">
        {isLoading ? (
          <Skeleton className="h-96 w-full rounded-lg" />
        ) : (
          <>
            {/* Hairline grid: gap-px over the border color reads as ruled
                lines - calmer than a box around every day. */}
            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-7 gap-px bg-border/70">
                {WEEKDAY_HEADERS.map((h) => (
                  <div
                    key={h}
                    className="bg-muted/50 py-2 text-center text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </div>
                ))}
                {Array.from({ length: leadingBlanks }).map((_, i) => (
                  <div key={`lead-${i}`} aria-hidden="true" className="bg-card" />
                ))}
                {monthDays.length > 0
                  ? monthDays.map((day) => (
                      <DayCell
                        key={day.date}
                        day={day}
                        isPast={day.date < todayKey}
                        isToday={day.date === todayKey}
                        open={openDate === day.date}
                        onOpenChange={(next) =>
                          setOpenDate(next ? day.date : null)
                        }
                        tripId={tripId}
                        maxPartySize={maxPartySize}
                        declaredStartTimes={declaredStartTimes}
                      />
                    ))
                  : /* Streaming a fresh month: quiet numbered placeholders keep
                       the grid's height and alignment stable. */
                    Array.from({ length: daysInMonth }).map((_, i) => (
                      <div
                        key={`ph-${i}`}
                        className="h-16 bg-card p-1.5 text-xs tabular-nums leading-none text-muted-foreground/40"
                      >
                        {i + 1}
                      </div>
                    ))}
                {Array.from({ length: trailingBlanks }).map((_, i) => (
                  <div key={`trail-${i}`} aria-hidden="true" className="bg-card" />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-success-solid" />
                open departure
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-warning-subtle ring-1 ring-warning-border" />
                partially closed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-destructive/15 ring-1 ring-destructive/30" />
                closed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="rounded-sm bg-primary-subtle px-1 py-px text-2xs font-semibold text-primary-subtle-content">
                  3 booked
                </span>
                seats sold on that day
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Day cell ──────────────────────────────────────────────────────────────────

interface DayCellProps {
  tripId: string;
  day: ManageCalendarDay;
  isPast: boolean;
  isToday: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxPartySize: number | null;
  declaredStartTimes: string[];
}

function DayCell({
  tripId,
  day,
  isPast,
  isToday,
  open,
  onOpenChange,
  maxPartySize,
  declaredStartTimes,
}: DayCellProps) {
  const dayNum = Number(day.date.slice(8, 10));
  // `scheduled` keeps not-yet-materialized pattern days actionable, so an
  // operator can pre-close a date months out before the nightly sync fills it.
  const actionable =
    !isPast && (day.departures.length > 0 || day.exceptions.length > 0 || day.scheduled);
  const offDay = day.status === 'no_service' && !day.scheduled;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <button
          type="button"
          disabled={!actionable}
          onClick={() => onOpenChange(!open)}
          aria-label={`${day.date} - ${STATUS_LABEL[day.status]}`}
          className={cn(
            'relative flex h-16 flex-col items-start justify-between p-1.5 text-left transition-colors',
            // Base surface per state. Past days are always neutral: their
            // departures fold to CLOSED after the cutoff, and painting
            // history red is pure noise. Off days stay on the plain surface
            // (a muted wash per weekday column read as a broken grid).
            isPast
              ? 'bg-muted/40'
              : day.status === 'closed'
                ? 'bg-destructive/10 hover:bg-destructive/15'
                : day.status === 'partial'
                  ? 'bg-warning-subtle hover:bg-warning-subtle/80'
                  : 'bg-card',
            actionable && 'cursor-pointer',
            actionable &&
              day.status !== 'closed' &&
              day.status !== 'partial' &&
              'hover:bg-muted/60',
            open && 'ring-2 ring-inset ring-foreground/30',
          )}
        >
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                'text-xs tabular-nums leading-none',
                isPast || offDay ? 'text-muted-foreground/50' : 'font-medium',
                isToday &&
                  'grid size-5 -m-0.5 place-items-center rounded-full bg-foreground font-semibold text-background',
                !isPast &&
                  !isToday &&
                  day.status === 'closed' &&
                  'text-destructive',
              )}
            >
              {dayNum}
            </span>
            {/* Explicit state words - a tint alone is easy to miss. */}
            {!isPast && day.status === 'closed' && (
              <span className="text-2xs font-semibold uppercase leading-none text-destructive">
                Closed
              </span>
            )}
            {!isPast && day.status === 'partial' && (
              <span className="text-2xs font-semibold uppercase leading-none text-warning-fg">
                Partial
              </span>
            )}
          </span>
          <span className="flex w-full items-end justify-between gap-1">
            {day.departures.length > 0 ? (
              <span className="flex items-center gap-0.5">
                {day.departures.slice(0, 3).map((d) => (
                  <span
                    key={d.id}
                    className={cn(
                      'size-1.5 rounded-full',
                      isPast
                        ? 'bg-foreground/20'
                        : d.status === 'OPEN' || d.status === 'SOLD_OUT'
                          ? 'bg-success-solid'
                          : 'bg-destructive/50',
                    )}
                  />
                ))}
                {day.departures.length > 3 && (
                  <span className="text-2xs leading-none text-muted-foreground">
                    +{day.departures.length - 3}
                  </span>
                )}
              </span>
            ) : day.scheduled && !isPast ? (
              /* Pattern covers this day but the engine hasn't filled it yet -
                 hollow dots, one per upcoming pattern time. */
              <span className="flex items-center gap-0.5">
                {day.scheduledTimes.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="size-1.5 rounded-full ring-1 ring-success-solid/60"
                  />
                ))}
                {day.scheduledTimes.length > 3 && (
                  <span className="text-2xs leading-none text-muted-foreground">
                    +{day.scheduledTimes.length - 3}
                  </span>
                )}
              </span>
            ) : (
              <span />
            )}
            {day.bookedTotal > 0 && (
              <span
                className={cn(
                  'whitespace-nowrap rounded-sm px-1 py-px text-2xs font-semibold tabular-nums leading-none',
                  isPast
                    ? 'text-muted-foreground/60'
                    : 'bg-primary-subtle text-primary-subtle-content',
                )}
              >
                {day.bookedTotal} booked
              </span>
            )}
          </span>
        </button>
      </PopoverAnchor>
      {open && (
        <DayPopover
          tripId={tripId}
          day={day}
          maxPartySize={maxPartySize}
          declaredStartTimes={declaredStartTimes}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Popover>
  );
}

// ── Day popover: every exception type, one or two taps ───────────────────────

type PanelState =
  | { kind: 'none' }
  | { kind: 'close-day' }
  | { kind: 'add-slot' }
  | { kind: 'day-capacity' }
  | { kind: 'slot-capacity'; startTime: string };

interface DayPopoverProps {
  tripId: string;
  day: ManageCalendarDay;
  maxPartySize: number | null;
  declaredStartTimes: string[];
  onClose: () => void;
}

function DayPopover({
  tripId,
  day,
  maxPartySize,
  declaredStartTimes,
  onClose,
}: DayPopoverProps) {
  const { mutate: createException, isPending: isWriting } = useCreateException();
  const { mutate: removeException, isPending: isRemoving } = useRemoveException();
  const [panel, setPanel] = useState<PanelState>({ kind: 'none' });
  const [note, setNote] = useState('');
  const [timeDraft, setTimeDraft] = useState('');
  const [capDraft, setCapDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const busy = isWriting || isRemoving;
  const closeDateException = day.exceptions.find((e) => e.type === 'CLOSE_DATE');
  const dayCapacityException = day.exceptions.find(
    (e) => e.type === 'SET_CAPACITY' && e.startTime === null,
  );
  const slotException = (type: 'CLOSE_SLOT' | 'SET_CAPACITY', startTime: string) =>
    day.exceptions.find((e) => e.type === type && e.startTime === startTime);

  // A background refetch can change the day under an open panel (another tab,
  // an admin, the plain exceptions form). Drop a panel its anchor no longer
  // supports so a stale draft can never submit against vanished state
  // (render-time reference-guarded reset, per repo convention).
  const panelStale =
    (closeDateException && panel.kind !== 'none') ||
    (panel.kind === 'slot-capacity' &&
      !day.departures.some((d) => d.startTime === panel.startTime));
  if (panelStale) {
    setPanel({ kind: 'none' });
    setError(null);
    setCapDraft('');
    setTimeDraft('');
    setNote('');
  }

  function openPanel(next: PanelState) {
    setPanel(next);
    setError(null);
    setCapDraft('');
    setTimeDraft('');
    setNote('');
  }

  function write(
    payload: Parameters<typeof createException>[0]['payload'],
    successMsg: string,
  ) {
    createException(
      { tripId, payload },
      {
        onSuccess: () => {
          toast.success(successMsg);
          onClose();
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'The change failed.'),
      },
    );
  }

  function reopen(exceptionId: string, successMsg: string) {
    removeException(
      { tripId, exceptionId },
      {
        onSuccess: () => {
          toast.success(successMsg);
          onClose();
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'The change failed.'),
      },
    );
  }

  function submitPanel() {
    setError(null);
    if (panel.kind === 'close-day') {
      write(
        { date: day.date, type: 'CLOSE_DATE', note: note.trim() || undefined },
        `Closed ${formatDayLong(day.date)}.`,
      );
      return;
    }
    const cap = capDraft.trim() ? Number(capDraft) : undefined;
    if (cap !== undefined && (!Number.isInteger(cap) || cap < 0)) {
      setError('Capacity must be a whole number.');
      return;
    }
    if (panel.kind === 'add-slot') {
      if (!HHMM.test(timeDraft.trim())) {
        setError('Time must be HH:MM, e.g. 14:30.');
        return;
      }
      if (cap === undefined && maxPartySize == null) {
        setError('This tour has no Max Party Size - enter a capacity.');
        return;
      }
      // A 0-seat extra departure would materialize permanently sold out.
      if (cap !== undefined && cap < 1) {
        setError('An extra departure needs at least 1 seat.');
        return;
      }
      write(
        {
          date: day.date,
          type: 'ADD_SLOT',
          startTime: timeDraft.trim(),
          capacity: cap,
          note: note.trim() || undefined,
        },
        `Added a ${timeDraft.trim()} departure.`,
      );
      return;
    }
    // day-capacity / slot-capacity
    if (cap === undefined) {
      setError('Enter the new capacity.');
      return;
    }
    const startTime = panel.kind === 'slot-capacity' ? panel.startTime : undefined;
    write(
      {
        date: day.date,
        type: 'SET_CAPACITY',
        startTime,
        capacity: cap,
        note: note.trim() || undefined,
      },
      startTime
        ? `Capacity for ${startTime} set to ${cap}.`
        : `Day capacity set to ${cap}.`,
    );
  }

  const needsBookedConfirm = panel.kind === 'close-day' && day.bookedTotal > 0;

  return (
    <PopoverContent align="start" sideOffset={6} className="w-80 p-0">
      <div className="flex items-baseline justify-between gap-2 border-b px-4 py-3">
        <p className="text-sm font-semibold">{formatDayLong(day.date)}</p>
        <p className="text-xs text-muted-foreground">
          {STATUS_LABEL[day.status]}
          {day.bookedTotal > 0 && ` · ${day.bookedTotal} booked`}
        </p>
      </div>

      {/* Whole-day capacity override in force */}
      {dayCapacityException && (
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
          <span className="text-xs text-muted-foreground">
            Day capacity override:{' '}
            <span className="font-semibold text-foreground">
              {dayCapacityException.capacity}
            </span>
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={busy}
            aria-label="Remove day capacity override"
            onClick={() => reopen(dayCapacityException.id, 'Capacity override removed.')}
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Not materialized yet: show what the weekly pattern WILL run on this
          date, so a far-future day never reads as empty (and adding one
          departure doesn't look like it conjured the others). */}
      {day.departures.length === 0 && day.scheduledTimes.length > 0 && (
        <div className="px-4 py-2.5 space-y-1.5">
          {day.scheduledTimes.map((t) => (
            <div key={t} className="flex h-7 items-center gap-2">
              <span className="size-1.5 shrink-0 rounded-full ring-1 ring-success-solid/60" />
              <span className="text-sm font-medium tabular-nums">{t}</span>
              <span className="text-xs text-muted-foreground">
                weekly pattern · opens for sale closer to the date
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Slots */}
      {day.departures.length > 0 && (
        <div className="max-h-52 overflow-y-auto px-4 py-2.5 space-y-1.5">
          {day.departures.map((d) => (
            <SlotRow
              key={d.id}
              departure={d}
              dayClosed={!!closeDateException}
              closeException={slotException('CLOSE_SLOT', d.startTime)}
              capacityException={slotException('SET_CAPACITY', d.startTime)}
              busy={busy}
              onCloseSlot={() =>
                write(
                  { date: day.date, type: 'CLOSE_SLOT', startTime: d.startTime },
                  `Closed the ${d.startTime} departure.`,
                )
              }
              onReopenSlot={(id) => reopen(id, `Reopened the ${d.startTime} departure.`)}
              onEditCapacity={() =>
                openPanel({ kind: 'slot-capacity', startTime: d.startTime })
              }
              onRemoveCapacity={(id) => reopen(id, 'Capacity override removed.')}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="border-t px-4 py-3 space-y-2">
        {closeDateException ? (
          <>
            {closeDateException.note && (
              <p className="text-xs text-muted-foreground truncate">
                {closeDateException.note}
              </p>
            )}
            <Button
              size="sm"
              className="w-full"
              disabled={busy}
              onClick={() =>
                reopen(closeDateException.id, `Reopened ${formatDayLong(day.date)}.`)
              }
            >
              {isRemoving && (
                <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
              )}
              Reopen this day
            </Button>
          </>
        ) : panel.kind === 'none' ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => openPanel({ kind: 'add-slot' })}
            >
              Add departure
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => openPanel({ kind: 'day-capacity' })}
            >
              Day capacity
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="col-span-2"
              disabled={busy}
              onClick={() => openPanel({ kind: 'close-day' })}
            >
              Close entire day
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {panel.kind === 'add-slot' && (
              <>
                {(() => {
                  // Declared times the day does not already run - one-tap
                  // picks; the free input stays for a brand-new time.
                  const taken = new Set([
                    ...day.departures.map((d) => d.startTime),
                    ...day.scheduledTimes,
                  ]);
                  const quickTimes = declaredStartTimes.filter(
                    (t) => !taken.has(t),
                  );
                  return quickTimes.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {quickTimes.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTimeDraft(t)}
                          className={cn(
                            'h-7 rounded-md border px-2 text-xs font-medium tabular-nums transition-colors',
                            timeDraft === t
                              ? 'border-foreground bg-foreground text-background'
                              : 'border-input hover:bg-muted',
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
                <div className="flex gap-2">
                  <Input
                    value={timeDraft}
                    onChange={(e) => setTimeDraft(e.target.value)}
                    placeholder="HH:MM"
                    inputMode="numeric"
                    className="h-8 w-24 text-xs tabular-nums"
                  />
                  <Input
                    value={capDraft}
                    onChange={(e) => setCapDraft(e.target.value)}
                    type="number"
                    min={1}
                    placeholder={
                      maxPartySize != null ? `Seats (${maxPartySize})` : 'Seats'
                    }
                    className="h-8 flex-1 text-xs"
                  />
                </div>
              </>
            )}
            {(panel.kind === 'day-capacity' || panel.kind === 'slot-capacity') && (
              <Input
                value={capDraft}
                onChange={(e) => setCapDraft(e.target.value)}
                type="number"
                min={0}
                placeholder={
                  panel.kind === 'slot-capacity'
                    ? `New capacity for ${panel.startTime}`
                    : 'New capacity for every slot this day'
                }
                className="h-8 text-xs"
              />
            )}
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional), e.g. bad weather"
              maxLength={500}
              className="h-8 text-xs"
            />
            {needsBookedConfirm && (
              <p className="text-xs text-destructive">
                {day.bookedTotal} booked seat{day.bookedTotal === 1 ? '' : 's'} will be
                cancelled. Guests must be notified.
              </p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="flex-1"
                disabled={busy}
                onClick={() => openPanel({ kind: 'none' })}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant={panel.kind === 'close-day' ? 'destructive' : 'default'}
                className="flex-1"
                disabled={busy}
                onClick={submitPanel}
              >
                {isWriting && (
                  <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
                )}
                {panel.kind === 'close-day'
                  ? needsBookedConfirm
                    ? 'Confirm close'
                    : 'Close day'
                  : panel.kind === 'add-slot'
                    ? 'Add'
                    : 'Apply'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </PopoverContent>
  );
}

// ── One slot row inside the popover ───────────────────────────────────────────

interface SlotRowProps {
  departure: TourDeparture;
  dayClosed: boolean;
  closeException?: { id: string };
  capacityException?: { id: string; capacity: number | null };
  busy: boolean;
  onCloseSlot: () => void;
  onReopenSlot: (exceptionId: string) => void;
  onEditCapacity: () => void;
  onRemoveCapacity: (exceptionId: string) => void;
}

function SlotRow({
  departure: d,
  dayClosed,
  closeException,
  capacityException,
  busy,
  onCloseSlot,
  onReopenSlot,
  onEditCapacity,
  onRemoveCapacity,
}: SlotRowProps) {
  const stopped = d.status === 'CLOSED' || d.status === 'CANCELLED';

  return (
    <div className="flex h-8 items-center justify-between gap-2">
      <div className="flex min-w-0 items-baseline gap-2">
        <span
          className={cn(
            'text-sm font-medium tabular-nums',
            stopped && 'text-muted-foreground line-through',
          )}
        >
          {d.startTime}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {d.bookedCount}/{d.capacity}
          {d.status === 'SOLD_OUT' && ' · sold out'}
          {stopped && !closeException && ' · closed'}
        </span>
        {capacityException && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onRemoveCapacity(capacityException.id)}
            title="Remove capacity override"
            className="inline-flex items-center gap-0.5 rounded-sm bg-warning-subtle px-1 py-px text-2xs font-semibold text-warning-fg hover:opacity-80"
          >
            cap {capacityException.capacity}
            <HugeiconsIcon icon={Cancel01Icon} className="size-2.5" />
          </button>
        )}
      </div>
      {!dayClosed &&
        (closeException ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={busy}
            onClick={() => onReopenSlot(closeException.id)}
          >
            Reopen
          </Button>
        ) : (
          !stopped && (
            <span className="flex shrink-0 items-center">
              {!capacityException && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  disabled={busy}
                  onClick={onEditCapacity}
                >
                  Capacity
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={busy}
                onClick={onCloseSlot}
              >
                Close
              </Button>
            </span>
          )
        ))}
    </div>
  );
}

// 'YYYY-MM-DD' → 'Wed 12 Aug 2026'.
function formatDayLong(day: string): string {
  const parsed = new Date(day + 'T00:00:00');
  return Number.isNaN(parsed.getTime()) ? day : format(parsed, 'EEE d MMM yyyy');
}
