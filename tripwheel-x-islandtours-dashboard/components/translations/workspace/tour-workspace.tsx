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
import { WorkspaceSkeleton } from './workspace-skeleton';
import {
    useExclusions,
    useDeleteExclusionTranslation,
    useDeleteFeatureTranslation,
    useDeleteHighlightTranslation,
    useDeleteInclusionTranslation,
    useDeleteLocationTranslation,
    useDeletePickupLocationTranslation,
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
import { useGenerateTranslation } from '@/hooks/translations/use-generate-translation';
import { useInlineTranslate } from '@/hooks/translations/use-inline-translate';
import { LOCALE_LABELS, type Locale } from '@/lib/constants/locales';
import {
    fieldFilled,
    TOUR_FIELDS,
    TOUR_SUB_ENTITIES,
} from '@/lib/translatable-schema';
import { FieldPair } from './field-pair';
import { SectionAiTranslateButton } from './section-ai-translate-button';
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
    const generate = useGenerateTranslation('tour', id, locale);
    const translateField = useInlineTranslate(locale);

    /** Per-field AI fill: translate the EN source, drop it into the input. */
    function aiFillFor(name: string, src: string) {
        if (locale === 'en' || !src.trim()) return undefined;
        return async () => {
            const translated = await translateField(src);
            if (translated) setValue(name, translated, { shouldDirty: true });
        };
    }

    /** The per-card "Translate section" fill target (form-fill, no persist). */
    function fillField(name: string, text: string) {
        setValue(name, text, { shouldDirty: true });
    }
    const upsertHighlight = useUpsertHighlightTranslation();
    const upsertInclusion = useUpsertInclusionTranslation();
    const upsertExclusion = useUpsertExclusionTranslation();
    const upsertFeature = useUpsertFeatureTranslation();
    const upsertLocation = useUpsertLocationTranslation();
    const upsertPickup = useUpsertPickupLocationTranslation();
    const deleteHighlight = useDeleteHighlightTranslation();
    const deleteInclusion = useDeleteInclusionTranslation();
    const deleteExclusion = useDeleteExclusionTranslation();
    const deleteFeature = useDeleteFeatureTranslation();
    const deleteLocation = useDeleteLocationTranslation();
    const deletePickup = useDeletePickupLocationTranslation();

    /**
     * Per sub-entity: how to write one locale's row and how to remove it.
     * Keyed by TOUR_SUB_ENTITIES[].key so the save loop stays generic - the
     * only thing that differs between the six is the id param name.
     */
    type SubOps = {
        upsert: (
            itemId: string,
            payload: Record<string, string | undefined>,
        ) => Promise<unknown>;
        remove: (itemId: string) => Promise<unknown>;
        /** Human label prefix used in the per-item failure toast. */
        noun: string;
    };
    const subOps: Record<string, SubOps> = {
        highlights: {
            upsert: (highlightId, payload) =>
                upsertHighlight.mutateAsync({
                    tripId: id, highlightId, locale, payload,
                } as never),
            remove: highlightId =>
                deleteHighlight.mutateAsync({ tripId: id, highlightId, locale }),
            noun: 'Highlight',
        },
        inclusions: {
            upsert: (inclusionId, payload) =>
                upsertInclusion.mutateAsync({
                    tripId: id, inclusionId, locale, payload,
                } as never),
            remove: inclusionId =>
                deleteInclusion.mutateAsync({ tripId: id, inclusionId, locale }),
            noun: 'Inclusion',
        },
        exclusions: {
            upsert: (exclusionId, payload) =>
                upsertExclusion.mutateAsync({
                    tripId: id, exclusionId, locale, payload,
                } as never),
            remove: exclusionId =>
                deleteExclusion.mutateAsync({ tripId: id, exclusionId, locale }),
            noun: 'Exclusion',
        },
        features: {
            upsert: (featureId, payload) =>
                upsertFeature.mutateAsync({
                    tripId: id, featureId, locale, payload,
                } as never),
            remove: featureId =>
                deleteFeature.mutateAsync({ tripId: id, featureId, locale }),
            noun: 'Info item',
        },
        locations: {
            upsert: (locationId, payload) =>
                upsertLocation.mutateAsync({
                    tripId: id, locationId, locale, payload,
                } as never),
            remove: locationId =>
                deleteLocation.mutateAsync({ tripId: id, locationId, locale }),
            noun: 'Stop',
        },
        pickups: {
            upsert: (pickupLocationId, payload) =>
                upsertPickup.mutateAsync({
                    tripId: id, pickupLocationId, locale, payload,
                } as never),
            remove: pickupLocationId =>
                deletePickup.mutateAsync({ tripId: id, pickupLocationId, locale }),
            noun: 'Pickup',
        },
    };

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
                const enT = translations.find(r => r.locale === 'en');
                const base: Record<string, string> = {};
                const existing: Record<string, string> = {};
                for (const f of sub.fields) {
                    // The EN source lives on the child's `en` TRANSLATION row
                    // (child base rows carry no text); fall back to any
                    // same-named base-row field, then to the pickup's `name`
                    // for its title - so a pickup created moments ago already
                    // shows its English source here.
                    base[f.name] = toFormValue(
                        enT?.[f.name] ??
                            item[f.name] ??
                            (f.name === 'title' ? item.name : undefined),
                    );
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
        // Sub-entities render on EVERY locale, EN included (founder 2026-07-27:
        // one console, everything visible) - on the EN tab their values ARE
        // the source, editable here exactly like in the editor tabs.
        for (const sub of TOUR_SUB_ENTITIES) {
            for (const item of subData[sub.key] ?? []) {
                for (const f of sub.fields) {
                    d[itemKey(sub.key, item.id, f.name)] =
                        item.existing[f.name];
                }
            }
        }
        return d;
    }, [target, subData]);

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
        //    Explicit isMachineTranslated: false - a human save must clear the
        //    machine flag, or the AI refresher would later overwrite this row.
        const payload: Record<string, unknown> = { isMachineTranslated: false };
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

        // 2) Sub-entities: one pass over every sub-entity type.
        //    EVERY field clears independently. An emptied field is sent as ''
        //    and the row is KEPT, so the public page falls back to English for
        //    that field alone - clearing an itinerary stop's short description
        //    must not take its title down with it (which is exactly what
        //    delete-the-row used to do).
        //    EN is the SOURCE every other locale derives from, so a blank
        //    there is refused before it leaves the browser.
        const jobs: Array<{ label: string; run: () => Promise<unknown> }> = [];
        const refusedEnClear: string[] = [];

        for (const sub of TOUR_SUB_ENTITIES) {
            const ops = subOps[sub.key];
            if (!ops) continue;
            const [required] = sub.fields;
            for (const item of subData[sub.key] ?? []) {
                const valueOf = (field: string) =>
                    (v[itemKey(sub.key, item.id, field)] ?? '').trim();
                const changed = sub.fields.some(
                    f => valueOf(f.name) !== (item.existing[f.name] ?? '').trim(),
                );
                if (!changed) continue;

                const label = `${ops.noun} "${(item.base[required.name] ?? '').slice(0, 30)}"`;

                if (locale === 'en' && !valueOf(required.name)) {
                    refusedEnClear.push(label);
                    continue;
                }

                const payload: Record<string, string> = {};
                for (const f of sub.fields) payload[f.name] = valueOf(f.name);
                jobs.push({ label, run: () => ops.upsert(item.id, payload) });
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
        if (refusedEnClear.length > 0) {
            toast.warning(
                `${refusedEnClear.length} English item${refusedEnClear.length === 1 ? '' : 's'} left unchanged - English is the source every translation falls back to. Delete the item in the tour editor instead.`,
            );
        }
    }

    if (isLoading) {
        return <WorkspaceSkeleton />;
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
            onCopyFromEnglish={copyFromEnglish}
            onTranslateWithAI={() => generate.mutate({ force: true })}
            isTranslating={generate.isPending}>
            <div className='space-y-6'>
                <CollapsibleCard
                    title='Tour copy & SEO'
                    defaultOpen
                    actions={
                        <SectionAiTranslateButton
                            locale={locale}
                            fields={TOUR_FIELDS.map(f => ({
                                name: f.name,
                                source: toFormValue(
                                    source?.[f.name as keyof typeof source],
                                ),
                            }))}
                            onFill={fillField}
                        />
                    }>
                    <div>
                        {TOUR_FIELDS.map(f => {
                            const src = toFormValue(
                                source?.[f.name as keyof typeof source],
                            );
                            return (
                                <FieldPair
                                    key={f.name}
                                    field={f}
                                    source={src}
                                    register={register}
                                    targetLabel={LOCALE_LABELS[locale]}
                                    sourceHidden={locale === 'en'}
                                    onAiTranslate={aiFillFor(f.name, src)}
                                />
                            );
                        })}
                    </div>
                </CollapsibleCard>

                {TOUR_SUB_ENTITIES.map(sub => {
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
                                }
                                actions={
                                    <SectionAiTranslateButton
                                        locale={locale}
                                        fields={items.flatMap(item =>
                                            sub.fields.map(f => ({
                                                name: itemKey(
                                                    sub.key,
                                                    item.id,
                                                    f.name,
                                                ),
                                                source: item.base[f.name],
                                            })),
                                        )}
                                        onFill={fillField}
                                    />
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
                                                sourceHidden={locale === 'en'}
                                                onAiTranslate={aiFillFor(
                                                    itemKey(sub.key, item.id, f.name),
                                                    item.base[f.name],
                                                )}
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
