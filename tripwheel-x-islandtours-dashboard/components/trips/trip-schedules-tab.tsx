'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2Icon, CalendarIcon, XIcon, PlusIcon, AlertTriangleIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  useSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useRemoveSchedule,
  useExceptions,
  useCreateException,
  useRemoveException,
  useUpdateTrip,
} from '@/hooks/trips/use-trips';
import type { TourSchedule, TourException, TourExceptionType } from '@/types/trip';

// 0 = Monday … 6 = Sunday (matches the backend AvailabilitySchedule.weekday).
const WEEKDAYS = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
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

// ── Reusable Calendar date-picker field ───────────────────────────────────────

interface DatePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
}

function DatePickerField({ value, onChange, placeholder = 'Pick a date', clearable = false }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? new Date(value + 'T00:00:00') : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 w-full items-center gap-2 border border-input bg-transparent px-3 text-sm text-left',
            'hover:bg-muted/50 transition-colors',
            !selectedDate && 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">
            {selectedDate ? format(selectedDate, 'dd MMM yyyy') : placeholder}
          </span>
          {clearable && selectedDate && (
            <XIcon
              className="size-3.5 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            onChange(date ? format(date, 'yyyy-MM-dd') : '');
            setOpen(false);
          }}
          captionLayout="dropdown"
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
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
    <div className="flex items-center justify-between gap-3 ring-1 ring-foreground/10 px-3 py-3">
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
          <Trash2Icon className="size-3.5" />
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
        <CardTitle className="text-lg font-semibold uppercase tracking-wider">
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
                            <XIcon className="size-3" />
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
                        <XIcon className="size-3" />
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
              <PlusIcon className="size-3.5" />
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
}

