'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  useReviewRequests,
  useUpdateReviewRequests,
} from '@/hooks/settings/use-settings';
import {
  CheckboxField,
  SettingsCard,
  SettingsCardSkeleton,
  TextField,
} from './settings-fields';

/**
 * Bounds mirror `UpdateReviewRequestsDto` on the backend. Kept in sync by hand:
 * the backend rejects out-of-range values regardless, this only moves the error
 * from a 400 toast to an inline message.
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

const schema = z.object({
  enabled: z.boolean(),
  firstSendLocalHour: num(0, 23),
  firstSendDelayDays: num(0, 14),
  reminderEnabled: z.boolean(),
  reminderAfterDays: num(1, 30),
  giveUpAfterDays: num(1, 180),
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

/**
 * Post-tour review invitation cadence (master point: review collection).
 *
 * These were hardcoded constants until it became clear they are a business
 * decision, not an engineering one - the advisory is explicit that the
 * morning-after send is a launch default to A/B test, not a proven optimum.
 *
 * `enabled` ships FALSE. A job that mails real customers is switched on
 * deliberately by a person, never merely by deploying the code that contains
 * it, so the switch is prominent and its save confirmation states the resulting
 * state in words rather than a generic "saved".
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
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (data) {
      reset({
        enabled: data.enabled,
        firstSendLocalHour: data.firstSendLocalHour,
        firstSendDelayDays: data.firstSendDelayDays,
        reminderEnabled: data.reminderEnabled,
        reminderAfterDays: data.reminderAfterDays,
        giveUpAfterDays: data.giveUpAfterDays,
        batchSize: data.batchSize,
      });
    }
  }, [data, reset]);

  if (isLoading) return <SettingsCardSkeleton />;

  const values = watch();
  const enabled = values.enabled;
  const reminderEnabled = values.reminderEnabled;

  return (
    <SettingsCard
      title="Review Requests"
      description="When the platform emails a guest to ask for a review after their tour. Two touches maximum, then silence."
      onSubmit={handleSubmit((v) => save(v))}
      isSaving={saving}
    >
      <CheckboxField
        id="review-requests-enabled"
        label="Send review request emails"
        description="Master switch. While off the hourly job runs and does nothing - it does not even create invitations, so switching it on later cannot fire a backlog of stale emails at once."
        checked={enabled}
        onChange={(v) => setValue('enabled', v, { shouldDirty: true })}
      />

      {/* Reads back the seven numbers as one sentence. */}
      <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
        <p className="m-0 text-xs text-muted-foreground">
          {enabled ? (
            summarise(values)
          ) : (
            <span>
              No emails are being sent. The schedule below is saved but dormant
              until the switch above is on.
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

      <CheckboxField
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
