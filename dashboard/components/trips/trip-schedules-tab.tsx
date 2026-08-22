'use client';

import {
    Alert02Icon,
    Cancel01Icon,
    Delete02Icon,
    PlusSignIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { DatePickerField } from '@/components/date-picker-field';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    useCreateSchedule,
    useRemoveSchedule,
    useSchedules,
    useUpdateSchedule,
    useUpdateTrip,
} from '@/hooks/trips/use-trips';
import { settleAll } from '@/lib/async/settle-all';
import { cn } from '@/lib/utils';
import type { PricingModel, TourSchedule } from '@/types/trip';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

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

/**
 * Turn the rejections from a multi-row schedule create into one readable
 * sentence, in the SERVER's words.
 *
 * A count on its own ("2 could not be added") cannot tell an operator whether
 * they picked a day that already has that time - deselect it and move on - or
 * whether the API is down, which no amount of adjusting the form will fix.
 * Those need opposite responses, and on 2026-08-08 the count reported the
 * second as if it were the first, so the operator retried a form that could not
 * succeed. The backend already writes a good message ("A schedule for Monday at
 * 13:00 already exists for this tour."); this just stops throwing it away.
 *
 * Identical messages collapse - twelve rows failing the same way is one fact,
 * not twelve - and each is tagged with the combination that produced it so
 * "which Tuesday" is never a guess.
 */
export function describeFailures(
    failed: { item: { weekday: number; startTime: string }; error: unknown }[],
): string {
    const byMessage = new Map<string, string[]>();
    for (const { item, error } of failed) {
        const message =
            error instanceof Error && error.message
                ? error.message
                : 'The server did not say why.';
        const day =
            WEEKDAYS.find(w => w.value === item.weekday)?.full ??
            `Day ${item.weekday}`;
        const where = byMessage.get(message) ?? [];
        where.push(`${day} ${item.startTime}`);
        byMessage.set(message, where);
    }
    return [...byMessage.entries()]
        // The message already names the combination when it is a duplicate
        // conflict, so a single failure does not need it said twice.
        .map(([message, where]) =>
            where.length === 1 && message.includes(where[0].split(' ')[0])
                ? message
                : `${where.join(', ')}: ${message}`,
        )
        .join(' ');
}

// 'YYYY-MM-DD' → '2 Jul 2026' (falls back to the raw string if unparseable).
function formatDay(day: string): string {
    const parsed = new Date(day + 'T00:00:00');
    return Number.isNaN(parsed.getTime()) ? day : format(parsed, 'd MMM yyyy');
}

// Validity window: "From 2 Jul 2026" when open-ended, else "2 Jul → 30 Sep 2026".
function validityLabel(window: {
    validFrom: string;
    validUntil: string | null;
}): string {
    const from = formatDay(window.validFrom);
    return window.validUntil
        ? `${from} → ${formatDay(window.validUntil)}`
        : `From ${from}`;
}

// ── Pattern rows (one row per start time × identical settings) ────────────────

/**
 * The storage model is one row per (weekday, time) - correct for the engine,
 * wrong for a human (F6: "daily at 16:30 except Friday" is one thought, not
 * seven rows behind seven tabs). A pattern groups the identical rows and puts
 * the weekdays back on ONE line as toggleable chips. Nothing changes in the
 * model or the API: a chip toggle creates/deletes the underlying row, and the
 * row-level actions fan out across the group.
 */
interface SchedulePattern {
    key: string;
    startTime: string;
    capacityOverride: number | null;
    validFrom: string;
    validUntil: string | null;
    status: TourSchedule['status'];
    /** weekday (0=Mon) → the backing schedule row. */
    byWeekday: Map<number, TourSchedule>;
}

function groupPatterns(schedules: TourSchedule[]): SchedulePattern[] {
    const map = new Map<string, SchedulePattern>();
    for (const s of schedules) {
        // Status is part of the identity on purpose: "16:30 paused on Monday,
        // selling Tue-Sun" must render as two honest rows, not one muddle.
        const key = [
            s.startTime,
            s.capacityOverride ?? '',
            s.validFrom,
            s.validUntil ?? '',
            s.status,
        ].join('|');
        let p = map.get(key);
        if (!p) {
            p = {
                key,
                startTime: s.startTime,
                capacityOverride: s.capacityOverride,
                validFrom: s.validFrom,
                validUntil: s.validUntil,
                status: s.status,
                byWeekday: new Map(),
            };
            map.set(key, p);
        }
        p.byWeekday.set(s.weekday, s);
    }
    return [...map.values()].sort(
        (a, b) =>
            a.startTime.localeCompare(b.startTime) ||
            a.validFrom.localeCompare(b.validFrom)
    );
}

