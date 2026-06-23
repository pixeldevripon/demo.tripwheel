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

// 0 = Sunday … 6 = Saturday (matches the availability module).
const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

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

function formatWeekdays(weekdays: number[]): string {
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAYS.find((w) => w.value === d)?.label ?? d)
    .join(' · ');
}

// ── Schedule list row ─────────────────────────────────────────────────────────

interface ScheduleRowProps {
  schedule: TourSchedule;
  tripId: string;
}

function ScheduleRow({ schedule, tripId }: ScheduleRowProps) {
  const { mutate: updateSchedule, isPending: isUpdating } = useUpdateSchedule();
  const { mutate: removeSchedule, isPending: isRemoving } = useRemoveSchedule();

  function handleToggleActive() {
    updateSchedule(
      { tripId, scheduleId: schedule.id, payload: { isActive: !schedule.isActive } },
      {
        onSuccess: () => toast.success(`Schedule ${!schedule.isActive ? 'activated' : 'paused'}.`),
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
    <div className="flex items-center justify-between gap-4 ring-1 ring-foreground/10 px-3 py-3">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <span className={`size-1.5 rounded-full shrink-0 ${schedule.isActive ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{formatWeekdays(schedule.weekdays)}</p>
          <p className="text-xs text-muted-foreground">
            {schedule.startTimes.join(', ')}
            {(schedule.seasonStart || schedule.seasonEnd) && (
              <span className="ml-2">
                ({schedule.seasonStart ?? '…'} → {schedule.seasonEnd ?? '…'})
              </span>
            )}
          </p>
        </div>
        <div className="text-xs text-muted-foreground shrink-0">
          <span className="font-medium text-foreground">{schedule.capacity}</span> cap
        </div>
        {schedule.priceOverride && (
          <Badge variant="outline" className="text-xs shrink-0">${schedule.priceOverride}</Badge>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="xs" variant="outline" onClick={handleToggleActive} disabled={isUpdating}>
          {schedule.isActive ? 'Pause' : 'Activate'}
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
  const { mutate: createSchedule, isPending: isCreating } = useCreateSchedule();

  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startTimes, setStartTimes] = useState<string[]>([]);
  const [timeInput, setTimeInput] = useState('09:00');
  const [capacity, setCapacity] = useState('12');
  const [seasonStart, setSeasonStart] = useState('');
  const [seasonEnd, setSeasonEnd] = useState('');
  const [priceOverride, setPriceOverride] = useState('');

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
    setCapacity('12');
    setSeasonStart('');
    setSeasonEnd('');
    setPriceOverride('');
  }

  function handleCreate() {
    if (weekdays.length === 0) { toast.error('Select at least one weekday.'); return; }
    if (startTimes.length === 0) { toast.error('Add at least one start time.'); return; }
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1) { toast.error('Capacity must be at least 1.'); return; }

    createSchedule(
      {
        tripId,
        payload: {
          weekdays,
          startTimes,
          capacity: cap,
          seasonStart: seasonStart || undefined,
          seasonEnd: seasonEnd || undefined,
          priceOverride: priceOverride ? Number(priceOverride) : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Schedule added.');
          resetForm();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add schedule.'),
      }
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="font-heading text-lg font-semibold uppercase tracking-wider">
            Recurring Schedules
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Weekly departure patterns. Departures are materialised from these rules by the
            availability engine.
          </p>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-none" />
              ))}
            </div>
          ) : (schedules?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              {schedules!.map((schedule) => (
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

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label className="text-xs font-semibold uppercase">
                  Capacity <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Price Override (optional)</Label>
                <Input
                  value={priceOverride}
                  onChange={(e) => setPriceOverride(e.target.value)}
                  placeholder="e.g. 79.99"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label className="text-xs font-semibold uppercase">Season Start (optional)</Label>
                <DatePickerField value={seasonStart} onChange={setSeasonStart} placeholder="No start limit" clearable />
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Season End (optional)</Label>
                <DatePickerField value={seasonEnd} onChange={setSeasonEnd} placeholder="No end limit" clearable />
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
