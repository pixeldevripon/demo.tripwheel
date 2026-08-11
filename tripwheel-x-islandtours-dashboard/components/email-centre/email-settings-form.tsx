'use client';

/**
 * The email switchboard (H-13): the FULL settings payload from
 * `GET /email/settings` — four group switches, sales/reply-to addresses, all
 * six onboarding timings, the send window (weekdays + hours), the MK-1 delay
 * and the review-request slice — one form, one Save.
 *
 * Tri-state semantics drive everything here. Each email-settings field is
 * either NULL in `stored` (the env/built-in default applies — the field
 * shows "Using default (X)" from the GET's `defaults`) or set explicitly
 * ("Set here", with a "Use default" action that PATCHes null to clear the
 * override). Submit sends ONLY the fields the admin changed.
 *
 * DELIBERATELY ABSENT: any switch for the booking emails (BK-1/BK-2/CX-1).
 * They are contractual and always-on (founder decision 2026-08-11) — the
 * backend 400s any attempt to invent one, and this form renders a note
 * saying so instead of a control.
 */

import {
    REVIEW_REQUEST_BOUNDS,
    clockLabel,
} from '@/lib/settings/review-request-bounds';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsCardSkeleton } from '@/components/settings/settings-fields';
import {
    useEmailSettings,
    useUpdateEmailSettings,
} from '@/hooks/email-centre/use-email-centre';
import type {
    EmailSettingsScalarKey,
    EmailSettingsStored,
    ReviewRequestSettingsSlice,
    UpdateEmailSettingsPayload,
} from '@/types/email-centre';

// ── Validation (mirrors the backend DTO bounds; the API re-validates) ───────

/**
 * STRICT single bare mailbox, byte-for-byte the backend's EMAIL_SHAPE: no
 * commas, no angle brackets, no spaces, exactly one @ — these values become
 * live Reply-To headers, so a smuggled second address is a silent BCC.
 */
const EMAIL_SHAPE = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;

const WEEKDAYS = [
    ['mon', 'Mon'],
    ['tue', 'Tue'],
    ['wed', 'Wed'],
    ['thu', 'Thu'],
    ['fri', 'Fri'],
    ['sat', 'Sat'],
    ['sun', 'Sun'],
] as const;

type Weekday = (typeof WEEKDAYS)[number][0];

type Draft = Omit<EmailSettingsStored, 'review'>;

type ScalarKey = EmailSettingsScalarKey;

interface NumberBounds {
    min: number;
    max: number;
}

/** Backend bounds per field (UpdateEmailSettingsDto). */
const NUMBER_BOUNDS: Partial<Record<ScalarKey, NumberBounds>> = {
    ob3DelayHours: { min: 1, max: 720 },
    ob4DelayDays: { min: 1, max: 90 },
    ob6DelayDays: { min: 1, max: 90 },
    ob7AfterLiveDays: { min: 1, max: 90 },
    ob8AfterLiveDays: { min: 1, max: 90 },
    pendingReminderBusinessDays: { min: 1, max: 90 },
    windowStartHour: { min: 0, max: 23 },
    windowEndHour: { min: 1, max: 24 },
    mk1DelayHours: { min: 1, max: 720 },
};

/** Review-slice bounds - the shared dashboard owner (review of #57, Low 5). */
const REVIEW_BOUNDS: Record<
    Exclude<keyof ReviewRequestSettingsSlice, 'enabled'>,
    NumberBounds
> = REVIEW_REQUEST_BOUNDS;

const ADDRESS_KEYS = ['salesEmail', 'mailReplyTo', 'ob6ReplyTo'] as const;

function intError(value: number, { min, max }: NumberBounds): string | null {
    if (!Number.isInteger(value)) return 'Whole numbers only';
    if (value < min || value > max) return `Must be ${min}-${max}`;
    return null;
}

// ── Display helpers ──────────────────────────────────────────────────────────

function boolLabel(v: boolean): string {
    return v ? 'On' : 'Off';
}

function weekdaysLabel(csv: string): string {
    return csv
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
        .join(', ');
}