interface PatternRowProps {
    pattern: SchedulePattern;
    tripId: string;
    /** Pre-worded by the parent - seat tours and private charters read differently (F10). */
    capacityLabel: string;
}

function PatternRow({ pattern, tripId, capacityLabel }: PatternRowProps) {
    const { mutateAsync: createSchedule } = useCreateSchedule();
    const { mutateAsync: updateSchedule } = useUpdateSchedule();
    const { mutateAsync: removeSchedule } = useRemoveSchedule();
    // One flag for every mutation this row can issue - group actions fan out
    // over several rows and none of them may interleave.
    const [busy, setBusy] = useState(false);
    // F7: pause and remove both get a consequence dialog. Neither verb means
    // "stop selling today" (the engine is forward-only), and an operator who
    // believes it does has a silent-overbooking morning ahead of them.
    const [confirming, setConfirming] = useState<'pause' | 'remove' | null>(
        null
    );

    const isActive = pattern.status === 'ACTIVE';
    const rows = [...pattern.byWeekday.values()];

    async function run(work: () => Promise<unknown>, failMsg: string) {
        setBusy(true);
        try {
            await work();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : failMsg);
        } finally {
            setBusy(false);
        }
    }

    /** Chip tap: day on ↔ off, writing/deleting the underlying row. */
    function toggleDay(weekday: number) {
        const existing = pattern.byWeekday.get(weekday);
        if (existing) {
            void run(
                () => removeSchedule({ tripId, scheduleId: existing.id }),
                'Failed to remove the day.'
            );
        } else {
            void run(
                () =>
                    createSchedule({
                        tripId,
                        payload: {
                            weekday,
                            startTime: pattern.startTime,
                            capacityOverride:
                                pattern.capacityOverride ?? undefined,
                            validFrom: pattern.validFrom,
                            validUntil: pattern.validUntil ?? undefined,
                            // A day added to a paused rule arrives paused - the
                            // chip joins the rule, it does not overrule it.
                            status: pattern.status,
                        },
                    }),
                'Failed to add the day.'
            );
        }
    }

    /**
     * Fan an action across every weekday row of the rule and NAME what
     * failed: a mixed state ("Mon-Thu paused, Fri didn't take") presented as
     * one generic error is worse than the failure itself.
     */
    async function fanOut(
        work: (s: TourSchedule) => Promise<unknown>,
        verb: string
    ) {
        setBusy(true);
        try {
            const results = await Promise.allSettled(rows.map(work));
            const failedDays = results
                .map((r, i) =>
                    r.status === 'rejected'
                        ? WEEKDAYS[rows[i].weekday]?.label
                        : null
                )
                .filter((d): d is string => !!d);
            if (failedDays.length > 0) {
                toast.error(
                    `${verb} failed for ${failedDays.join(', ')} - the other days went through. Retry to finish.`
                );
            }
        } finally {
            setBusy(false);
        }
    }

    /** Pause/resume the WHOLE rule - one tap, not one per weekday (F6). */
    function toggleActive() {
        setConfirming(null);
        void fanOut(
            s =>
                updateSchedule({
                    tripId,
                    scheduleId: s.id,
                    payload: { status: isActive ? 'PAUSED' : 'ACTIVE' },
                }),
            isActive ? 'Pausing' : 'Resuming'
        );
    }

    function removeAll() {
        setConfirming(null);
        void fanOut(
            s => removeSchedule({ tripId, scheduleId: s.id }),
            'Removing'
        );
    }

    return (
        <div className='flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-3 last:border-b-0'>
            <span
                aria-hidden
                className={`size-1.5 shrink-0 rounded-full ${isActive ? 'bg-success-solid' : 'bg-content-subtle'}`}
            />
            <div className='min-w-14'>
                <p className='text-sm font-medium tabular-nums text-content'>
                    {pattern.startTime}
                    {!isActive && (
                        <span className='ml-2 text-xs font-normal text-content-muted'>
                            Paused
                        </span>
                    )}
                </p>
                <p className='truncate text-xs text-content-muted'>
                    {validityLabel(pattern)}
                </p>
            </div>

            {/* The week on one line. A filled chip = the rule runs that day;
                tapping toggles the day directly. */}
            <div className='flex items-center gap-1'>
                {WEEKDAYS.map(w => {
                    const on = pattern.byWeekday.has(w.value);
                    return (
                        <button
                            key={w.value}
                            type='button'
                            disabled={busy}
                            onClick={() => toggleDay(w.value)}
                            aria-pressed={on}
                            aria-label={`${w.full}: ${on ? 'runs' : 'off'}`}
                            title={
                                on
                                    ? `Remove ${w.full} from this rule`
                                    : `Add ${w.full} to this rule`
                            }
                            className={cn(
                                'grid size-6 place-items-center rounded-md text-2xs font-medium transition-colors disabled:opacity-50',
                                on
                                    ? 'bg-foreground text-background'
                                    : 'bg-surface-inset text-content-subtle hover:bg-muted'
                            )}>
                            {w.label[0]}
                        </button>
                    );
                })}
            </div>

            <span className='ml-auto text-xs whitespace-nowrap text-content-muted'>
                {capacityLabel}
            </span>
            <span className='flex items-center'>
                <Button
                    size='sm'
                    variant='ghost'
                    onClick={() =>
                        isActive ? setConfirming('pause') : toggleActive()
                    }
                    disabled={busy}
                    className='text-content-muted'>
                    {isActive ? 'Pause' : 'Resume'}
                </Button>
                {/* Remove appears once the rule is paused (reference mockup):
                    pause-first is the natural confirmation step, and removal
                    never touches booked departures (forward-only engine). */}
                {!isActive && (
                    <Button
                        size='icon-sm'
                        variant='ghost'
                        aria-label='Remove this rule'
                        onClick={() => setConfirming('remove')}
                        disabled={busy}
                        className='text-destructive hover:bg-destructive/10 hover:text-destructive'>
                        <HugeiconsIcon
                            icon={Delete02Icon}
                            className='size-3.5'
                        />
                    </Button>
                )}
            </span>

            {/* F7 consequence dialogs: what happens to future dates, what
                happens to booked ones, and the one-tap alternative. */}
            <AlertDialog
                open={confirming !== null}
                onOpenChange={open => !open && setConfirming(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirming === 'remove'
                                ? `Remove the ${pattern.startTime} rule?`
                                : `Pause the ${pattern.startTime} rule?`}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirming === 'remove'
                                ? 'No new dates will be created from this rule. '
                                : 'This stops creating new dates from today. '}
                            Dates already on sale stay on sale, and departures
                            with bookings are kept. To stop selling specific
                            dates now, close them on the calendar below
                            instead.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={
                                confirming === 'remove'
                                    ? removeAll
                                    : toggleActive
                            }>
                            {confirming === 'remove'
                                ? 'Remove rule'
                                : 'Pause rule'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ── Start times (the tour's declared departure-time slot set) ─────────────────

interface StartTimesSectionProps {
    tripId: string;
    declaredStartTimes: string[];
    // Existing schedules, to block removing a time that a schedule still uses.
    schedules: TourSchedule[];
    /**
     * Drop the Card chrome. The creation wizard supplies its own collapsible
     * section header, so a nested card-in-card would double the border.
     */
    bare?: boolean;
}

// The tour's declared start times. Recurring schedules and date exceptions can
// only target times in this set (backend rule, master §2.1), so they are managed
// here alongside the schedules that consume them. Each add/remove persists to the
// tour immediately (PATCH), matching the schedule/exception rows.
export function StartTimesSection({
    tripId,
    declaredStartTimes,
    schedules,
    bare = false,
}: StartTimesSectionProps) {
    const { mutate: updateTrip, isPending } = useUpdateTrip();
    const [draft, setDraft] = useState('09:00');
    // Inline error shown under the time input (client validation + server error).
    const [error, setError] = useState<string | null>(null);

    const times = [...new Set(declaredStartTimes)].sort();
    // How many recurring schedules use a given start time. Removing a time still in
    // use would orphan those schedules, so the UI locks its remove control.
    const scheduleCountFor = (t: string) =>
        schedules.filter(s => s.startTime === t).length;

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
                },
                onError: err =>
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to add start time.'
                    ),
            }
        );
    }

    function removeTime(t: string) {
        // Defensive: the UI disables removal for in-use times, but guard anyway so a
        // declared time a schedule still uses can never be orphaned.
        if (scheduleCountFor(t) > 0) return;
        updateTrip(
            { id: tripId, payload: { startTimes: times.filter(x => x !== t) } },
            {
                onError: err =>
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to remove start time.'
                    ),
            }
        );
    }

    const body = (
        <div className='space-y-4'>
            {times.length > 0 ? (
                <TooltipProvider>
                    <div className='flex flex-wrap gap-2'>
                        {times.map(t => {
                            const usedBy = scheduleCountFor(t);
                            return (
                                <Badge
                                    key={t}
                                    variant='secondary'
                                    className='gap-1.5 pr-1 tabular-nums'>
                                    <span>{t}</span>
                                    {usedBy > 0 ? (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span
                                                    className='rounded-sm p-0.5 text-muted-foreground/40 cursor-not-allowed'
                                                    aria-label={`${t} is used by ${usedBy} schedule${usedBy > 1 ? 's' : ''}`}>
                                                    <HugeiconsIcon
                                                        icon={Cancel01Icon}
                                                        className='size-3'
                                                    />
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                In use by {usedBy} schedule
                                                {usedBy > 1 ? 's' : ''}. Remove{' '}
                                                {usedBy > 1 ? 'them' : 'it'}{' '}
                                                first to delete this time.
                                            </TooltipContent>
                                        </Tooltip>
                                    ) : (
                                        <button
                                            type='button'
                                            onClick={() => removeTime(t)}
                                            disabled={isPending}
                                            className='rounded-sm hover:bg-foreground/10 p-0.5 transition-colors disabled:opacity-50'
                                            aria-label={`Remove ${t}`}>
                                            <HugeiconsIcon
                                                icon={Cancel01Icon}
                                                className='size-3'
                                            />
                                        </button>
                                    )}
                                </Badge>
                            );
                        })}
                    </div>
                </TooltipProvider>
            ) : (
                <p className='text-sm text-muted-foreground'>
                    No start times declared yet. Add at least one before
                    creating schedules.
                </p>
            )}
            <div>
                <div className='flex items-end gap-2'>
                    <Input
                        value={draft}
                        onChange={e => {
                            setDraft(e.target.value);
                            if (error) setError(null);
                        }}
                        placeholder='HH:MM (e.g. 09:00)'
                        inputMode='numeric'
                        aria-invalid={!!error}
                        className='h-9 w-40'
                    />
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={addTime}
                        disabled={isPending}
                        className='h-9'>
                        <HugeiconsIcon
                            icon={PlusSignIcon}
                            className='size-3.5'
                        />
                        Add time
                    </Button>
                </div>
                {error && (
                    <p className='text-xs text-destructive mt-1.5'>{error}</p>
                )}
            </div>
        </div>
    );

    if (bare) return body;

    return (
        <Card>
            <CardHeader className='border-b pb-4'>
                <CardTitle className='text-lg font-medium'>
                    Start times
                </CardTitle>
                <p className='text-sm text-muted-foreground mt-1'>
                    The tour&apos;s declared departure times. The weekly
                    schedule and one-off date changes can only use times
                    declared here.
                </p>
            </CardHeader>
            <CardContent className='pt-6'>{body}</CardContent>
        </Card>
    );
}

