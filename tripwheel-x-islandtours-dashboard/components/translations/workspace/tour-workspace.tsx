'use client';

/**
 * Tour workspace (04 §3.2 C): EVERY translatable surface of one tour, in one
 * locale, on one screen - the 15 core/SEO fields plus every highlight,
 * inclusion, exclusion, info item, itinerary stop and pickup, each beside its
 * English source. ONE "Save all" replaces the ~120 scattered saves.
 *
 * Save fan-out (existing API only): 1 flat trip-translation upsert + one
 * per-item upsert for each CHANGED item field, run with allSettled so a
 * partial failure is reported per item, never silently.
 */

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { CollapsibleCard } from '@/components/common/collapsible-card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useExclusions,
    useFeatures,
    useHighlights,
    useInclusions,
    useLocations,
    usePickupLocations,
    useTrip,
    useTripTranslationByLocale,
    useUpsertExclusionTranslation,
    useUpsertFeatureTranslation,
    useUpsertHighlightTranslation,
    useUpsertInclusionTranslation,
    useUpsertLocationTranslation,
    useUpsertPickupLocationTranslation,
    useUpsertTripTranslation,
} from '@/hooks/trips/use-trips';
import { LOCALE_LABELS, type Locale } from '@/lib/constants/locales';
import {
    fieldFilled,
    TOUR_FIELDS,
    TOUR_SUB_ENTITIES,
} from '@/lib/translatable-schema';
import { FieldPair } from './field-pair';
import { WorkspaceShell } from './workspace-shell';

const LINES_FIELDS = new Set(
    TOUR_FIELDS.filter(f => f.kind === 'lines').map(f => f.name),
);

function toFormValue(v: unknown): string {
    if (Array.isArray(v)) return v.join('\n');
    return typeof v === 'string' ? v : '';
}

interface SubItem {
    id: string;
    /** EN base values per field name. */
    base: Record<string, string>;
    /** Existing target-locale translation values per field name. */
    existing: Record<string, string>;
}

function itemKey(sub: string, id: string, field: string) {
    return `sub__${sub}__${id}__${field}`;
}