export function TripSchedulesTab({
  tripId,
  maxPartySize,
  declaredStartTimes,
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
          <CardTitle className="text-lg font-semibold uppercase tracking-wider">
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
              <AlertTriangleIcon className="size-4 shrink-0 text-warning-fg mt-0.5" />
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
                <Skeleton key={i} className="h-14 w-full rounded-none" />
              ))}
            </div>
          ) : totalSchedules > 0 ? (
            <Tabs defaultValue={String(activeWeekdays[0]?.value ?? 0)} className="w-full">
              <TabsList>
                {activeWeekdays.map((w) => (
                  <TabsTrigger key={w.value} value={String(w.value)}>
                    {w.label}
                    <span className="ml-1.5 rounded-full bg-muted-foreground/15 px-1.5 text-[10px] font-semibold tabular-nums">
                      {schedulesByWeekday.get(w.value)?.length ?? 0}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {activeWeekdays.map((w) => (
                <TabsContent key={w.value} value={String(w.value)} className="mt-4 space-y-2">
                  {(schedulesByWeekday.get(w.value) ?? []).map((schedule) => (
                    <ScheduleRow key={schedule.id} schedule={schedule} tripId={tripId} />
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No schedules yet.</p>
          )}

          <div className="space-y-4 pt-4 border-t">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Add Schedule</p>

            <Field>
              <Label className="text-xs font-semibold uppercase">
                Weekdays <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w) => (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() => toggleWeekday(w.value)}
                    className={cn(
                      'h-9 min-w-12 px-3 text-xs font-semibold uppercase border transition-colors',
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
              <Label className="text-xs font-semibold uppercase">
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
                          'h-9 min-w-16 px-3 text-xs font-semibold uppercase border transition-colors tabular-nums',
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
                    <AlertTriangleIcon className="size-4 shrink-0 text-warning-fg mt-0.5" />
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
                            <XIcon className="size-3" />
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
                      <PlusIcon className="size-3.5" />
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
              <Label className="text-xs font-semibold uppercase">
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
                <Label className="text-xs font-semibold uppercase">Valid From (optional)</Label>
                <DatePickerField value={validFrom} onChange={setValidFrom} placeholder="Defaults to today" clearable />
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Valid Until (optional)</Label>
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

      <ExceptionsSection
        tripId={tripId}
        maxPartySize={maxPartySize}
        schedules={schedules ?? []}
      />
    </div>
  );
}

// ── Date exceptions (one-off overrides of the recurring pattern) ───────────────

// Which fields each exception type needs. The materializer reads:
//   CLOSE_DATE   → whole date stop-sell (no time, no capacity)
//   CLOSE_SLOT   → one start time stop-sell (pick an existing scheduled slot)
//   ADD_SLOT     → extra departure (free time - intentionally a NEW slot; capacity)
//   SET_CAPACITY → override capacity for one scheduled slot, or the whole day
// timeMode drives the time control:
//   'none'        → no time field
//   'slot'        → dropdown of the date's scheduled slots (required)
//   'slot-or-all' → dropdown of the date's slots + an "All day" option
//   'free'        → free HH:MM input (a brand-new departure time)
const EXCEPTION_TYPES: {
  value: TourExceptionType;
  label: string;
  help: string;
  timeMode: 'none' | 'slot' | 'slot-or-all' | 'free';
  needsCapacity: boolean;
}[] = [
  {
    value: 'CLOSE_DATE',
    label: 'Close entire day',
    help: 'Stop-sell every departure on this date (e.g. a public holiday).',
    timeMode: 'none',
    needsCapacity: false,
  },
  {
    value: 'CLOSE_SLOT',
    label: 'Close one time slot',
    help: 'Stop-sell a single scheduled start time on this date (e.g. the captain is out).',
    timeMode: 'slot',
    needsCapacity: false,
  },
  {
    value: 'ADD_SLOT',
    label: 'Add extra departure',
    help: 'Add a one-off departure at a NEW time the weekly pattern does not produce.',
    timeMode: 'free',
    needsCapacity: true,
  },
  {
    value: 'SET_CAPACITY',
    label: 'Change capacity',
    help: 'Override the seats for one scheduled slot, or the whole day.',
    timeMode: 'slot-or-all',
    needsCapacity: true,
  },
];

// The scheduled start times that exist on a given date: recurring rules whose
// weekday + valid window cover it (ACTIVE only), plus any ADD_SLOT exceptions on
// that date. This is what CLOSE_SLOT / SET_CAPACITY let the operator target.
function scheduledSlotsForDate(
  dateStr: string,
  schedules: TourSchedule[],
  exceptions: TourException[]
): string[] {
  if (!dateStr) return [];
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return [];
  const weekday = (d.getDay() + 6) % 7; // JS Sun=0 → Mon=0
  const times = new Set<string>();
  for (const s of schedules) {
    if (s.weekday !== weekday || s.status !== 'ACTIVE') continue;
    if (s.validFrom && dateStr < s.validFrom) continue;
    if (s.validUntil && dateStr > s.validUntil) continue;
    times.add(s.startTime);
  }
  for (const ex of exceptions) {
    if (ex.type === 'ADD_SLOT' && ex.date === dateStr && ex.startTime) times.add(ex.startTime);
  }
  return [...times].sort();
}

const EXCEPTION_BADGE: Record<TourExceptionType, string> = {
  CLOSE_DATE: 'bg-destructive/10 text-destructive',
  CLOSE_SLOT: 'bg-destructive/10 text-destructive',
  ADD_SLOT: 'bg-success-subtle text-success-fg',
  SET_CAPACITY: 'bg-warning-subtle text-warning-fg',
};

function exceptionLabel(type: TourExceptionType): string {
  return EXCEPTION_TYPES.find((t) => t.value === type)?.label ?? type;
}

interface ExceptionRowProps {
  exception: TourException;
  tripId: string;
}

function ExceptionRow({ exception, tripId }: ExceptionRowProps) {
  const { mutate: removeException, isPending } = useRemoveException();

  function handleDelete() {
    removeException(
      { tripId, exceptionId: exception.id },
      {
        onSuccess: () => toast.success('Exception removed.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove.'),
      }
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 ring-1 ring-foreground/10 px-3 py-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span
          className={cn(
            'shrink-0 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
            EXCEPTION_BADGE[exception.type]
          )}
        >
          {exceptionLabel(exception.type)}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {formatDay(exception.date)}
            {exception.startTime ? ` · ${exception.startTime}` : ' · All day'}
            {exception.capacity != null ? ` · cap ${exception.capacity}` : ''}
          </p>
          {exception.note && (
            <p className="text-xs text-muted-foreground truncate">{exception.note}</p>
          )}
        </div>
      </div>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={handleDelete}
        disabled={isPending}
        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
      >
        <Trash2Icon className="size-3.5" />
      </Button>
    </div>
  );
}

interface ExceptionsSectionProps {
  tripId: string;
  maxPartySize: number | null;
  schedules: TourSchedule[];
}

function ExceptionsSection({ tripId, maxPartySize, schedules }: ExceptionsSectionProps) {
  const { data: exceptions, isLoading } = useExceptions(tripId);
  const { mutateAsync: createException, isPending: isCreating } = useCreateException();

  const [type, setType] = useState<TourExceptionType>('CLOSE_DATE');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [capacity, setCapacity] = useState('');
  const [note, setNote] = useState('');
  // Inline field + form errors (client validation and server error).
  const [errors, setErrors] = useState<{
    date?: string;
    startTime?: string;
    capacity?: string;
    form?: string;
  }>({});
  const clearError = (key: keyof typeof errors) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const config = EXCEPTION_TYPES.find((t) => t.value === type)!;
  // ADD_SLOT needs a resolvable capacity: its own value or the tour default.
  const capacityRequired =
    type === 'SET_CAPACITY' || (type === 'ADD_SLOT' && maxPartySize == null);

  // Slots the operator can target on the chosen date (for CLOSE_SLOT / SET_CAPACITY).
  const isSlotPicker = config.timeMode === 'slot' || config.timeMode === 'slot-or-all';
  const slotOptions = isSlotPicker
    ? scheduledSlotsForDate(date, schedules, exceptions ?? [])
    : [];

  const sorted = [...(exceptions ?? [])].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.startTime ?? '').localeCompare(b.startTime ?? '');
  });

  // Changing the type or date invalidates a previously-picked slot, so clear the
  // time (done in the change handlers - the repo lints against setState-in-effect).
  function changeType(next: TourExceptionType) {
    setType(next);
    setStartTime('');
    setErrors({});
  }
  function changeDate(next: string) {
    setDate(next);
    setStartTime('');
    clearError('date');
    clearError('startTime');
  }

  function resetForm() {
    setDate('');
    setStartTime('');
    setCapacity('');
    setNote('');
    setErrors({});
  }

  async function handleCreate() {
    // '__all__' is the SET_CAPACITY "whole day" sentinel (Radix Select forbids an
    // empty-string item value); treat it as no time.
    const time = startTime === '__all__' ? '' : startTime.trim();
    const next: typeof errors = {};
    if (!date) next.date = 'Pick a date.';
    if (config.timeMode === 'slot' && !time) {
      next.startTime = 'Pick a scheduled time slot to close.';
    }
    if (config.timeMode === 'free' && !HHMM.test(time)) {
      next.startTime = 'Start time must be HH:MM (00:00-23:59).';
    }
    const cap = capacity.trim() ? Number(capacity) : undefined;
    if (cap !== undefined && (!Number.isInteger(cap) || cap < 1)) {
      next.capacity = 'Capacity must be a whole number of at least 1.';
    }
    if (cap === undefined && capacityRequired) {
      next.capacity =
        type === 'ADD_SLOT'
          ? 'Required - this tour has no Max Party Size, so a capacity is needed for the extra departure.'
          : 'Enter the new capacity.';
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});

    // Only send startTime when the type uses one and it is set ('' = whole day for
    // slot-or-all, which the backend reads as a date-wide override).
    const sendTime = config.timeMode !== 'none' && time ? time : undefined;

    try {
      await createException({
        tripId,
        payload: {
          date,
          type,
          startTime: sendTime,
          capacity: config.needsCapacity ? cap : undefined,
          note: note.trim() || undefined,
        },
      });
      toast.success('Exception added.');
      resetForm();
    } catch (err) {
      setErrors({
        form: err instanceof Error ? err.message : 'Failed to add exception.',
      });
    }
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-lg font-semibold uppercase tracking-wider">
          Date Exceptions
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          One-off overrides of the weekly pattern for specific dates - close a holiday, cancel a
          single slot, add an extra departure, or change capacity. Departures update automatically.
        </p>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-none" />
            ))}
          </div>
        ) : sorted.length > 0 ? (
          <div className="space-y-2">
            {sorted.map((exception) => (
              <ExceptionRow key={exception.id} exception={exception} tripId={tripId} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">No date exceptions yet.</p>
        )}

        <div className="space-y-4 pt-4 border-t">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Add Exception</p>

          <Field>
            <Label className="text-xs font-semibold uppercase">
              Type <span className="text-destructive">*</span>
            </Label>
            <Select value={type} onValueChange={(v) => changeType(v as TourExceptionType)}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXCEPTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{config.help}</p>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">
                Date <span className="text-destructive">*</span>
              </Label>
              <DatePickerField value={date} onChange={changeDate} placeholder="Pick a date" />
              {errors.date && (
                <p className="text-xs text-destructive mt-1.5">{errors.date}</p>
              )}
            </Field>

            {/* Free time entry - ADD_SLOT introduces a brand-new departure time. */}
            {config.timeMode === 'free' && (
              <Field>
                <Label className="text-xs font-semibold uppercase">
                  Start Time <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    clearError('startTime');
                  }}
                  placeholder="HH:MM (e.g. 14:30)"
                  inputMode="numeric"
                  aria-invalid={!!errors.startTime}
                  className="h-9 w-40"
                />
                {errors.startTime ? (
                  <p className="text-xs text-destructive mt-1.5">{errors.startTime}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    A new departure time not already in the weekly pattern. Use
                    24-hour HH:MM, e.g. 14:30 for 2:30 PM.
                  </p>
                )}
              </Field>
            )}

            {/* Slot picker - CLOSE_SLOT / SET_CAPACITY target an existing scheduled slot. */}
            {isSlotPicker && (
              <Field>
                <Label className="text-xs font-semibold uppercase">
                  Time Slot{' '}
                  {config.timeMode === 'slot' ? (
                    <span className="text-destructive">*</span>
                  ) : (
                    '(optional)'
                  )}
                </Label>
                <Select
                  value={startTime}
                  onValueChange={(v) => {
                    setStartTime(v);
                    clearError('startTime');
                  }}
                  disabled={!date || slotOptions.length === 0}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue
                      placeholder={
                        !date
                          ? 'Pick a date first'
                          : slotOptions.length === 0
                            ? 'No scheduled slots on this date'
                            : config.timeMode === 'slot-or-all'
                              ? 'All day (every slot)'
                              : 'Select a slot'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {config.timeMode === 'slot-or-all' && (
                      <SelectItem value="__all__">All day (every slot)</SelectItem>
                    )}
                    {slotOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.startTime && (
                  <p className="text-xs text-destructive mt-1.5">{errors.startTime}</p>
                )}
                {date && slotOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No recurring slots run on this weekday. Add a schedule first, or use{' '}
                    <span className="font-medium">Add extra departure</span>.
                  </p>
                )}
              </Field>
            )}
          </div>

          {config.needsCapacity && (
            <Field>
              <Label className="text-xs font-semibold uppercase">
                Capacity {capacityRequired ? <span className="text-destructive">*</span> : '(optional)'}
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
                    ? 'Required'
                    : "Leave blank to use the tour's max party size"
                }
                aria-invalid={!!errors.capacity}
                className="max-w-xs"
              />
              {errors.capacity && (
                <p className="text-xs text-destructive mt-1.5">{errors.capacity}</p>
              )}
            </Field>
          )}

          <Field>
            <Label className="text-xs font-semibold uppercase">Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Independence Day closure"
              className="max-w-md"
            />
          </Field>

          {errors.form && (
            <p className="text-sm text-destructive">{errors.form}</p>
          )}
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? 'Adding...' : 'Add Exception'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