// ── Recurring schedules ───────────────────────────────────────────────────────

interface RecurringSchedulesSectionProps {
    tripId: string;
    /**
     * The tour-level default every schedule without an override falls back on.
     * NOT NULL since `20260729190000` - so a capacity override is always
     * genuinely optional here, and the "this tour has no default, enter one"
     * warning and required marker that used to live on this form are gone.
     */
    maxPartySize: number;
    declaredStartTimes: string[];
    /**
     * F10: a unit-priced private charter never gets seat copy - one booking
     * takes the whole departure, maxPartySize is a guest ceiling (not seats),
     * and the capacity override is hidden (it invites "raise capacity for more
     * bookings", which is an extra-departure question, not a capacity one).
     */
    pricingModel?: PricingModel;
    /** Drop the Card chrome - the wizard supplies its own section header. */
    bare?: boolean;
}

/**
 * The weekly departure pattern: one backend row per (weekday, start time).
 * Extracted from the tab so the creation wizard can place it in its own
 * collapsible section without duplicating a line of this logic.
 */
export function RecurringSchedulesSection({
    tripId,
    maxPartySize,
    declaredStartTimes,
    pricingModel = 'PER_PERSON',
    bare = false,
}: RecurringSchedulesSectionProps) {
    const isUnit = pricingModel === 'UNIT';
    const { data: schedules, isLoading } = useSchedules(tripId);
    const { mutateAsync: createSchedule, isPending: isCreating } =
        useCreateSchedule();

    // The add form stays closed until asked for. Open, it puts a SECOND
    // weekday picker and a SECOND time picker on screen, ~250px below the
    // weekday tabs and the times they already show - the same seven words and
    // the same two times, twice, doing different jobs. Collapsing it means
    // reviewing the pattern and editing it are no longer the same screen.
    const [adding, setAdding] = useState(false);
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

    // One backend row per weekday × start time, grouped into pattern rows
    // (F6): "16:30 · Mon-Sun, not Fri" is one row, not seven behind tabs.
    const patterns = groupPatterns(schedules ?? []);
    const totalSchedules = schedules?.length ?? 0;
    // The F6 gap hint: weekdays no rule covers at all, named quietly instead
    // of hidden behind a "Fri 0" tab nobody clicks.
    const coveredWeekdays = new Set((schedules ?? []).map(s => s.weekday));
    const gapDays = WEEKDAYS.filter(w => !coveredWeekdays.has(w.value));

    // The tour's declared start times, de-duped and sorted. When present, the form
    // constrains the picker to these so a slot can never be rejected on save.
    const declaredTimes = [...new Set(declaredStartTimes)].sort();
    const hasDeclaredTimes = declaredTimes.length > 0;

    const clearError = (key: keyof typeof errors) =>
        setErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev));

    function toggleWeekday(day: number) {
        clearError('weekdays');
        setWeekdays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    }

    // Toggle one of the declared start times in/out of this schedule's selection.
    function toggleTime(t: string) {
        clearError('startTimes');
        setStartTimes(prev =>
            prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t].sort()
        );
    }

    function addTime() {
        const t = timeInput.trim();
        if (!HHMM.test(t)) {
            setErrors(p => ({
                ...p,
                startTimes: 'Time must be HH:MM (00:00-23:59).',
            }));
            return;
        }
        if (startTimes.includes(t)) {
            setErrors(p => ({ ...p, startTimes: 'Time already added.' }));
            return;
        }
        clearError('startTimes');
        setStartTimes(prev => [...prev, t].sort());
    }

    function removeTime(t: string) {
        setStartTimes(prev => prev.filter(x => x !== t));
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
        if (weekdays.length === 0)
            next.weekdays = 'Select at least one weekday.';
        if (startTimes.length === 0)
            next.startTimes = 'Add at least one start time.';
        // Unit tours never send an override - the field is hidden (F10) and a
        // stale draft value must not sneak into the payload behind it.
        const cap =
            !isUnit && capacity.trim() ? Number(capacity) : undefined;
        if (cap !== undefined && (!Number.isInteger(cap) || cap < 1)) {
            next.capacity =
                'Capacity override must be a whole number of at least 1.';
        }
        if (Object.keys(next).length > 0) {
            setErrors(next);
            return;
        }
        setErrors({});

        // Attempt every weekday×startTime row together. The old sequential
        // `await` loop aborted on the first failure, leaving the earlier rows
        // created; resubmitting then hit duplicate-key on those already-created
        // rows (code-review M10). settleAll runs them all and reports the split.
        const combos = weekdays.flatMap(weekday =>
            startTimes.map(startTime => ({ weekday, startTime })),
        );
        const { succeeded, failed } = await settleAll(combos, ({ weekday, startTime }) =>
            createSchedule({
                tripId,
                payload: {
                    weekday,
                    startTime,
                    capacityOverride: cap,
                    validFrom: validFrom || undefined,
                    validUntil: validUntil || undefined,
                },
            }),
        );

        if (failed.length === 0) {
            resetForm();
            setAdding(false);
            return;
        }
        // Partial: the succeeded rows are persisted (and now in the list). Tell
        // the operator so they can narrow the selection to just the rest rather
        // than resubmitting the whole grid into duplicate-key errors.
        //
        // And say WHY, in the server's own words. A bare count cannot tell
        // "Tuesday at 13:00 already exists" from "the API is down", and those
        // need opposite responses: one is deselect that day, the other is stop
        // and call someone. On 2026-08-08 an unapplied migration made every
        // call 500 and this line reported it as an ordinary partial failure, so
        // the operator kept retrying a form that could not succeed.
        setErrors({
            form: [
                `${succeeded.length} added, ${failed.length} could not be added.`,
                succeeded.length > 0 &&
                    'The added schedules are saved — adjust the selection and add the rest.',
                describeFailures(failed),
            ]
                .filter(Boolean)
                .join(' '),
        });
    }

    const body = (
        <div className='space-y-4'>
            {isLoading ? (
                <div className='space-y-2'>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className='h-14 w-full rounded-md' />
                    ))}
                </div>
            ) : totalSchedules > 0 ? (
                /* Grouped pattern rows (F6, supersedes the 2026-07-17 weekday
               tabs per the July 29 availability review): one row per
               (time × identical settings), the week as chips on the row. */
                <div>
                    {patterns.map(p => (
                        <PatternRow
                            key={p.key}
                            pattern={p}
                            tripId={tripId}
                            capacityLabel={
                                isUnit
                                    ? `Private charter · 1 booking per departure (up to ${maxPartySize} guests)`
                                    : p.capacityOverride != null
                                      ? `${p.capacityOverride} seats`
                                      : `${maxPartySize} seats (tour default)`
                            }
                        />
                    ))}
                    {gapDays.length > 0 && gapDays.length < 7 && (
                        <p className='pt-2.5 text-xs text-content-subtle'>
                            No departures on{' '}
                            {gapDays.map(w => `${w.full}s`).join(' or ')}.
                        </p>
                    )}
                </div>
            ) : (
                <p className='text-sm text-muted-foreground text-center py-6'>
                    No weekly departure times yet.
                </p>
            )}

            {!adding && (
                <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => setAdding(true)}
                    className='-ml-2 text-primary'>
                    <HugeiconsIcon icon={PlusSignIcon} className='size-3.5' />
                    Add schedule
                </Button>
            )}

            {/* A border and nothing else - no fill. This is a TRANSIENT
                editing surface, so an outline is enough to separate the fields
                you are filling in from the schedules you are reading above.
                Adding a background would make it a card, which is the thing
                this whole redesign took out.

                `hidden` rather than unmounted so a half-filled form survives
                a close and reopen. */}
            <div
                className={cn(
                    'space-y-4 rounded-lg border border-line p-4',
                    !adding && 'hidden',
                )}>
                <p className='text-sm font-semibold text-content'>
                    New schedule
                </p>

                <Field>
                    <Label>
                        Weekdays <span className='text-destructive'>*</span>
                    </Label>
                    <div className='flex flex-wrap gap-1.5'>
                        {WEEKDAYS.map(w => (
                            <button
                                key={w.value}
                                type='button'
                                onClick={() => toggleWeekday(w.value)}
                                className={cn(
                                    'h-9 min-w-12 rounded-md px-3 text-xs font-medium border transition-colors duration-fast',
                                    weekdays.includes(w.value)
                                        ? 'border-foreground bg-foreground text-background'
                                        : 'border-input hover:bg-muted'
                                )}>
                                {w.label}
                            </button>
                        ))}
                    </div>
                    {errors.weekdays && (
                        <p className='text-xs text-destructive mt-1.5'>
                            {errors.weekdays}
                        </p>
                    )}
                </Field>

                <Field>
                    <Label>
                        Start times <span className='text-destructive'>*</span>
                    </Label>
                    {hasDeclaredTimes ? (
                        <>
                            <p className='text-xs text-muted-foreground -mt-1 mb-1'>
                                Pick from the tour&apos;s declared start times
                                (edit the set in Departure times above).
                            </p>
                            <div className='flex flex-wrap gap-1.5'>
                                {declaredTimes.map(t => (
                                    <button
                                        key={t}
                                        type='button'
                                        onClick={() => toggleTime(t)}
                                        className={cn(
                                            'h-9 min-w-16 px-3 text-xs font-medium border transition-colors tabular-nums',
                                            startTimes.includes(t)
                                                ? 'border-foreground bg-foreground text-background'
                                                : 'border-input hover:bg-muted'
                                        )}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className='flex gap-2.5 bg-warning-subtle border border-warning-border px-3 py-2.5 mb-2'>
                                <HugeiconsIcon
                                    icon={Alert02Icon}
                                    className='size-4 shrink-0 text-warning-fg mt-0.5'
                                />
                                <p className='text-sm text-warning-fg'>
                                    This tour has no declared start times yet.
                                    Add them in Departure times above so schedules
                                    stay consistent; any time entered here that
                                    is not declared will be rejected on save.
                                </p>
                            </div>
                            {startTimes.length > 0 && (
                                <div className='flex flex-wrap gap-2 mb-2'>
                                    {startTimes.map(t => (
                                        <Badge
                                            key={t}
                                            variant='secondary'
                                            className='gap-1.5 pr-1'>
                                            <span>{t}</span>
                                            <button
                                                type='button'
                                                onClick={() => removeTime(t)}
                                                className='rounded-sm hover:bg-foreground/10 p-0.5 transition-colors'
                                                aria-label={`Remove ${t}`}>
                                                <HugeiconsIcon
                                                    icon={Cancel01Icon}
                                                    className='size-3'
                                                />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            <div className='flex items-end gap-2'>
                                <Input
                                    value={timeInput}
                                    onChange={e => setTimeInput(e.target.value)}
                                    placeholder='HH:MM (e.g. 09:00)'
                                    inputMode='numeric'
                                    className='h-9 w-40'
                                />
                                <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    onClick={addTime}
                                    className='h-9'>
                                    <HugeiconsIcon
                                        icon={PlusSignIcon}
                                        className='size-3.5'
                                    />
                                    Add time
                                </Button>
                            </div>
                        </>
                    )}
                    {errors.startTimes && (
                        <p className='text-xs text-destructive mt-1.5'>
                            {errors.startTimes}
                        </p>
                    )}
                </Field>

                {/* F10: no seat-capacity control on a private charter - one
                    booking takes the whole departure. Running two boats is an
                    extra-departure question, answered on the calendar. */}
                {!isUnit && (
                    <Field>
                        <Label>Capacity override (optional)</Label>
                        <Input
                            type='number'
                            min={1}
                            value={capacity}
                            onChange={e => {
                                setCapacity(e.target.value);
                                clearError('capacity');
                            }}
                            placeholder={`Leave blank for ${maxPartySize} seats`}
                            aria-invalid={!!errors.capacity}
                            className='max-w-xs'
                        />
                        {errors.capacity && (
                            <p className='text-xs text-destructive mt-1.5'>
                                {errors.capacity}
                            </p>
                        )}
                    </Field>
                )}

                <div className='grid grid-cols-2 gap-4'>
                    <Field>
                        <Label>Valid from</Label>
                        <DatePickerField
                            value={validFrom}
                            onChange={setValidFrom}
                            placeholder='Defaults to today'
                            clearable
                        />
                    </Field>
                    <Field>
                        <Label>Valid until</Label>
                        <DatePickerField
                            value={validUntil}
                            onChange={setValidUntil}
                            placeholder='Open-ended'
                            clearable
                        />
                    </Field>
                </div>

                {errors.form && (
                    <p className='text-sm text-destructive'>{errors.form}</p>
                )}
                <div className='flex justify-end gap-2'>
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => {
                            resetForm();
                            setAdding(false);
                        }}
                        disabled={isCreating}>
                        Cancel
                    </Button>
                    <Button
                        type='button'
                        size='sm'
                        onClick={handleCreate}
                        disabled={isCreating}>
                        {isCreating ? 'Adding...' : 'Add schedule'}
                    </Button>
                </div>
            </div>
        </div>
    );

    if (bare) return body;

    return (
        <Card>
            <CardHeader className='border-b pb-4'>
                <CardTitle className='text-lg font-medium'>
                    Weekly schedule
                </CardTitle>
                <p className='text-sm text-muted-foreground mt-1'>
                    The departure times this tour repeats every week. The
                    calendar shows the result.
                </p>
            </CardHeader>
            <CardContent className='pt-6'>{body}</CardContent>
        </Card>
    );
}

