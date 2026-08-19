'use client';

/**
 * Step 7 - Description and content (07 §3).
 *
 * Every word a traveller reads, in one place. The old editor scattered these
 * across six tabs (Text, Highlights, Inclusions, Exclusions, Info & Terms,
 * plus the languages card stranded on Details), which meant writing a listing
 * involved hunting for where the next paragraph lived.
 *
 * The important structural decision: the 12 English body fields are grouped
 * into four collapsible sections but share ONE react-hook-form and ONE save.
 * The translation upsert writes every field it knows about, so two writers on
 * that record would clobber each other - grouping is presentation only. See
 * `lib/trips/tour-copy.ts`.
 *
 * Highlights, inclusions, exclusions, features and languages are child
 * collections that persist as the operator works, exactly as they do today.
 */

import { Cancel01Icon, PlusSignIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
    useExclusions,
    useFeatures,
    useHighlights,
    useInclusions,
    useLanguages,
    useTripTranslationByLocale,
    useUpsertTripTranslation,
} from '@/hooks/trips/use-trips';
import {
    countSummary,
    filledSummary,
    gateSummary,
} from '@/lib/trips/section-summary';
import {
    buildTourCopyPayload,
    findCopyField,
    isLinesField,
    toCopyFormValue,
    TOUR_COPY_FIELDS,
    TOUR_COPY_GROUPS,
    TOUR_COPY_HINTS,
    TOUR_COPY_REQUIRED,
} from '@/lib/trips/tour-copy';
import type { TripListItem } from '@/types/trip';
import { TripExclusionsTab } from '../../trip-exclusions-tab';
import { TripFeaturesTab } from '../../trip-features-tab';
import { TripHighlightsTab } from '../../trip-highlights-tab';
import { TripInclusionsTab } from '../../trip-inclusions-tab';
import { LanguagesCard } from '../../trip-languages-card';
import { TripAdvancedSection } from '../trip-advanced-section';
import { useSyncFormWhenPristine } from '@/hooks/use-sync-form-when-pristine';
import { useStepCommit } from '../use-step-commit';
import { useWizard } from '../wizard-context';
import { WizardSection } from '../wizard-section';
import {
    focusFirstInvalid,
    WizardStepBody,
    WizardStepHeader,
} from '../wizard-step';

const REQUIRED_HIGHLIGHTS = 3;

interface StepContentProps {
    trip: TripListItem;
}

export function StepContent({ trip }: StepContentProps) {
    // Every one of these queries is already in cache from the list component
    // inside its own section, so reading counts here costs no extra request -
    // it just lets a CLOSED section say what is in it.
    const { data: highlights } = useHighlights(trip.id);
    const { data: inclusions } = useInclusions(trip.id);
    const { data: exclusions } = useExclusions(trip.id);
    const { data: features } = useFeatures(trip.id);
    const { data: languages } = useLanguages(trip.id);
    const highlightCount = highlights?.length ?? trip.highlightCount ?? 0;

    return (
        <>
            <WizardStepHeader step='content' />
            <WizardStepBody>
                <TourCopySections tripId={trip.id} />

                <WizardSection
                    id='highlights'
                    title='Highlights'
                    summary={gateSummary(
                        highlightCount,
                        REQUIRED_HIGHLIGHTS,
                        'highlight',
                    )}>
                    <TripHighlightsTab bare tripId={trip.id} />
                </WizardSection>

                {/* No descriptions on these three: "Everything covered by the
                    price" under a heading that reads "What's included" is the
                    heading again. Guide languages keeps one, because that is
                    the only place the wrong answer is plausible - an operator
                    can easily read it as the website's languages. */}
                <WizardSection
                    id='inclusions'
                    title="What's included"
                    summary={countSummary(inclusions?.length ?? 0, 'item')}>
                    <TripInclusionsTab bare tripId={trip.id} />
                </WizardSection>

                <WizardSection
                    id='exclusions'
                    title="What's not included"
                    summary={countSummary(exclusions?.length ?? 0, 'item')}>
                    <TripExclusionsTab bare tripId={trip.id} />
                </WizardSection>

                <WizardSection
                    id='info'
                    title='Info and terms'
                    summary={countSummary(features?.length ?? 0, 'note')}>
                    <TripFeaturesTab bare tripId={trip.id} />
                </WizardSection>

                <WizardSection
                    id='languages'
                    title='Guide languages'
                    description='The spoken languages your guide runs the tour in - not the website language.'
                    summary={countSummary(
                        languages?.length ?? 0,
                        'language',
                    )}>
                    <LanguagesCard bare tripId={trip.id} />
                </WizardSection>

                {/* The third slice of the old Details form. Registers its own
                    commit alongside the copy form above - the footer runs
                    both. */}
                <TripAdvancedSection trip={trip} step='content' />
            </WizardStepBody>
        </>
    );
}