export function TourWorkspace({ id, locale }: { id: string; locale: Locale }) {
    const { data: trip, isLoading: tripLoading } = useTrip(id);
    const { data: source, isLoading: sourceLoading } =
        useTripTranslationByLocale(id, 'en');
    const { data: target, isLoading: targetLoading } =
        useTripTranslationByLocale(id, locale);

    const highlights = useHighlights(id);
    const inclusions = useInclusions(id);
    const exclusions = useExclusions(id);
    const features = useFeatures(id);
    const locations = useLocations(id);
    const pickups = usePickupLocations(id);

    const upsertCore = useUpsertTripTranslation();
    const upsertHighlight = useUpsertHighlightTranslation();
    const upsertInclusion = useUpsertInclusionTranslation();
    const upsertExclusion = useUpsertExclusionTranslation();
    const upsertFeature = useUpsertFeatureTranslation();
    const upsertLocation = useUpsertLocationTranslation();
    const upsertPickup = useUpsertPickupLocationTranslation();

    const subData = useMemo(() => {
        const listFor = {
            highlights: highlights.data,
            inclusions: inclusions.data,
            exclusions: exclusions.data,
            features: features.data,
            locations: locations.data,
            pickups: pickups.data,
        } as Record<string, Array<Record<string, unknown>> | undefined>;

        const out: Record<string, SubItem[]> = {};
        for (const sub of TOUR_SUB_ENTITIES) {
            const items = listFor[sub.key] ?? [];
            out[sub.key] = items.map(item => {
                const translations = (item.translations ?? []) as Array<
                    Record<string, unknown> & { locale: string }
                >;
                const t = translations.find(r => r.locale === locale);
                const base: Record<string, string> = {};
                const existing: Record<string, string> = {};
                for (const f of sub.fields) {
                    base[f.name] = toFormValue(item[f.name]);
                    existing[f.name] = toFormValue(t?.[f.name]);
                }
                return { id: String(item.id), base, existing };
            });
        }
        return out;
    }, [
        highlights.data,
        inclusions.data,
        exclusions.data,
        features.data,
        locations.data,
        pickups.data,
        locale,
    ]);

    const defaults = useMemo(() => {
        const d: Record<string, string> = {};
        for (const f of TOUR_FIELDS) d[f.name] = toFormValue(target?.[f.name as keyof typeof target]);
        // Sub-entity items only exist as translation targets; their EN base
        // text is edited in the editor tabs, so the EN workspace neither
        // renders nor counts them.
        if (locale !== 'en') {
            for (const sub of TOUR_SUB_ENTITIES) {
                for (const item of subData[sub.key] ?? []) {
                    for (const f of sub.fields) {
                        d[itemKey(sub.key, item.id, f.name)] =
                            item.existing[f.name];
                    }
                }
            }
        }
        return d;
    }, [target, subData, locale]);

    const {
        register,
        reset,
        watch,
        setValue,
        getValues,
        formState: { isDirty },
    } = useForm<Record<string, string>>({ defaultValues: defaults });

    useEffect(() => {
        reset(defaults);
    }, [defaults, reset]);

    const values = watch();
    const allKeys = Object.keys(defaults);
    const filled = allKeys.filter(k => fieldFilled(values[k])).length;

    const isLoading =
        tripLoading || sourceLoading || (locale !== 'en' && targetLoading);
    const isSaving =
        upsertCore.isPending ||
        upsertHighlight.isPending ||
        upsertInclusion.isPending ||
        upsertExclusion.isPending ||
        upsertFeature.isPending ||
        upsertLocation.isPending ||
        upsertPickup.isPending;

    function copyFromEnglish() {
        let copied = 0;
        for (const f of TOUR_FIELDS) {
            if (getValues(f.name)?.trim()) continue;
            const src = toFormValue(source?.[f.name as keyof typeof source]);
            if (!src) continue;
            setValue(f.name, src, { shouldDirty: true });
            copied++;
        }
        for (const sub of TOUR_SUB_ENTITIES) {
            for (const item of subData[sub.key] ?? []) {
                for (const f of sub.fields) {
                    const key = itemKey(sub.key, item.id, f.name);
                    if (getValues(key)?.trim()) continue;
                    if (!item.base[f.name]) continue;
                    setValue(key, item.base[f.name], { shouldDirty: true });
                    copied++;
                }
            }
        }
        toast.info(
            copied
                ? `${copied} field${copied === 1 ? '' : 's'} copied from English - review before saving.`
                : 'Nothing to copy.',
        );
    }

    async function handleSave() {
        const v = getValues();

        // 1) Core: one flat upsert; '' clears (backend merges field-by-field,
        //    and the form shows every field, so what you see is what you get).
        const payload: Record<string, unknown> = {};
        for (const f of TOUR_FIELDS) {
            const raw = (v[f.name] ?? '').trim();
            if (LINES_FIELDS.has(f.name)) {
                payload[f.name] = raw
                    ? raw.split('\n').map(l => l.trim()).filter(Boolean)
                    : [];
            } else {
                payload[f.name] = raw || null;
            }
        }

        // 2) Sub-entities: per-item upserts ONLY for changed, non-empty values
        //    (the required-string payloads can't clear; use the editor tabs to
        //    delete an item translation outright).
        const jobs: Array<{ label: string; run: () => Promise<unknown> }> = [];

        if (locale !== 'en') {
            for (const item of subData.highlights ?? []) {
                const text = (v[itemKey('highlights', item.id, 'text')] ?? '').trim();
                if (text && text !== item.existing.text)
                    jobs.push({
                        label: `Highlight "${item.base.text.slice(0, 30)}"`,
                        run: () =>
                            upsertHighlight.mutateAsync({
                                tripId: id, highlightId: item.id, locale, payload: { text },
                            } as never),
                    });
            }
            for (const item of subData.inclusions ?? []) {
                const label = (v[itemKey('inclusions', item.id, 'label')] ?? '').trim();
                if (label && label !== item.existing.label)
                    jobs.push({
                        label: `Inclusion "${item.base.label.slice(0, 30)}"`,
                        run: () =>
                            upsertInclusion.mutateAsync({
                                tripId: id, inclusionId: item.id, locale, payload: { label },
                            } as never),
                    });
            }
            for (const item of subData.exclusions ?? []) {
                const label = (v[itemKey('exclusions', item.id, 'label')] ?? '').trim();
                if (label && label !== item.existing.label)
                    jobs.push({
                        label: `Exclusion "${item.base.label.slice(0, 30)}"`,
                        run: () =>
                            upsertExclusion.mutateAsync({
                                tripId: id, exclusionId: item.id, locale, payload: { label },
                            } as never),
                    });
            }
            for (const item of subData.features ?? []) {
                const text = (v[itemKey('features', item.id, 'text')] ?? '').trim();
                if (text && text !== item.existing.text)
                    jobs.push({
                        label: `Info item "${item.base.text.slice(0, 30)}"`,
                        run: () =>
                            upsertFeature.mutateAsync({
                                tripId: id, featureId: item.id, locale, payload: { text },
                            } as never),
                    });
            }
            for (const item of subData.locations ?? []) {
                const title = (v[itemKey('locations', item.id, 'title')] ?? '').trim();
                const shortDescription = (v[itemKey('locations', item.id, 'shortDescription')] ?? '').trim();
                const changed =
                    (title && title !== item.existing.title) ||
                    (shortDescription && shortDescription !== item.existing.shortDescription);
                if (title && changed)
                    jobs.push({
                        label: `Stop "${item.base.title.slice(0, 30)}"`,
                        run: () =>
                            upsertLocation.mutateAsync({
                                tripId: id, locationId: item.id, locale,
                                payload: { title, shortDescription: shortDescription || undefined },
                            } as never),
                    });
            }
            for (const item of subData.pickups ?? []) {
                const title = (v[itemKey('pickups', item.id, 'title')] ?? '').trim();
                const directions = (v[itemKey('pickups', item.id, 'directions')] ?? '').trim();
                const changed =
                    (title && title !== item.existing.title) ||
                    (directions && directions !== item.existing.directions);
                if (title && changed)
                    jobs.push({
                        label: `Pickup "${item.base.title.slice(0, 30)}"`,
                        run: () =>
                            upsertPickup.mutateAsync({
                                tripId: id, pickupLocationId: item.id, locale,
                                payload: { title, directions: directions || undefined },
                            } as never),
                    });
            }
        }

        try {
            await upsertCore.mutateAsync({ tripId: id, locale, payload } as never);
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : 'Failed to save translation.',
            );
            return;
        }

        if (jobs.length === 0) {
            toast.success(`${LOCALE_LABELS[locale]} translation saved.`);
            return;
        }

        const results = await Promise.allSettled(jobs.map(j => j.run()));
        const failed = results
            .map((r, i) => (r.status === 'rejected' ? jobs[i].label : null))
            .filter(Boolean);

        if (failed.length === 0) {
            toast.success(
                `${LOCALE_LABELS[locale]} translation saved (${jobs.length + 1} updates).`,
            );
        } else {
            toast.error(
                `Saved with ${failed.length} failure${failed.length === 1 ? '' : 's'}: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}`,
            );
        }
    }

    if (isLoading) {
        return (
            <div className='space-y-4'>
                <Skeleton className='h-8 w-64' />
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className='h-20 w-full' />
                ))}
            </div>
        );
    }

    return (
        <WorkspaceShell
            type='tour'
            id={id}
            locale={locale}
            entityName={trip?.name}
            filled={filled}
            total={allKeys.length}
            isMachineTranslated={target?.isMachineTranslated}
            isSaving={isSaving}
            isDirty={isDirty}
            onSave={handleSave}
            onCopyFromEnglish={copyFromEnglish}>
            <div className='space-y-6'>
                <CollapsibleCard title='Tour copy & SEO' defaultOpen>
                    <div>
                        {TOUR_FIELDS.map(f => (
                            <FieldPair
                                key={f.name}
                                field={f}
                                source={toFormValue(source?.[f.name as keyof typeof source])}
                                register={register}
                                targetLabel={LOCALE_LABELS[locale]}
                                sourceHidden={locale === 'en'}
                            />
                        ))}
                    </div>
                </CollapsibleCard>

                {locale !== 'en' &&
                    TOUR_SUB_ENTITIES.map(sub => {
                        const items = subData[sub.key] ?? [];
                        if (items.length === 0) return null;
                        return (
                            <CollapsibleCard
                                key={sub.key}
                                title={
                                    <>
                                        {sub.label}
                                        <span className='ml-2 text-xs font-normal text-content-muted'>
                                            {items.length} item
                                            {items.length === 1 ? '' : 's'}
                                        </span>
                                    </>
                                }>
                                <div>
                                    {items.map(item =>
                                        sub.fields.map(f => (
                                            <FieldPair
                                                key={itemKey(sub.key, item.id, f.name)}
                                                field={{
                                                    name: itemKey(sub.key, item.id, f.name),
                                                    label: sub.fields.length > 1
                                                        ? `${item.base[sub.fields[0].name] || sub.label} - ${f.label}`
                                                        : item.base[f.name] || sub.label,
                                                    kind: 'input',
                                                }}
                                                source={item.base[f.name]}
                                                register={register}
                                                targetLabel={LOCALE_LABELS[locale]}
                                            />
                                        )),
                                    )}
                                </div>
                            </CollapsibleCard>
                        );
                    })}
            </div>
        </WorkspaceShell>
    );
}
