'use client';

import { REVIEW_REQUEST_BOUNDS } from '@/lib/settings/review-request-bounds';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSyncFormWhenPristine } from '@/hooks/use-sync-form-when-pristine';
import {
  useReviewRequests,
  useUpdateReviewRequests,
} from '@/hooks/settings/use-settings';
import type { ReviewRequestSettings } from '@/types/settings';
import {
  SettingsCard,
  SettingsCardSkeleton,
  SwitchField,
  TextField,
} from './settings-fields';

/**
 * Bounds mirror `UpdateReviewRequestsDto` on the backend. Four of the five
 * come from `lib/settings/review-request-bounds.ts`, the single dashboard
 * owner (review of #57, Low 5) — this form used to hardcode its own copy
 * beside that module's, which is exactly the drift it exists to prevent.
 * `batchSize` stays local: it is this endpoint's alone, never part of the
 * email-settings payload. The backend rejects out-of-range values regardless;
 * these only move the error from a 400 toast to an inline message.
 *
 * Plain `z.number()` rather than `z.coerce.number()` - zod 4 types a coerced
 * input as `unknown`, which no longer matches the form's number fields. The
 * numbers arrive already converted because every numeric input below registers
 * with `valueAsNumber`; an empty box arrives as NaN, which `z.number()` rejects.
 */
const num = (min: number, max: number) =>
  z
    .number({ message: 'Required' })
    .int('Whole numbers only')
    .min(min)
    .max(max);

const bounded = (key: keyof typeof REVIEW_REQUEST_BOUNDS) =>
  num(REVIEW_REQUEST_BOUNDS[key].min, REVIEW_REQUEST_BOUNDS[key].max);

