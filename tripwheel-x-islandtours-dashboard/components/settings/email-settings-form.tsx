'use client';

/**
 * The email switchboard (H-13): the settings payload from
 * `GET /email/settings` — four group switches, sales/reply-to addresses, all
 * six onboarding timings, the send window (weekdays + hours) and the
 * marketing delay. Rendered as the Settings → Email tab (founder reorg
 * 2026-08-12; it used to be its own /email/settings page), split into
 * sub-tabs the way the Integration tab is.
 *
 * Two components live here:
 *
 * - `EmailSettingsForm` — the tab shell. Owns the sub-tab, decides which
 *   cards the seat may see, and hosts the review-invitation card.
 * - `SwitchboardCard` — the email settings themselves: one form, one Save.
 *   The sub-tabs are presentation only; all four panels stay mounted (hidden,
 *   not unmounted) and share a single draft + dirty diff, so edits made
 *   across several tabs land in one PATCH and the "N changes" counter is the
 *   truth for all of them.
 *
 * Tri-state semantics drive the switchboard. Each field is either NULL in
 * `stored` (the env/built-in default applies — the field shows "Using
 * default (X)" from the GET's `defaults`) or set explicitly ("Set here",
 * with a "Use default" action that PATCHes null to clear the override).
 * Submit sends ONLY the fields the admin changed.
 *
 * The Schedules tab additionally shows `ReviewRequestsForm` as a SECOND card
 * with its own Save (founder request 2026-08-12: the review invitation timing
 * belongs with the other send timings). It stays a separate component and a
 * separate endpoint on purpose — it owns the whole review schedule including
 * the reminder switch and batch size, which the email settings payload never
 * carried, and it answers to a different permission (see the shell's note).
 *
 * DELIBERATELY ABSENT:
 * - Any switch for the booking emails (confirmation, pre-tour reminder,
 *   cancellation). They are contractual and always-on (founder decision
 *   2026-08-11) — the backend 400s any attempt to invent one, and this form
 *   renders a note saying so instead of a control.
 * - The review slice of the settings payload. The backend PATCH still accepts
 *   it, but writing the same rows from two forms on one screen is how they
 *   drift; `ReviewRequestsForm` is the single writer.
 */