// ── Shared field chrome ──────────────────────────────────────────────────────

/**
 * The tri-state hint line every override field carries: "Using default (X)"
 * while stored is null, or a "Set here" marker plus the clear-to-default
 * action once the admin stored a value.
 */
function OverrideHint({
    overridden,
    defaultLabel,
    onClear,
}: {
    overridden: boolean;
    defaultLabel: string;
    onClear: () => void;
}) {
    if (!overridden) {
        return (
            <p className='m-0 text-xs text-muted-foreground'>
                Using default ({defaultLabel})
            </p>
        );
    }
    return (
        <p className='m-0 flex flex-wrap items-center gap-2 text-xs'>
            <span className='rounded-full bg-info-subtle px-2 py-0.5 font-medium text-info-fg'>
                Set here
            </span>
            <span className='text-muted-foreground'>
                Default: {defaultLabel}
            </span>
            <button
                type='button'
                onClick={onClear}
                className='font-medium text-foreground underline underline-offset-4 hover:no-underline'>
                Use default
            </button>
        </p>
    );
}

function SwitchSetting({
    id,
    label,
    description,
    value,
    defaultValue,
    onChange,
    onClear,
}: {
    id: string;
    label: string;
    description: string;
    /** The draft's stored value — null means the default applies. */
    value: boolean | null;
    defaultValue: boolean;
    onChange: (checked: boolean) => void;
    onClear: () => void;
}) {
    return (
        <div className='space-y-1.5'>
            <div className='flex items-center gap-2'>
                <Checkbox
                    id={id}
                    checked={value ?? defaultValue}
                    onCheckedChange={(c) => onChange(!!c)}
                />
                <Label htmlFor={id} className='cursor-pointer'>
                    {label}
                </Label>
            </div>
            <p className='m-0 text-xs text-muted-foreground'>{description}</p>
            <OverrideHint
                overridden={value !== null}
                defaultLabel={boolLabel(defaultValue)}
                onClear={onClear}
            />
        </div>
    );
}

function NumberSetting({
    label,
    description,
    value,
    defaultValue,
    onChange,
    onClear,
    error,
}: {
    label: string;
    description?: string;
    value: number | null;
    defaultValue: number;
    onChange: (value: number | null) => void;
    onClear: () => void;
    error?: string;
}) {
    return (
        <div className='space-y-1.5'>
            <Label>{label}</Label>
            <Input
                type='number'
                value={value ?? ''}
                placeholder={String(defaultValue)}
                aria-invalid={!!error}
                onChange={(e) => {
                    const raw = e.target.value;
                    // Blank = back to the default (same as "Use default").
                    onChange(raw === '' ? null : Number(raw));
                }}
            />
            {description && (
                <p className='m-0 text-xs text-muted-foreground'>
                    {description}
                </p>
            )}
            {error && <p className='m-0 text-xs text-danger-fg'>{error}</p>}
            <OverrideHint
                overridden={value !== null}
                defaultLabel={String(defaultValue)}
                onClear={onClear}
            />
        </div>
    );
}

function AddressSetting({
    label,
    description,
    value,
    defaultValue,
    onChange,
    onClear,
    error,
}: {
    label: string;
    description: string;
    value: string | null;
    /** Addresses can have NO default at all (env unset). */
    defaultValue: string | null;
    onChange: (value: string | null) => void;
    onClear: () => void;
    error?: string;
}) {
    return (
        <div className='space-y-1.5'>
            <Label>{label}</Label>
            <Input
                type='email'
                value={value ?? ''}
                placeholder={defaultValue ?? 'no default configured'}
                aria-invalid={!!error}
                autoComplete='off'
                onChange={(e) => {
                    const raw = e.target.value;
                    onChange(raw === '' ? null : raw);
                }}
            />
            <p className='m-0 text-xs text-muted-foreground'>{description}</p>
            {error && <p className='m-0 text-xs text-danger-fg'>{error}</p>}
            <OverrideHint
                overridden={value !== null}
                defaultLabel={defaultValue ?? 'not set'}
                onClear={onClear}
            />
        </div>
    );
}

