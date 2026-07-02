'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2Icon, CalendarIcon, XIcon, PlusIcon } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import {
  useSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useRemoveSchedule,
} from '@/hooks/trips/use-trips';
import type { TourSchedule } from '@/types/trip';

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
        <span className={`size-1.5 rounded-full shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
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
        <Button size="xs" variant="outline" onClick={handleToggleActive} disabled={isUpdating}>
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

// ── Tab ───────────────────────────────────────────────────────────────────────

interface TripSchedulesTabProps {
  tripId: string;
}

export function TripSchedulesTab({ tripId }: TripSchedulesTabProps) {
  const { data: schedules, isLoading } = useSchedules(tripId);
  const { mutateAsync: createSchedule, isPending: isCreating } = useCreateSchedule();

  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startTimes, setStartTimes] = useState<string[]>([]);
  const [timeInput, setTimeInput] = useState('09:00');
  const [capacity, setCapacity] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');

  // One backend row per weekday × start time, so display them sorted for scanability.
  const sortedSchedules = [...(schedules ?? [])].sort(
    (a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime),
  );

  function toggleWeekday(day: number) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function addTime() {
    const t = timeInput.trim();
    if (!HHMM.test(t)) { toast.error('Time must be HH:MM (00:00-23:59).'); return; }
    if (startTimes.includes(t)) { toast.error('Time already added.'); return; }
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
  }

  // The backend stores one schedule per (weekday, startTime), so a grouped
  // selection fans out into weekdays × startTimes create calls.
  async function handleCreate() {
    if (weekdays.length === 0) { toast.error('Select at least one weekday.'); return; }
    if (startTimes.length === 0) { toast.error('Add at least one start time.'); return; }
    const cap = capacity.trim() ? Number(capacity) : undefined;
    if (cap !== undefined && (!Number.isInteger(cap) || cap < 1)) {
      toast.error('Capacity override must be a whole number of at least 1.');
      return;
    }

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
      toast.error(err instanceof Error ? err.message : 'Failed to add schedule.');
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="font-heading text-lg font-semibold uppercase tracking-wider">
            Recurring Schedules
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Weekly departure patterns (one rule per weekday and start time). Departures are
            materialised from these rules by the availability engine.
          </p>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-none" />
              ))}
            </div>
          ) : sortedSchedules.length > 0 ? (
            <div className="space-y-2">
              {sortedSchedules.map((schedule) => (
                <ScheduleRow key={schedule.id} schedule={schedule} tripId={tripId} />
              ))}
            </div>
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
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">
                Start Times <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground -mt-1 mb-1">
                Each time must be one of the tour&apos;s declared start times.
              </p>
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
                  type="time"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  className="h-9 w-40"
                />
                <Button type="button" size="sm" variant="outline" onClick={addTime} className="h-9">
                  <PlusIcon className="size-3.5" />
                  Add time
                </Button>
              </div>
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">Capacity Override (optional)</Label>
              <Input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Leave blank to use the tour's max party size"
                className="max-w-xs"
              />
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

            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={handleCreate} disabled={isCreating}>
                {isCreating ? 'Adding...' : 'Add Schedule'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