/**
 * A list that looks like a list.
 *
 * `whatToBring`, `knowBeforeYouGo` and `notSuitableFor` are stored as string
 * ARRAYS. The form has always held them as one newline-joined blob in a
 * textarea, with "One item per line." underneath as the only clue - so an
 * operator who typed a normal paragraph got one enormous bullet on their live
 * page, and never found out why.
 *
 * This is presentation only. The value handed back is still newline-joined,
 * and `buildTourCopyPayload` still splits and filters it, so the request body
 * is byte-identical to what the textarea produced. Enter adds the next row
 * (the habit a list invites), backspace on an empty row removes it.
 */
function LineListField({
    id,
    label,
    value,
    placeholder,
    addLabel,
    onChange,
}: {
    id: string;
    /** Names each row for screen readers - only row 1 gets the visible label. */
    label: string;
    value: string;
    placeholder?: string;
    addLabel: string;
    onChange: (next: string) => void;
}) {
    // Always render at least one row - an empty list with no input is a dead
    // end that only an "Add" button rescues.
    const items = value === '' ? [''] : value.split('\n');
    const inputs = useRef<(HTMLInputElement | null)[]>([]);
    const [focusIndex, setFocusIndex] = useState<number | null>(null);

    useEffect(() => {
        if (focusIndex === null) return;
        inputs.current[focusIndex]?.focus();
        setFocusIndex(null);
    }, [focusIndex]);

    function commit(next: string[]) {
        onChange(next.join('\n'));
    }

    function setAt(index: number, text: string) {
        const next = [...items];
        next[index] = text;
        commit(next);
    }

    function insertAfter(index: number) {
        const next = [...items];
        next.splice(index + 1, 0, '');
        commit(next);
        setFocusIndex(index + 1);
    }

    function removeAt(index: number) {
        const next = items.filter((_, i) => i !== index);
        commit(next.length ? next : ['']);
        setFocusIndex(Math.max(0, index - 1));
    }

    return (
        <div>
            {items.map((item, index) => (
                // A bulleted line, not a row of boxes. Three stacked input
                // fields read as three separate questions; a list of bullets
                // reads as one answer with three parts, which is what it is.
                <div
                    key={index}
                    className='flex items-center gap-2 py-0.5'>
                    <span
                        aria-hidden
                        className='size-1 shrink-0 rounded-full bg-content-subtle'
                    />
                    <input
                        id={index === 0 ? id : undefined}
                        ref={el => {
                            inputs.current[index] = el;
                        }}
                        value={item}
                        aria-label={`${label}, item ${index + 1}`}
                        placeholder={index === 0 ? placeholder : 'Add an item'}
                        onChange={e => setAt(index, e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                insertAfter(index);
                            }
                            if (
                                e.key === 'Backspace' &&
                                item === '' &&
                                items.length > 1
                            ) {
                                e.preventDefault();
                                removeAt(index);
                            }
                        }}
                        // No border and no background in ANY state, focus
                        // included. A box that appears on focus is still a box,
                        // and it made the row flip between "bullet" and "form
                        // field" as you tabbed. The caret is the focus
                        // indicator, which is what a text field gets to use.
                        className='min-w-0 flex-1 bg-transparent px-0 py-1 text-sm text-content outline-none placeholder:text-content-subtle'
                    />
                    <Button
                        type='button'
                        size='icon-sm'
                        variant='ghost'
                        aria-label='Remove item'
                        // Stays visible rather than appearing on hover: hover
                        // does not exist on touch, and a remove you cannot find
                        // is worse than a quiet one you can.
                        className='shrink-0 text-content-subtle hover:text-danger-fg'
                        disabled={items.length === 1 && item === ''}
                        onClick={() => removeAt(index)}>
                        <HugeiconsIcon icon={Cancel01Icon} className='size-3.5' />
                    </Button>
                </div>
            ))}
            {/* Same quiet primary text action as "Add another band". */}
            <Button
                type='button'
                size='sm'
                variant='ghost'
                className='-ml-2 text-primary'
                onClick={() => insertAfter(items.length - 1)}>
                <HugeiconsIcon icon={PlusSignIcon} className='size-3.5' />
                {addLabel}
            </Button>
        </div>
    );
}