function WeekdayPicker({
    value,
    defaultCsv,
    onChange,
    onClear,
    error,
}: {
    value: string | null;
    defaultCsv: string;
    onChange: (csv: string | null) => void;
    onClear: () => void;
    error?: string;
}) {
    const selected = new Set(
        (value ?? defaultCsv)
            .split(',')
            .map((d) => d.trim().toLowerCase())
            .filter(Boolean) as Weekday[],
    );

    function toggle(day: Weekday) {
        const next = new Set(selected);
        if (next.has(day)) next.delete(day);
        else next.add(day);
        // Rebuild in week order so the stored csv is stable and readable.
        const csv = WEEKDAYS.map(([d]) => d)
            .filter((d) => next.has(d))
            .join(',');
        onChange(csv);
    }

    return (
        <div className='space-y-1.5'>
            <Label>Send-window weekdays</Label>
            <div className='flex flex-wrap gap-1.5'>
                {WEEKDAYS.map(([day, label]) => {
                    const on = selected.has(day);
                    return (
                        <button
                            key={day}
                            type='button'
                            aria-pressed={on}
                            onClick={() => toggle(day)}
                            className={
                                on
                                    ? 'rounded-full border border-info-border bg-info-subtle px-3 py-1 text-xs font-medium text-info-fg'
                                    : 'rounded-full border border-line bg-surface-inset px-3 py-1 text-xs text-content-muted hover:text-foreground'
                            }>
                            {label}
                        </button>
                    );
                })}
            </div>
            <p className='m-0 text-xs text-muted-foreground'>
                Days the lifecycle nudges (OB-3…OB-8, INT1R) may go out.
                Marketing keeps the hour window below but ignores the weekday
                list.
            </p>
            {error && <p className='m-0 text-xs text-danger-fg'>{error}</p>}
            <OverrideHint
                overridden={value !== null}
                defaultLabel={weekdaysLabel(defaultCsv)}
                onClear={onClear}
            />
        </div>
    );
}

function SectionHeading({
    title,
    description,
}: {
    title: string;
    description?: string;
}) {
    return (
        <div>
            <h3 className='m-0 text-sm font-medium'>{title}</h3>
            {description && (
                <p className='m-0 mt-1 text-xs text-muted-foreground'>
                    {description}
                </p>
            )}
        </div>
    );
}

// ── The form ─────────────────────────────────────────────────────────────────