const schema = z.object({
  enabled: z.boolean(),
  firstSendLocalHour: bounded('firstSendLocalHour'),
  firstSendDelayDays: bounded('firstSendDelayDays'),
  reminderEnabled: z.boolean(),
  reminderAfterDays: bounded('reminderAfterDays'),
  giveUpAfterDays: bounded('giveUpAfterDays'),
  batchSize: num(1, 2000),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  enabled: false,
  firstSendLocalHour: 10,
  firstSendDelayDays: 1,
  reminderEnabled: true,
  reminderAfterDays: 5,
  giveUpAfterDays: 30,
  batchSize: 200,
};

/** "10" -> "10:00", so the hour field reads as a clock time in the summary. */
function clock(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * Plain-English restatement of the seven numbers above it. The fields are
 * individually clear and collectively hard to hold in your head, and this is a
 * schedule that mails real customers - the person flipping it on should be able
 * to read back what they just configured without simulating it mentally.
 */
function summarise(v: FormValues): string {
  const first =
    v.firstSendDelayDays === 0
      ? `the same day at ${clock(v.firstSendLocalHour)}`
      : v.firstSendDelayDays === 1
        ? `the morning after, at ${clock(v.firstSendLocalHour)}`
        : `${v.firstSendDelayDays} days later, at ${clock(v.firstSendLocalHour)}`;

  const reminder = v.reminderEnabled
    ? ` One reminder follows ${v.reminderAfterDays} day${v.reminderAfterDays === 1 ? '' : 's'} after that, then silence.`
    : ' No reminder is sent - one touch only.';

  return `A guest who finished a tour is invited ${first} in the tour's own timezone.${reminder} Bookings older than ${v.giveUpAfterDays} days are never chased.`;
}

/** Server row → form values. */
function toValues(data: ReviewRequestSettings | undefined): FormValues {
  if (!data) return EMPTY;
  return {
    enabled: data.enabled,
    firstSendLocalHour: data.firstSendLocalHour,
    firstSendDelayDays: data.firstSendDelayDays,
    reminderEnabled: data.reminderEnabled,
    reminderAfterDays: data.reminderAfterDays,
    giveUpAfterDays: data.giveUpAfterDays,
    batchSize: data.batchSize,
  };
}

/**
 * Post-tour review invitation cadence (master point: review collection).
 *
 * These were hardcoded constants until it became clear they are a business
 * decision, not an engineering one - the advisory is explicit that the
 * morning-after send is a launch default to A/B test, not a proven optimum.
 *
 * `enabled` ships FALSE - a job that mails real customers is switched on
 * deliberately by a person, never merely by deploying the code that contains
 * it - but the switch itself is NOT here any more (founder decision
 * 2026-08-12). It sits with the other group switches in Settings → Email →
 * Email Groups, which reads and writes it through the settings PATCH's
 * `review` slice and states the resulting state in words when it saves.
 *
 * This form owns everything else about the schedule, and deliberately does
 * not send `enabled` back: two writers for one field means the later save
 * silently reverts the earlier switch flip. It still READS the value, to say
 * whether the schedule below is live or dormant.
 */
export function ReviewRequestsForm() {
  const { data, isLoading } = useReviewRequests();
  const { mutate: save, isPending: saving } = useUpdateReviewRequests();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  // Re-sync from the server on a refetch, but NEVER over unsaved edits. The
  // master switch lives in Settings → Email → Email Groups now, and saving it
  // refetches this row - an unguarded reset would wipe a half-typed cadence
  // the moment someone flipped that switch.
  useSyncFormWhenPristine(reset, isDirty, () => toValues(data), data);

  if (isLoading) return <SettingsCardSkeleton />;

  const values = watch();
  const enabled = values.enabled;
  const reminderEnabled = values.reminderEnabled;

  return (
    <SettingsCard
      title="Review Requests"
      description="When the platform emails a guest to ask for a review after their tour. Two touches maximum, then silence. The on/off switch is under Email Groups."
      onSubmit={handleSubmit(({ enabled: _enabled, ...schedule }) =>
        // `enabled` is owned by Settings → Email → Email Groups; sending it
        // from here too would make the last save win over a switch the admin
        // may have flipped in between. The DTO takes a partial payload.
        save(schedule, { onSuccess: (result) => reset(toValues(result)) }),
      )}
      isSaving={saving}
    >
      {/* Reads back the numbers as one sentence. */}
      <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
        <p className="m-0 text-xs text-muted-foreground">
          {enabled ? (
            summarise(values)
          ) : (
            <span>
              No emails are being sent. This schedule is saved but dormant
              until <strong>Review request emails</strong> is switched on
              under Email Groups.
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label="First send - days after the tour"
          type="number"
          description="1 = the morning after. 0 sends on the tour day itself."
          registration={register('firstSendDelayDays', { valueAsNumber: true })}
          error={errors.firstSendDelayDays?.message}
          placeholder="1"
        />
        <TextField
          label="First send - local hour (0-23)"
          type="number"
          description="Read in the TOUR's timezone, not the server's. 'The morning after' is a different instant on every island."
          registration={register('firstSendLocalHour', { valueAsNumber: true })}
          error={errors.firstSendLocalHour?.message}
          placeholder="10"
        />
      </div>

      <SwitchField
        id="review-requests-reminder"
        label="Send one reminder"
        description="A single follow-up to guests who did not respond. There is never a second reminder."
        checked={reminderEnabled}
        onChange={(v) => setValue('reminderEnabled', v, { shouldDirty: true })}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label="Reminder - days after the first send"
          type="number"
          description="5-7 days is better supported than a 72-hour nudge and matches TripAdvisor's roughly one-week practice."
          registration={register('reminderAfterDays', { valueAsNumber: true })}
          error={errors.reminderAfterDays?.message}
          placeholder="5"
          disabled={!reminderEnabled}
        />
        <TextField
          label="Give up after (days)"
          type="number"
          description="Stop chasing a booking older than this - a very late invitation reads as spam rather than service."
          registration={register('giveUpAfterDays', { valueAsNumber: true })}
          error={errors.giveUpAfterDays?.message}
          placeholder="30"
        />
      </div>

      <TextField
        label="Batch size per hourly run"
        type="number"
        description="Max invitations processed each hour, so a backlog cannot empty the mail quota in one pass."
        registration={register('batchSize', { valueAsNumber: true })}
        error={errors.batchSize?.message}
        placeholder="200"
      />
    </SettingsCard>
  );
}
