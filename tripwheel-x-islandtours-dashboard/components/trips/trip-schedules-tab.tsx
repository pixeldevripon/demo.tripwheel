'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon, Cancel01Icon, Delete02Icon, PlusSignIcon } from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DatePickerField } from '@/components/date-picker-field';
import { TripAvailabilityCalendar } from '@/components/trips/trip-availability-calendar';
import { cn } from '@/lib/utils';
import {
  useSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useRemoveSchedule,
  useUpdateTrip,
} from '@/hooks/trips/use-trips';
import type { TourSchedule } from '@/types/trip';

// 0 = Monday … 6 = Sunday (matches the backend AvailabilitySchedule.weekday).
const WEEKDAYS = [
  { value: 0, label: 'Mon', full: 'Monday' },
  { value: 1, label: 'Tue', full: 'Tuesday' },
  { value: 2, label: 'Wed', full: 'Wednesday' },
  { value: 3, label: 'Thu', full: 'Thursday' },
  { value: 4, label: 'Fri', full: 'Friday' },
  { value: 5, label: 'Sat', full: 'Saturday' },
  { value: 6, label: 'Sun', full: 'Sunday' },
];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function weekdayLabel(weekday: number): string {
  return WEEKDAYS.find((w) => w.value === weekday)?.label ?? String(weekday);
}

// 'YYYY-MM-DD' → '2 Jul 2026' (falls back to the raw string if unparseable).
function formatDay(day: string): string {
  const parsed = new Date(day + 'T00:00:00');
  return Number.isNaN(parsed.getTime()) ? day : format(parsed, 'd MMM yyyy');
}

// Validity window: "From 2 Jul 2026" when open-ended, else "2 Jul → 30 Sep 2026".
function validityLabel(schedule: TourSchedule): string {
  const from = formatDay(schedule.validFrom);
  return schedule.validUntil ? `${from} → ${formatDay(schedule.validUntil)}` : `From ${from}`;
}


// ── Schedule list row (one weekday × one start time) ──────────────────────────

interface ScheduleRowProps {
  schedule: TourSchedule;
  tripId: string;
}