export function EmailSettingsForm() {
    const { data, isLoading, isError } = useEmailSettings();
    const { mutate: save, isPending: saving } = useUpdateEmailSettings();

    const [draft, setDraft] = useState<Draft | null>(null);
    const [review, setReview] = useState<ReviewRequestSettingsSlice | null>(
        null,
    );
    const [apiError, setApiError] = useState<string | null>(null);

    // Reset from the server whenever fresh data lands (the review-requests
    // form precedent) - including right after a save, whose response is the
    // fresh GET shape written back into the query cache.
    useEffect(() => {
        if (data) {
            const { review: storedReview, ...scalars } = data.stored;
            setDraft(scalars);
            setReview({ ...storedReview });
        }
    }, [data]);

    const set = <K extends ScalarKey>(key: K, value: Draft[K]) => {
        setDraft((d) => (d ? { ...d, [key]: value } : d));
    };
    const setReviewField = <K extends keyof ReviewRequestSettingsSlice>(
        key: K,
        value: ReviewRequestSettingsSlice[K],
    ) => {
        setReview((r) => (r ? { ...r, [key]: value } : r));
    };

    // ── Dirty diff: submit ONLY what changed ───────────────────────────────
    const { payload, dirtyCount } = useMemo(() => {
        const out: UpdateEmailSettingsPayload = {};
        let count = 0;
        if (data && draft) {
            const { review: storedReview, ...storedScalars } = data.stored;
            for (const key of Object.keys(storedScalars) as ScalarKey[]) {
                if (draft[key] !== storedScalars[key]) {
                    // Tri-state: a value stores an override, null clears it.
                    (out as Record<string, unknown>)[key] = draft[key];
                    count++;
                }
            }
            if (review) {
                const reviewPatch: Partial<ReviewRequestSettingsSlice> = {};
                for (const key of Object.keys(
                    storedReview,
                ) as (keyof ReviewRequestSettingsSlice)[]) {
                    if (review[key] !== storedReview[key]) {
                        (reviewPatch as Record<string, unknown>)[key] =
                            review[key];
                        count++;
                    }
                }
                if (Object.keys(reviewPatch).length > 0) {
                    out.review = reviewPatch;
                }
            }
        }
        return { payload: out, dirtyCount: count };
    }, [data, draft, review]);

    // ── Client validation, mirroring the DTO bounds ────────────────────────
    const errors = useMemo(() => {
        const out: Partial<Record<string, string>> = {};
        if (!data || !draft || !review) return out;

        for (const [key, bounds] of Object.entries(NUMBER_BOUNDS) as [
            ScalarKey,
            NumberBounds,
        ][]) {
            const value = draft[key];
            if (typeof value === 'number') {
                const err = intError(value, bounds);
                if (err) out[key] = err;
            }
        }
        for (const key of ADDRESS_KEYS) {
            const value = draft[key];
            if (typeof value === 'string' && !EMAIL_SHAPE.test(value)) {
                out[key] =
                    'Must be a single bare email address (no names, lists or spaces)';
            }
        }
        if (draft.windowWeekdays !== null && draft.windowWeekdays === '') {
            out.windowWeekdays = 'Keep at least one weekday selected';
        }
        // The backend validates start<end on the MERGED values (stored ??
        // default) - mirror exactly that, so the inline error matches the
        // 400 the API would send.
        const mergedStart =
            draft.windowStartHour ?? data.defaults.windowStartHour;
        const mergedEnd = draft.windowEndHour ?? data.defaults.windowEndHour;
        if (
            !out.windowStartHour &&
            !out.windowEndHour &&
            mergedStart >= mergedEnd
        ) {
            out.windowEndHour = `The window must open before it closes (currently ${clockLabel(
                mergedStart,
            )}-${clockLabel(mergedEnd)})`;
        }

        for (const [key, bounds] of Object.entries(REVIEW_BOUNDS) as [
            Exclude<keyof ReviewRequestSettingsSlice, 'enabled'>,
            NumberBounds,
        ][]) {
            const value = review[key];
            if (Number.isNaN(value)) {
                out[`review.${key}`] = 'Required';
            } else {
                const err = intError(value, bounds);
                if (err) out[`review.${key}`] = err;
            }
        }
        return out;
    }, [data, draft, review]);

    const hasErrors = Object.keys(errors).length > 0;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (dirtyCount === 0 || hasErrors) return;
        setApiError(null);
        save(payload, {
            onSuccess: () => {
                toast.success('Email settings saved');
            },
            onError: (err) => {
                // The API's 400 explains bounds and the window rule - show
                // its own words, inline and as a toast.
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Failed to save email settings.';
                setApiError(message);
                toast.error(message);
            },
        });
    }

    if (isLoading || !draft || !review || !data) {
        if (isError) {
            return (
                <p className='text-sm text-danger-fg'>
                    Could not load the email settings. Reload to try again.
                </p>
            );
        }
        return <SettingsCardSkeleton />;
    }

    const { defaults } = data;

    return (
        <form onSubmit={handleSubmit}>
            <Card>
                <CardHeader className='border-b'>
                    <CardTitle>Email programme</CardTitle>
                    <p className='m-0 mt-1 text-sm font-light normal-case tracking-normal text-muted-foreground'>
                        Every value falls back to its default until set here -
                        &ldquo;Using default (…)&rdquo; means nothing is
                        stored and the platform keeps its configured
                        behaviour. Leaving a box blank, or &ldquo;Use
                        default&rdquo;, clears an override.
                    </p>
                </CardHeader>
                <CardContent className='space-y-8 pt-8'>
                    {/* ── Group switches ─────────────────────────────── */}
                    <div className='space-y-6'>
                        <SectionHeading
                            title='Email groups'
                            description='Group switches only. Booking emails (confirmation, pre-tour reminder, cancellation) are contractual and always on - there is deliberately no switch for them.'
                        />
                        <SwitchSetting
                            id='email-marketing-enabled'
                            label='Marketing emails (MK-1 next adventure)'
                            description='The post-tour marketing email to consented travellers. Off = nothing is queued; nobody is skipped permanently.'
                            value={draft.marketingEnabled}
                            defaultValue={defaults.marketingEnabled}
                            onChange={(v) => set('marketingEnabled', v)}
                            onClear={() => set('marketingEnabled', null)}
                        />
                        <SwitchSetting
                            id='email-onboarding-enabled'
                            label='Onboarding nudges (OB-3 … OB-8)'
                            description='The operator drip after approval and first tour live. Off = "not yet": the sweep skips everyone without burning their slot, so switching back on resumes cleanly.'
                            value={draft.onboardingEnabled}
                            defaultValue={defaults.onboardingEnabled}
                            onChange={(v) => set('onboardingEnabled', v)}
                            onClear={() => set('onboardingEnabled', null)}
                        />
                        <SwitchSetting
                            id='email-calendar-enabled'
                            label='Calendar email (OB-7 connect your calendar)'
                            description='Only sent while calendar sync is offered; suppressed for operators who already connected a feed.'
                            value={draft.calendarEmailEnabled}
                            defaultValue={defaults.calendarEmailEnabled}
                            onChange={(v) => set('calendarEmailEnabled', v)}
                            onClear={() => set('calendarEmailEnabled', null)}
                        />
                        <SwitchSetting
                            id='email-ob8-partner'
                            label='OB-8 photo-partner offer block'
                            description='The Dronebaas partner block inside "Make your page stronger". The email itself still sends when this is off - only the block is dropped.'
                            value={draft.ob8PartnerOffer}
                            defaultValue={defaults.ob8PartnerOffer}
                            onChange={(v) => set('ob8PartnerOffer', v)}
                            onClear={() => set('ob8PartnerOffer', null)}
                        />
                    </div>

                    <div className='border-t pt-8 space-y-6'>
                        <SectionHeading
                            title='Addresses'
                            description='One bare mailbox each - no display names, no comma lists. These become live Reply-To headers and internal-alert recipients.'
                        />
                        <div className='grid gap-6 sm:grid-cols-2'>
                            <AddressSetting
                                label='Sales inbox'
                                description='Where new-operator and new-tour alerts (INT-1, INT-2, INT1R) go.'
                                value={draft.salesEmail}
                                defaultValue={defaults.salesEmail}
                                onChange={(v) => set('salesEmail', v)}
                                onClear={() => set('salesEmail', null)}
                                error={errors.salesEmail}
                            />
                            <AddressSetting
                                label='Default Reply-To'
                                description='The Reply-To header on every platform email unless a template overrides it.'
                                value={draft.mailReplyTo}
                                defaultValue={defaults.mailReplyTo}
                                onChange={(v) => set('mailReplyTo', v)}
                                onClear={() => set('mailReplyTo', null)}
                                error={errors.mailReplyTo}
                            />
                            <AddressSetting
                                label='OB-6 Reply-To (founder check-in)'
                                description='Replies to the founder check-in email land here. Falls back to the default Reply-To.'
                                value={draft.ob6ReplyTo}
                                defaultValue={defaults.ob6ReplyTo}
                                onChange={(v) => set('ob6ReplyTo', v)}
                                onClear={() => set('ob6ReplyTo', null)}
                                error={errors.ob6ReplyTo}
                            />
                        </div>
                    </div>

                    <div className='border-t pt-8 space-y-6'>
                        <SectionHeading
                            title='Onboarding schedule'
                            description='When each nudge becomes due, anchored on approval or first tour live. Shortening a delay only makes not-yet-sent nudges due sooner; already-sent ones never repeat.'
                        />
                        <div className='grid gap-6 sm:grid-cols-2'>
                            <NumberSetting
                                label='OB-3 first-tour how-to - hours after approval'
                                description='1-720 hours.'
                                value={draft.ob3DelayHours}
                                defaultValue={defaults.ob3DelayHours}
                                onChange={(v) => set('ob3DelayHours', v)}
                                onClear={() => set('ob3DelayHours', null)}
                                error={errors.ob3DelayHours}
                            />
                            <NumberSetting
                                label="OB-4 we'll build it with you - days after approval"
                                description='1-90 days.'
                                value={draft.ob4DelayDays}
                                defaultValue={defaults.ob4DelayDays}
                                onChange={(v) => set('ob4DelayDays', v)}
                                onClear={() => set('ob4DelayDays', null)}
                                error={errors.ob4DelayDays}
                            />
                            <NumberSetting
                                label='OB-6 founder check-in - days after approval'
                                description='1-90 days.'
                                value={draft.ob6DelayDays}
                                defaultValue={defaults.ob6DelayDays}
                                onChange={(v) => set('ob6DelayDays', v)}
                                onClear={() => set('ob6DelayDays', null)}
                                error={errors.ob6DelayDays}
                            />
                            <NumberSetting
                                label='OB-7 connect calendar - days after first tour live'
                                description='1-90 days.'
                                value={draft.ob7AfterLiveDays}
                                defaultValue={defaults.ob7AfterLiveDays}
                                onChange={(v) => set('ob7AfterLiveDays', v)}
                                onClear={() => set('ob7AfterLiveDays', null)}
                                error={errors.ob7AfterLiveDays}
                            />
                            <NumberSetting
                                label='OB-8 page stronger - days after first tour live'
                                description='1-90 days.'
                                value={draft.ob8AfterLiveDays}
                                defaultValue={defaults.ob8AfterLiveDays}
                                onChange={(v) => set('ob8AfterLiveDays', v)}
                                onClear={() => set('ob8AfterLiveDays', null)}
                                error={errors.ob8AfterLiveDays}
                            />
                            <NumberSetting
                                label='INT1R pending reminder - business days'
                                description='How long an operator may sit pending review before sales is reminded. 1-90 business days.'
                                value={draft.pendingReminderBusinessDays}
                                defaultValue={
                                    defaults.pendingReminderBusinessDays
                                }
                                onChange={(v) =>
                                    set('pendingReminderBusinessDays', v)
                                }
                                onClear={() =>
                                    set('pendingReminderBusinessDays', null)
                                }
                                error={errors.pendingReminderBusinessDays}
                            />
                        </div>
                    </div>

                    <div className='border-t pt-8 space-y-6'>
                        <SectionHeading
                            title='Send window'
                            description='Lifecycle nudges only go out inside this window, America/Curacao time. The opening hour is inclusive, the closing hour exclusive.'
                        />
                        <WeekdayPicker
                            value={draft.windowWeekdays}
                            defaultCsv={defaults.windowWeekdays}
                            onChange={(v) => set('windowWeekdays', v)}
                            onClear={() => set('windowWeekdays', null)}
                            error={errors.windowWeekdays}
                        />
                        <div className='grid gap-6 sm:grid-cols-2'>
                            <NumberSetting
                                label='Window opens (hour, 0-23)'
                                description='Inclusive, America/Curacao.'
                                value={draft.windowStartHour}
                                defaultValue={defaults.windowStartHour}
                                onChange={(v) => set('windowStartHour', v)}
                                onClear={() => set('windowStartHour', null)}
                                error={errors.windowStartHour}
                            />
                            <NumberSetting
                                label='Window closes (hour, 1-24)'
                                description='Exclusive - must stay above the opening hour.'
                                value={draft.windowEndHour}
                                defaultValue={defaults.windowEndHour}
                                onChange={(v) => set('windowEndHour', v)}
                                onClear={() => set('windowEndHour', null)}
                                error={errors.windowEndHour}
                            />
                        </div>
                    </div>

                    <div className='border-t pt-8 space-y-6'>
                        <SectionHeading
                            title='Marketing timing'
                            description='MK-1 fires this long after the tour ends, then waits for the next morning window (hours above; weekdays never apply to marketing).'
                        />
                        <div className='grid gap-6 sm:grid-cols-2'>
                            <NumberSetting
                                label='MK-1 delay - hours after tour end'
                                description='1-720 hours.'
                                value={draft.mk1DelayHours}
                                defaultValue={defaults.mk1DelayHours}
                                onChange={(v) => set('mk1DelayHours', v)}
                                onClear={() => set('mk1DelayHours', null)}
                                error={errors.mk1DelayHours}
                            />
                        </div>
                    </div>

                    {/* ── Review-request slice ───────────────────────── */}
                    <div className='border-t pt-8 space-y-6'>
                        <SectionHeading
                            title='Review requests (BK-3 / BK-3R)'
                            description='Written to the review-request schedule, not the email settings - these values are always explicit, so there is no "using default" state here. The reminder on/off switch and batch size live in Settings > Review Requests.'
                        />
                        <div className='space-y-1.5'>
                            <div className='flex items-center gap-2'>
                                <Checkbox
                                    id='email-review-enabled'
                                    checked={review.enabled}
                                    onCheckedChange={(c) =>
                                        setReviewField('enabled', !!c)
                                    }
                                />
                                <Label
                                    htmlFor='email-review-enabled'
                                    className='cursor-pointer'>
                                    Send review request emails
                                </Label>
                            </div>
                            <p className='m-0 text-xs text-muted-foreground'>
                                Master switch for the post-tour review
                                invitations.
                            </p>
                        </div>
                        <div className='grid gap-6 sm:grid-cols-2'>
                            <ReviewNumberField
                                label='First send - days after the tour (0-14)'
                                value={review.firstSendDelayDays}
                                onChange={(v) =>
                                    setReviewField('firstSendDelayDays', v)
                                }
                                error={errors['review.firstSendDelayDays']}
                            />
                            <ReviewNumberField
                                label="First send - local hour (0-23, tour's timezone)"
                                value={review.firstSendLocalHour}
                                onChange={(v) =>
                                    setReviewField('firstSendLocalHour', v)
                                }
                                error={errors['review.firstSendLocalHour']}
                            />
                            <ReviewNumberField
                                label='Reminder - days after the first send (1-30)'
                                value={review.reminderAfterDays}
                                onChange={(v) =>
                                    setReviewField('reminderAfterDays', v)
                                }
                                error={errors['review.reminderAfterDays']}
                            />
                            <ReviewNumberField
                                label='Give up after (days, 1-180)'
                                value={review.giveUpAfterDays}
                                onChange={(v) =>
                                    setReviewField('giveUpAfterDays', v)
                                }
                                error={errors['review.giveUpAfterDays']}
                            />
                        </div>
                    </div>

                    {/* ── Save row ───────────────────────────────────── */}
                    <div className='flex flex-wrap items-center justify-between gap-3 border-t pt-6'>
                        <p className='m-0 text-xs text-muted-foreground'>
                            {dirtyCount === 0
                                ? 'No changes yet - only fields you touch are sent.'
                                : `${dirtyCount} change${dirtyCount === 1 ? '' : 's'} to save.`}
                        </p>
                        <Button
                            type='submit'
                            disabled={saving || dirtyCount === 0 || hasErrors}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                    {apiError && (
                        <p className='m-0 text-sm text-danger-fg'>
                            {apiError}
                        </p>
                    )}
                </CardContent>
            </Card>
        </form>
    );
}

/** Concrete (never-null) number field for the review slice. */
function ReviewNumberField({
    label,
    value,
    onChange,
    error,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    error?: string;
}) {
    return (
        <div className='space-y-1.5'>
            <Label>{label}</Label>
            <Input
                type='number'
                value={Number.isNaN(value) ? '' : value}
                aria-invalid={!!error}
                onChange={(e) => {
                    const raw = e.target.value;
                    // NaN marks "emptied" - validation blocks the save until
                    // a number is back (this slice has no null state).
                    onChange(raw === '' ? Number.NaN : Number(raw));
                }}
            />
            {error && <p className='m-0 text-xs text-danger-fg'>{error}</p>}
        </div>
    );
}