/**
 * Rules for the fields the publish gate depends on.
 *
 * The asterisk beside Overview used to be decoration: nothing registered a
 * rule, so clearing it and pressing Save wrote `overview: null` to a LIVE tour
 * and reported "All changes saved". `validate` rather than `required` because
 * the value is a string that can be whitespace, and the empty-to-null step in
 * `buildTourCopyPayload` would turn "   " into a cleared field just the same.
 */
function rulesFor(name: string) {
    if (!TOUR_COPY_REQUIRED.has(name)) return undefined;
    return {
        validate: (value: string) =>
            (value ?? '').trim().length > 0 ||
            'Write an overview - travellers read it on the tour page, and the tour cannot go live without it.',
    };
}

/**
 * A soft target, not a limit. The overview has no `maxLength` - this says how
 * much has been written and roughly where a good one lands, then goes quiet.
 */
function CharCount({ value, target }: { value: string; target: number }) {
    const len = value.trim().length;
    if (len === 0) return null;
    return (
        <span className='text-xs tabular-nums text-content-muted'>
            {len < target ? `${len} / ~${target}` : `${len} characters`}
        </span>
    );
}

/**
 * The 12 English body fields: four collapsible groups, one form, one save.
 */
function TourCopySections({ tripId }: { tripId: string }) {
    const { data, isLoading } = useTripTranslationByLocale(tripId, 'en');
    const { mutateAsync: upsert, isPending } = useUpsertTripTranslation();
    // Failures render in place, above the step, instead of as a toast.
    const { setStepError } = useWizard();

    const defaults = useMemo(() => {
        const record = data as Record<string, unknown> | undefined;
        const d: Record<string, string> = {};
        for (const f of TOUR_COPY_FIELDS) {
            d[f.name] = toCopyFormValue(record?.[f.name]);
        }
        return d;
    }, [data]);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { isDirty, errors },
    } = useForm<Record<string, string>>({ defaultValues: defaults });

    // Guarded, not a bare `[defaults]` effect: this app refetches on window
    // focus (30s stale) and every sibling save invalidates this translation, so
    // an unconditional reset lands on top of whatever the operator is typing
    // AND clears isDirty, leaving the step reporting "clean" over unsaved work.
    useSyncFormWhenPristine(reset, isDirty, () => defaults, defaults);

    // One subscription for every field, so each group can report how much of
    // itself is filled in without a watch() per field.
    const values = watch();
    const overview = values.overview;

    const submit = useCallback(async () => {
        let ok = false;
        await handleSubmit(
            async values => {
                try {
                    await upsert({
                        tripId,
                        locale: 'en',
                        payload: buildTourCopyPayload(values),
                    } as never);
                    // Pristine at the values just persisted, so the
                    // guarded sync above can take over from here.
                    reset(values);
                    ok = true;
                } catch (err) {
                    setStepError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to save English content.',
                    );
                    ok = false;
                }
            },
            // The second branch was missing entirely, which is why an empty
            // Overview saved happily: with no rules registered there was
            // nothing to fail, and with no invalid handler a failure would have
            // been silent anyway - the footer would refuse to advance and never
            // say why.
            () => {
                focusFirstInvalid();
                ok = false;
            },
        )();
        return ok;
    }, [handleSubmit, upsert, tripId, setStepError, reset]);

    useStepCommit('content', { submit, isPending, isDirty });

    if (isLoading) {
        return (
            <div className='space-y-4'>
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className='h-20 w-full rounded-lg' />
                ))}
            </div>
        );
    }

    return (
        <>
            {TOUR_COPY_GROUPS.map((group, i) => (
                <WizardSection
                    key={group.id}
                    id={group.id}
                    title={group.title}
                    description={group.description}
                    defaultOpen={i === 0}
                    // A collapsed group holding the failed field would put the
                    // error out of sight, and `focusFirstInvalid` would find
                    // nothing focusable inside it.
                    invalid={group.fields.some(name => !!errors[name])}
                    // Overview keeps its own wording because it is the only
                    // group behind a publish gate - "Empty" is a fact, "Overview
                    // required" is the reason it matters.
                    summary={
                        group.id === 'overview' && !overview?.trim()
                            ? 'Overview required'
                            : filledSummary(
                                  group.fields.map(name => values[name]),
                              )
                    }>
                    <div className='space-y-6'>
                        {group.fields.map(name => {
                            const f = findCopyField(name);
                            if (!f) return null;
                            const required = TOUR_COPY_REQUIRED.has(f.name);
                            const hint = TOUR_COPY_HINTS[f.name];
                            return (
                                <Field key={f.name}>
                                    <div className='flex items-center justify-between gap-3'>
                                        <Label htmlFor={`en-${f.name}`}>
                                            {f.label}
                                            {required && (
                                                <span
                                                    aria-hidden
                                                    className='text-danger-fg'>
                                                    {' '}
                                                    *
                                                </span>
                                            )}
                                        </Label>
                                        {f.name === 'overview' && (
                                            <CharCount
                                                value={overview ?? ''}
                                                target={200}
                                            />
                                        )}
                                    </div>
                                    {isLinesField(f.name) ? (
                                        <LineListField
                                            id={`en-${f.name}`}
                                            label={f.label}
                                            value={watch(f.name) ?? ''}
                                            placeholder={f.placeholder}
                                            addLabel={`Add ${f.label.toLowerCase()}`}
                                            onChange={next =>
                                                setValue(f.name, next, {
                                                    shouldDirty: true,
                                                })
                                            }
                                        />
                                    ) : f.kind === 'input' ? (
                                        <Input
                                            id={`en-${f.name}`}
                                            maxLength={f.maxLength}
                                            placeholder={f.placeholder}
                                            aria-invalid={!!errors[f.name]}
                                            {...register(f.name, rulesFor(f.name))}
                                        />
                                    ) : (
                                        <Textarea
                                            id={`en-${f.name}`}
                                            rows={f.rows ?? 3}
                                            maxLength={f.maxLength}
                                            placeholder={f.placeholder}
                                            aria-invalid={!!errors[f.name]}
                                            {...register(f.name, rulesFor(f.name))}
                                        />
                                    )}
                                    <FieldError>
                                        {errors[f.name]?.message}
                                    </FieldError>
                                    {/* Wizard hints only - the schema's own
                                        descriptions are written for the
                                        Translation Console, and its "One item
                                        per line" is now simply untrue: the list
                                        editor owns that. Most fields get
                                        nothing, which is what makes the few
                                        that do get read. */}
                                    {hint && (
                                        <FieldDescription>
                                            {hint}
                                        </FieldDescription>
                                    )}
                                </Field>
                            );
                        })}
                    </div>
                </WizardSection>
            ))}
        </>
    );
}