import { clockLabel } from '@/lib/settings/review-request-bounds';
import { useSearchParams } from 'next/navigation';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRole } from '@/contexts/role-context';
import { ReviewRequestsForm } from './review-requests-form';
import { SettingsCardSkeleton } from './settings-fields';
import {
    useEmailSettings,
    useUpdateEmailSettings,
} from '@/hooks/email-centre/use-email-centre';
import type {
    EmailSettingsScalarKey,
    EmailSettingsStored,
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

// ── Sub-tabs ─────────────────────────────────────────────────────────────────

type SubTab = 'switches' | 'addresses' | 'schedules' | 'window';

const SUB_TABS: Array<{ value: SubTab; label: string }> = [
    { value: 'switches', label: 'Email Groups' },
    { value: 'addresses', label: 'Addresses' },
    { value: 'schedules', label: 'Schedules' },
    { value: 'window', label: 'Send Window' },
];

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
                Days the operator lifecycle nudges and internal reminders may
                go out. Marketing keeps the hour window but ignores the
                weekday list.
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

// ── The tab shell ────────────────────────────────────────────────────────────

/**
 * Owns the sub-tab, and decides which of the two cards a seat may see.
 *
 * The permission split is the whole reason this is a shell rather than one
 * component: the switchboard's API is `MANAGE_SYSTEM`, but the review
 * schedule's is `VIEW_SETTINGS`/`MANAGE_SETTINGS`, and a platform-staff seat
 * can hold the latter while `MANAGE_SYSTEM` is *permanently* out of reach
 * (backend `staff.config.ts` lists it in `PLATFORM_STAFF_EXCLUDED`). Nesting
 * the review card inside a MANAGE_SYSTEM-gated card would have orphaned a
 * capability the backend still grants — no screen anywhere for it. So such a
 * seat gets the review card alone, and `SwitchboardCard` never mounts, which
 * also means its gated GET never fires.
 */
export function EmailSettingsForm() {
    const { can } = useRole();
    const searchParams = useSearchParams();

    const [activeTab, setActiveTab] = useState<SubTab>(() => {
        const requested = searchParams.get('section');
        return SUB_TABS.some((t) => t.value === requested)
            ? (requested as SubTab)
            : 'switches';
    });
    // Mount the review card on first visit to Schedules, then keep it mounted
    // so a half-typed cadence survives a trip to another tab. Without this it
    // would fetch its schedule on every visit to Settings → Email, including
    // the three tabs that have nothing to do with it.
    const [reviewVisited, setReviewVisited] = useState(
        () => activeTab === 'schedules',
    );

    function switchTab(next: string) {
        const tab = next as SubTab;
        setActiveTab(tab);
        if (tab === 'schedules') setReviewVisited(true);
        // Deep-linkable, the way EntityTabs does it one level up: update the
        // URL without a navigation, preserving `?tab=email` beside it.
        const params = new URLSearchParams(window.location.search);
        params.set('section', tab);
        window.history.replaceState(
            null,
            '',
            `${window.location.pathname}?${params}`,
        );
    }

    if (!can('MANAGE_SYSTEM')) return <ReviewRequestsForm />;

    return (
        <div>
            <Tabs value={activeTab} onValueChange={switchTab}>
                <div className='mb-6'>
                    <TabsList>
                        {SUB_TABS.map((t) => (
                            <TabsTrigger key={t.value} value={t.value}>
                                {t.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>
            </Tabs>

            <SwitchboardCard activeTab={activeTab} />

            {/*
              * The review-invitation schedule: its own endpoint, its own Save.
              * It lives OUT here rather than in the Schedules panel because
              * that panel is inside the switchboard's `<form>` — a nested form
              * is invalid HTML whose submit never fires — and because a failed
              * `GET /email/settings` must not take this card down with it.
              *
              * The gap rides on this element rather than a `space-y` on the
              * wrapper: Tailwind v4 compiles space-y to `> :not(:last-child)`,
              * which would leave a trailing gap under the card on the other
              * three tabs. `hidden` is display:none, so `mt-6` renders only
              * when the panel does.
              */}
            {reviewVisited && (
                <div hidden={activeTab !== 'schedules'} className='mt-6'>
                    <ReviewRequestsForm />
                </div>
            )}
        </div>
    );
}

// ── The switchboard ──────────────────────────────────────────────────────────

function SwitchboardCard({ activeTab }: { activeTab: SubTab }) {
    const { data, isLoading, isError } = useEmailSettings();
    const { mutate: save, isPending: saving } = useUpdateEmailSettings();

    const [draft, setDraft] = useState<Draft | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);

    // Reset from the server whenever fresh data lands (the review-requests
    // form precedent) - including right after a save, whose response is the
    // fresh GET shape written back into the query cache.
    useEffect(() => {
        if (data) {
            const { review: _review, ...scalars } = data.stored;
            setDraft(scalars);
        }
    }, [data]);

    const set = <K extends ScalarKey>(key: K, value: Draft[K]) => {
        setDraft((d) => (d ? { ...d, [key]: value } : d));
    };

    // ── Dirty diff: submit ONLY what changed ───────────────────────────────
    const { payload, dirtyCount } = useMemo(() => {
        const out: UpdateEmailSettingsPayload = {};
        let count = 0;
        if (data && draft) {
            const { review: _review, ...storedScalars } = data.stored;
            for (const key of Object.keys(storedScalars) as ScalarKey[]) {
                if (draft[key] !== storedScalars[key]) {
                    // Tri-state: a value stores an override, null clears it.
                    (out as Record<string, unknown>)[key] = draft[key];
                    count++;
                }
            }
        }
        return { payload: out, dirtyCount: count };
    }, [data, draft]);

    // ── Client validation, mirroring the DTO bounds ────────────────────────
    const errors = useMemo(() => {
        const out: Partial<Record<string, string>> = {};
        if (!data || !draft) return out;

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
        return out;
    }, [data, draft]);

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

    if (isLoading || !draft || !data) {
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
        // `noValidate`: the panels stay mounted while hidden, and a browser
        // refuses to submit a form whose invalid control it cannot focus -
        // silently, with nothing to click. A stray `12e` typed on one tab
        // would deaden Save on all four. This form mirrors the DTO bounds
        // itself and the API re-validates, so native validation only ever
        // subtracts here.
        <form onSubmit={handleSubmit} noValidate>
            <Card>
                <CardHeader className='border-b'>
                    <CardTitle>Email programme</CardTitle>
                    <p className='m-0 mt-1 text-sm font-light normal-case tracking-normal text-muted-foreground'>
                        Every value falls back to its default until set here -
                        &ldquo;Using default (…)&rdquo; means nothing is
                        stored and the platform keeps its configured
                        behaviour. Leaving a box blank, or &ldquo;Use
                        default&rdquo;, clears an override. This Save covers
                        all four tabs; the review-invitation card under
                        Schedules saves on its own.
                    </p>
                </CardHeader>
                <CardContent className='space-y-8 pt-8'>
                    {/* ── Group switches ─────────────────────────────── */}
                    <div
                        hidden={activeTab !== 'switches'}
                        className='space-y-6'>
                        <SectionHeading
                            title='Email groups'
                            description='Group switches only. Booking emails (confirmation, pre-tour reminder, cancellation) are contractual and always on - there is deliberately no switch for them.'
                        />
                        <SwitchSetting
                            id='email-marketing-enabled'
                            label='Marketing emails ("Your next adventure")'
                            description='The post-tour marketing email to consented travellers. Off = nothing is queued; nobody is skipped permanently.'
                            value={draft.marketingEnabled}
                            defaultValue={defaults.marketingEnabled}
                            onChange={(v) => set('marketingEnabled', v)}
                            onClear={() => set('marketingEnabled', null)}
                        />
                        <SwitchSetting
                            id='email-onboarding-enabled'
                            label='Onboarding nudges'
                            description='The operator drip after approval and first tour live. Off = "not yet": the sweep skips everyone without burning their slot, so switching back on resumes cleanly.'
                            value={draft.onboardingEnabled}
                            defaultValue={defaults.onboardingEnabled}
                            onChange={(v) => set('onboardingEnabled', v)}
                            onClear={() => set('onboardingEnabled', null)}
                        />
                        <SwitchSetting
                            id='email-calendar-enabled'
                            label='Calendar email ("Connect your calendar")'
                            description='Only sent while calendar sync is offered; suppressed for operators who already connected a feed.'
                            value={draft.calendarEmailEnabled}
                            defaultValue={defaults.calendarEmailEnabled}
                            onChange={(v) => set('calendarEmailEnabled', v)}
                            onClear={() => set('calendarEmailEnabled', null)}
                        />
                        <SwitchSetting
                            id='email-ob8-partner'
                            label='Photo-partner offer block'
                            description='The Dronebaas partner block inside the "Make your page stronger" email. That email still sends when this is off - only the block is dropped.'
                            value={draft.ob8PartnerOffer}
                            defaultValue={defaults.ob8PartnerOffer}
                            onChange={(v) => set('ob8PartnerOffer', v)}
                            onClear={() => set('ob8PartnerOffer', null)}
                        />
                    </div>

                    {/* ── Addresses ──────────────────────────────────── */}
                    <div
                        hidden={activeTab !== 'addresses'}
                        className='space-y-6'>
                        <SectionHeading
                            title='Addresses'
                            description='One bare mailbox each - no display names, no comma lists. These become live Reply-To headers and internal-alert recipients.'
                        />
                        <div className='grid gap-6 sm:grid-cols-2'>
                            <AddressSetting
                                label='Sales inbox'
                                description='Where new-operator and new-tour alerts go.'
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
                                label='Founder check-in Reply-To'
                                description='Replies to the founder check-in email land here. Falls back to the default Reply-To.'
                                value={draft.ob6ReplyTo}
                                defaultValue={defaults.ob6ReplyTo}
                                onChange={(v) => set('ob6ReplyTo', v)}
                                onClear={() => set('ob6ReplyTo', null)}
                                error={errors.ob6ReplyTo}
                            />
                        </div>
                    </div>

                    {/* ── Schedules ──────────────────────────────────── */}
                    <div
                        hidden={activeTab !== 'schedules'}
                        className='space-y-8'>
                        <div className='space-y-6'>
                            <SectionHeading
                                title='Onboarding schedule'
                                description='When each nudge becomes due, anchored on approval or first tour live. Shortening a delay only makes not-yet-sent nudges due sooner; already-sent ones never repeat.'
                            />
                            <div className='grid gap-6 sm:grid-cols-2'>
                                <NumberSetting
                                    label='First-tour how-to - hours after approval'
                                    description='1-720 hours.'
                                    value={draft.ob3DelayHours}
                                    defaultValue={defaults.ob3DelayHours}
                                    onChange={(v) => set('ob3DelayHours', v)}
                                    onClear={() => set('ob3DelayHours', null)}
                                    error={errors.ob3DelayHours}
                                />
                                <NumberSetting
                                    label="We'll build it with you - days after approval"
                                    description='1-90 days.'
                                    value={draft.ob4DelayDays}
                                    defaultValue={defaults.ob4DelayDays}
                                    onChange={(v) => set('ob4DelayDays', v)}
                                    onClear={() => set('ob4DelayDays', null)}
                                    error={errors.ob4DelayDays}
                                />
                                <NumberSetting
                                    label='Founder check-in - days after approval'
                                    description='1-90 days.'
                                    value={draft.ob6DelayDays}
                                    defaultValue={defaults.ob6DelayDays}
                                    onChange={(v) => set('ob6DelayDays', v)}
                                    onClear={() => set('ob6DelayDays', null)}
                                    error={errors.ob6DelayDays}
                                />
                                <NumberSetting
                                    label='Connect calendar - days after first tour live'
                                    description='1-90 days.'
                                    value={draft.ob7AfterLiveDays}
                                    defaultValue={defaults.ob7AfterLiveDays}
                                    onChange={(v) => set('ob7AfterLiveDays', v)}
                                    onClear={() =>
                                        set('ob7AfterLiveDays', null)
                                    }
                                    error={errors.ob7AfterLiveDays}
                                />
                                <NumberSetting
                                    label='Make your page stronger - days after first tour live'
                                    description='1-90 days.'
                                    value={draft.ob8AfterLiveDays}
                                    defaultValue={defaults.ob8AfterLiveDays}
                                    onChange={(v) => set('ob8AfterLiveDays', v)}
                                    onClear={() =>
                                        set('ob8AfterLiveDays', null)
                                    }
                                    error={errors.ob8AfterLiveDays}
                                />
                                <NumberSetting
                                    label='Pending-operator reminder - business days'
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
                                title='Marketing timing'
                                description='The "next adventure" email fires this long after the tour ends, then waits for the next morning window (hours under Send Window; weekdays never apply to marketing).'
                            />
                            <div className='grid gap-6 sm:grid-cols-2'>
                                <NumberSetting
                                    label='Marketing delay - hours after tour end'
                                    description='1-720 hours.'
                                    value={draft.mk1DelayHours}
                                    defaultValue={defaults.mk1DelayHours}
                                    onChange={(v) => set('mk1DelayHours', v)}
                                    onClear={() => set('mk1DelayHours', null)}
                                    error={errors.mk1DelayHours}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Send window ────────────────────────────────── */}
                    <div hidden={activeTab !== 'window'} className='space-y-6'>
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

                    {/* ── Save row (always visible, spans all tabs) ──── */}
                    <div className='flex flex-wrap items-center justify-between gap-3 border-t pt-6'>
                        <p className='m-0 text-xs text-muted-foreground'>
                            {dirtyCount === 0
                                ? 'No changes yet - only fields you touch are sent.'
                                : `${dirtyCount} change${dirtyCount === 1 ? '' : 's'} to save (across all tabs).`}
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