function ScheduleRow({ schedule, tripId }: ScheduleRowProps) {
  const { mutate: updateSchedule, isPending: isUpdating } = useUpdateSchedule();
  const { mutate: removeSchedule, isPending: isRemoving } = useRemoveSchedule();

  const isActive = schedule.status === 'ACTIVE';

  function handleToggleActive() {
    updateSchedule(
      { tripId, scheduleId: schedule.id, payload: { status: isActive ? 'PAUSED' : 'ACTIVE' } },
      {
        onSuccess: () => toast.success(`Schedule ${isActive ? 'paused' : 'activated'}.`),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update.'),
      }
    );
  }

  function handleDelete() {
    removeSchedule(
      { tripId, scheduleId: schedule.id },
      {
        onSuccess: () => toast.success('Schedule removed.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove.'),
      }
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg ring-1 ring-foreground/10 px-3 py-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className={`size-1.5 rounded-full shrink-0 ${isActive ? 'bg-success-solid' : 'bg-content-subtle'}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {weekdayLabel(schedule.weekday)} · {schedule.startTime}
          </p>
          <p className="text-xs text-muted-foreground truncate">{validityLabel(schedule)}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          <span className="font-medium text-foreground">
            {schedule.capacityOverride ?? 'default'}
          </span>{' '}
          cap
        </span>
        <Button size="sm" variant="outline" onClick={handleToggleActive} disabled={isUpdating}>
          {isActive ? 'Pause' : 'Activate'}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={isRemoving}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Start times (the tour's declared departure-time slot set) ─────────────────

interface StartTimesSectionProps {
  tripId: string;
  declaredStartTimes: string[];
  // Existing schedules, to block removing a time that a schedule still uses.
  schedules: TourSchedule[];
}

// The tour's declared start times. Recurring schedules and date exceptions can
// only target times in this set (backend rule, master §2.1), so they are managed
// here alongside the schedules that consume them. Each add/remove persists to the
// tour immediately (PATCH), matching the schedule/exception rows.
function StartTimesSection({ tripId, declaredStartTimes, schedules }: StartTimesSectionProps) {
  const { mutate: updateTrip, isPending } = useUpdateTrip();
  const [draft, setDraft] = useState('09:00');
  // Inline error shown under the time input (client validation + server error).
  const [error, setError] = useState<string | null>(null);

  const times = [...new Set(declaredStartTimes)].sort();
  // How many recurring schedules use a given start time. Removing a time still in
  // use would orphan those schedules, so the UI locks its remove control.
  const scheduleCountFor = (t: string) =>
    schedules.filter((s) => s.startTime === t).length;

  function addTime() {
    const t = draft.trim();
    if (!HHMM.test(t)) {
      setError('Time must be HH:MM (00:00-23:59).');
      return;
    }
    if (times.includes(t)) {
      setError('That start time is already declared.');
      return;
    }
    setError(null);
    updateTrip(
      { id: tripId, payload: { startTimes: [...times, t].sort() } },
      {
        onSuccess: () => {
          setDraft('');
          toast.success(`Added start time ${t}.`);
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'Failed to add start time.'),
      }
    );
  }

  function removeTime(t: string) {
    // Defensive: the UI disables removal for in-use times, but guard anyway so a
    // declared time a schedule still uses can never be orphaned.
    if (scheduleCountFor(t) > 0) return;
    updateTrip(
      { id: tripId, payload: { startTimes: times.filter((x) => x !== t) } },
      {
        onSuccess: () => toast.success(`Removed start time ${t}.`),
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'Failed to remove start time.'),
      }
    );
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-lg font-semibold">
          Start Times
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          The tour&apos;s declared departure times. Recurring schedules and date
          exceptions can only use times declared here.
        </p>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {times.length > 0 ? (
          <TooltipProvider>
            <div className="flex flex-wrap gap-2">
              {times.map((t) => {
                const usedBy = scheduleCountFor(t);
                return (
                  <Badge key={t} variant="secondary" className="gap-1.5 pr-1 tabular-nums">
                    <span>{t}</span>
                    {usedBy > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="rounded-sm p-0.5 text-muted-foreground/40 cursor-not-allowed"
                            aria-label={`${t} is used by ${usedBy} schedule${usedBy > 1 ? 's' : ''}`}
                          >
                            <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          In use by {usedBy} schedule{usedBy > 1 ? 's' : ''}. Remove{' '}
                          {usedBy > 1 ? 'them' : 'it'} first to delete this time.
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeTime(t)}
                        disabled={isPending}
                        className="rounded-sm hover:bg-foreground/10 p-0.5 transition-colors disabled:opacity-50"
                        aria-label={`Remove ${t}`}
                      >
                        <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                      </button>
                    )}
                  </Badge>
                );
              })}
            </div>
          </TooltipProvider>
        ) : (
          <p className="text-sm text-muted-foreground">
            No start times declared yet. Add at least one before creating schedules.
          </p>
        )}
        <div>
          <div className="flex items-end gap-2">
            <Input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError(null);
              }}
              placeholder="HH:MM (e.g. 09:00)"
              inputMode="numeric"
              aria-invalid={!!error}
              className="h-9 w-40"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addTime}
              disabled={isPending}
              className="h-9"
            >
              <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
              Add time
            </Button>
          </div>
          {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

interface TripSchedulesTabProps {
  tripId: string;
  // The tour's default departure capacity. When null, a schedule MUST carry its
  // own capacity override or it won't materialise any bookable departures.
  maxPartySize: number | null;
  // The tour's declared start times (Details tab). A schedule slot must be one of
  // these (backend rule, master §2.1), so the form offers only these when set.
  declaredStartTimes: string[];
  // Tour-local IANA zone - the calendar's "today" follows the island's clock.
  timeZone: string;
}

export function TripSchedulesTab({
  tripId,
  maxPartySize,
  declaredStartTimes,
  timeZone,
}: TripSchedulesTabProps) {
  const { data: schedules, isLoading } = useSchedules(tripId);
  const { mutateAsync: createSchedule, isPending: isCreating } = useCreateSchedule();

  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startTimes, setStartTimes] = useState<string[]>([]);
  const [timeInput, setTimeInput] = useState('09:00');
  const [capacity, setCapacity] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  // Inline field + form errors (client validation and server error).
  const [errors, setErrors] = useState<{
    weekdays?: string;
    startTimes?: string;
    capacity?: string;
    form?: string;
  }>({});

  // One backend row per weekday × start time. Group by weekday so the list is
  // scannable one day at a time (tabbed), each day's times sorted.
  const schedulesByWeekday = new Map<number, TourSchedule[]>();
  for (const s of schedules ?? []) {
    const list = schedulesByWeekday.get(s.weekday) ?? [];
    list.push(s);
    schedulesByWeekday.set(s.weekday, list);
  }
  for (const list of schedulesByWeekday.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  // Weekdays that actually have schedules, in Mon…Sun order.
  const activeWeekdays = WEEKDAYS.filter((w) => schedulesByWeekday.has(w.value));
  const totalSchedules = schedules?.length ?? 0;

  // With no tour-level Max Party Size, a schedule has no default capacity to fall
  // back on, so a capacity override is mandatory - otherwise the backend skips
  // the slot and the tour never lists. Surface this instead of failing silently.
  const capacityRequired = maxPartySize == null;
  // Existing schedules that would produce zero departures (no override + no default).
  const uncapacitatedCount = capacityRequired
    ? (schedules ?? []).filter((s) => s.capacityOverride == null).length
    : 0;

  // The tour's declared start times, de-duped and sorted. When present, the form
  // constrains the picker to these so a slot can never be rejected on save.
  const declaredTimes = [...new Set(declaredStartTimes)].sort();
  const hasDeclaredTimes = declaredTimes.length > 0;

  const clearError = (key: keyof typeof errors) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  function toggleWeekday(day: number) {
    clearError('weekdays');
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  // Toggle one of the declared start times in/out of this schedule's selection.
  function toggleTime(t: string) {
    clearError('startTimes');
    setStartTimes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].sort()
    );
  }

  function addTime() {
    const t = timeInput.trim();
    if (!HHMM.test(t)) { setErrors((p) => ({ ...p, startTimes: 'Time must be HH:MM (00:00-23:59).' })); return; }
    if (startTimes.includes(t)) { setErrors((p) => ({ ...p, startTimes: 'Time already added.' })); return; }
    clearError('startTimes');
    setStartTimes((prev) => [...prev, t].sort());
  }

  function removeTime(t: string) {
    setStartTimes((prev) => prev.filter((x) => x !== t));
  }

  function resetForm() {
    setWeekdays([]);
    setStartTimes([]);
    setTimeInput('09:00');
    setCapacity('');
    setValidFrom('');
    setValidUntil('');
    setErrors({});
  }

  // The backend stores one schedule per (weekday, startTime), so a grouped
  // selection fans out into weekdays × startTimes create calls.
  async function handleCreate() {
    const next: typeof errors = {};
    if (weekdays.length === 0) next.weekdays = 'Select at least one weekday.';
    if (startTimes.length === 0) next.startTimes = 'Add at least one start time.';
    const cap = capacity.trim() ? Number(capacity) : undefined;
    if (cap !== undefined && (!Number.isInteger(cap) || cap < 1)) {
      next.capacity = 'Capacity override must be a whole number of at least 1.';
    }
    if (cap === undefined && capacityRequired) {
      next.capacity =
        'Required - this tour has no Max Party Size. Enter a capacity, or set a Max Party Size on the Details tab first.';
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});

    try {
      for (const weekday of weekdays) {
        for (const startTime of startTimes) {
          await createSchedule({
            tripId,
            payload: {
              weekday,
              startTime,
              capacityOverride: cap,
              validFrom: validFrom || undefined,
              validUntil: validUntil || undefined,
            },
          });
        }
      }
      toast.success(`Added ${weekdays.length * startTimes.length} schedule(s).`);
      resetForm();
    } catch (err) {
      setErrors({
        form: err instanceof Error ? err.message : 'Failed to add schedule.',
      });
    }
  }

  return (
    <div className="space-y-6">
      <StartTimesSection
        tripId={tripId}
        declaredStartTimes={declaredStartTimes}
        schedules={schedules ?? []}
      />

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg font-semibold">
            Recurring Schedules
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Weekly departure patterns (one rule per weekday and start time). Departures are
            materialised from these rules by the availability engine.
          </p>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {capacityRequired && (
            <div className="flex gap-2.5 bg-warning-subtle border border-warning-border px-3 py-2.5">
              <HugeiconsIcon icon={Alert02Icon} className="size-4 shrink-0 text-warning-fg mt-0.5" />
              <div className="text-sm text-warning-fg">
                <p className="font-medium">This tour has no Max Party Size set.</p>
                <p className="mt-0.5">
                  Each schedule needs its own capacity override, or it will not
                  create any bookable departures and the tour will not list. Set a
                  Max Party Size on the Details tab to use as the shared default
                  {uncapacitatedCount > 0
                    ? ` - ${uncapacitatedCount} existing schedule(s) currently have no capacity and produce no departures.`
                    : '.'}
                </p>
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : totalSchedules > 0 ? (
            /* Weekday tabs (user preference 2026-07-17), made friendlier:
               ALL seven days are always present - a day without rules shows
               a quiet 0 chip and an honest empty panel, so schedule gaps
               stay visible without leaving the tabbed layout. */
            <Tabs defaultValue={String(activeWeekdays[0]?.value ?? 0)} className="w-full">
              <TabsList>
                {WEEKDAYS.map((w) => {
                  const dayCount = schedulesByWeekday.get(w.value)?.length ?? 0;
                  return (
                    <TabsTrigger key={w.value} value={String(w.value)}>
                      {w.label}
                      <span
                        className={cn(
                          'ml-1.5 rounded-full px-1.5 text-2xs font-semibold tabular-nums',
                          dayCount > 0
                            ? 'bg-primary-subtle text-primary-subtle-content'
                            : 'bg-surface-inset text-content-subtle',
                        )}
                      >
                        {dayCount}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {WEEKDAYS.map((w) => {
                const daySchedules = schedulesByWeekday.get(w.value) ?? [];
                return (
                  <TabsContent key={w.value} value={String(w.value)} className="mt-4 space-y-2">
                    {daySchedules.length > 0 ? (
                      daySchedules.map((schedule) => (
                        <ScheduleRow key={schedule.id} schedule={schedule} tripId={tripId} />
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center">
                        <p className="text-sm font-medium text-content-muted">
                          No departures on {w.full}
                        </p>
                        <p className="mt-1 text-xs text-content-subtle">
                          Use “Add Schedule” below and select {w.label} to create one.
                        </p>
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No schedules yet.</p>
          )}

          <div className="space-y-4 pt-4 border-t">
            <p className="text-xs font-semibold text-muted-foreground">Add Schedule</p>

            <Field>
              <Label>
                Weekdays <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w) => (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() => toggleWeekday(w.value)}
                    className={cn(
                      'h-9 min-w-12 rounded-md px-3 text-xs font-semibold border transition-colors duration-fast',
                      weekdays.includes(w.value)
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-input hover:bg-muted',
                    )}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
              {errors.weekdays && (
                <p className="text-xs text-destructive mt-1.5">{errors.weekdays}</p>
              )}
            </Field>

            <Field>
              <Label>
                Start Times <span className="text-destructive">*</span>
              </Label>
              {hasDeclaredTimes ? (
                <>
                  <p className="text-xs text-muted-foreground -mt-1 mb-1">
                    Pick from the tour&apos;s declared start times (edit the set on
                    the Details tab).
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {declaredTimes.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTime(t)}
                        className={cn(
                          'h-9 min-w-16 px-3 text-xs font-semibold border transition-colors tabular-nums',
                          startTimes.includes(t)
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-input hover:bg-muted',
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-2.5 bg-warning-subtle border border-warning-border px-3 py-2.5 mb-2">
                    <HugeiconsIcon icon={Alert02Icon} className="size-4 shrink-0 text-warning-fg mt-0.5" />
                    <p className="text-sm text-warning-fg">
                      This tour has no declared start times yet. Add them on the
                      Details tab so schedules stay consistent; any time entered
                      here that is not declared will be rejected on save.
                    </p>
                  </div>
                  {startTimes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {startTimes.map((t) => (
                        <Badge key={t} variant="secondary" className="gap-1.5 pr-1">
                          <span>{t}</span>
                          <button
                            type="button"
                            onClick={() => removeTime(t)}
                            className="rounded-sm hover:bg-foreground/10 p-0.5 transition-colors"
                            aria-label={`Remove ${t}`}
                          >
                            <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <Input
                      value={timeInput}
                      onChange={(e) => setTimeInput(e.target.value)}
                      placeholder="HH:MM (e.g. 09:00)"
                      inputMode="numeric"
                      className="h-9 w-40"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={addTime} className="h-9">
                      <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
                      Add time
                    </Button>
                  </div>
                </>
              )}
              {errors.startTimes && (
                <p className="text-xs text-destructive mt-1.5">{errors.startTimes}</p>
              )}
            </Field>

            <Field>
              <Label>
                Capacity {capacityRequired ? '' : 'Override '}
                {capacityRequired ? (
                  <span className="text-destructive">*</span>
                ) : (
                  '(optional)'
                )}
              </Label>
              <Input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => {
                  setCapacity(e.target.value);
                  clearError('capacity');
                }}
                placeholder={
                  capacityRequired
                    ? 'Required - this tour has no Max Party Size default'
                    : "Leave blank to use the tour's max party size"
                }
                aria-invalid={!!errors.capacity}
                className="max-w-xs"
              />
              {errors.capacity && (
                <p className="text-xs text-destructive mt-1.5">{errors.capacity}</p>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>Valid From (optional)</Label>
                <DatePickerField value={validFrom} onChange={setValidFrom} placeholder="Defaults to today" clearable />
              </Field>
              <Field>
                <Label>Valid Until (optional)</Label>
                <DatePickerField value={validUntil} onChange={setValidUntil} placeholder="Open-ended" clearable />
              </Field>
            </div>

            {errors.form && (
              <p className="text-sm text-destructive">{errors.form}</p>
            )}
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={handleCreate} disabled={isCreating}>
                {isCreating ? 'Adding...' : 'Add Schedule'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date-specific work (close a day/slot, extra departure, capacity)
          lives ENTIRELY in the calendar - the old Date Exceptions form card
          was removed once the calendar covered every exception type. */}
      <TripAvailabilityCalendar
        tripId={tripId}
        timeZone={timeZone}
        maxPartySize={maxPartySize}
        declaredStartTimes={declaredStartTimes}
      />
    </div>
  );
}
