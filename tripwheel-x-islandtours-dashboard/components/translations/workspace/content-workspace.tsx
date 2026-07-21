'use client';

/**
 * The generic workspace for the four content entities (destination, category,
 * hub, collection) - ONE implementation where there used to be four forked
 * per-locale forms. The per-entity wrappers in entity-workspaces.tsx wire in
 * their own hooks and render this view.
 *
 * FULL per-locale coverage (user mandate 2026-07-17: "not a single field
 * should skip or lost"):
 * - CORE translation fields (name/overview/…, per entity registry)
 * - PAGE CONTENT (aboutText + SEO meta - a separate per-locale record)
 * - FAQs (question+answer per group)
 * - entity EXTRAS via `extraSections` (collection per-tour rationales; hub
 *   our-picks blurbs, comparison names & standout notes, content sections)
 *
 * Save-all orchestration: core upsert → page-content upsert → FAQ upserts +
 * extra-section batch saves, allSettled with per-surface failure naming.
 * EN is never deleted; clearing EN fields upserts nulls (backend rule).
 */

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { CollapsibleCard } from '@/components/common/collapsible-card';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkspaceSkeleton } from './workspace-skeleton';
import { useFaqGroups, useUpsertFaqTranslation } from '@/hooks/faq/use-faq-groups';
import { LOCALE_LABELS, type Locale } from '@/lib/constants/locales';
import {
    fieldFilled,
    PAGE_CONTENT_FIELDS,
    type TranslatableEntityType,
    type TranslatableFieldDef,
} from '@/lib/translatable-schema';
import type { FaqGroup } from '@/types/faq';
import { FieldPair } from './field-pair';
import { WorkspaceShell } from './workspace-shell';

/** One extra per-item translatable row (rationales, picks, sections, …). */
export interface ExtraSectionRow {
    itemId: string;
    fieldKey: string;
    label: string;
    /** EN base value. */
    source: string;
    /** Existing target-locale value. */
    existing: string;
    kind: 'input' | 'textarea';
}

export interface ExtraSection {
    key: string;
    label: string;
    rows: ExtraSectionRow[];
    /** Persist ALL changed rows of this section in one operation. */
    save: (
        changes: Array<{ itemId: string; fieldKey: string; value: string }>,
    ) => Promise<unknown>;
}

export interface ContentWorkspaceProps {
    type: TranslatableEntityType;
    id: string;
    locale: Locale;
    fields: TranslatableFieldDef[];
    /** FAQ endpoint base, e.g. '/destinations'. */
    faqBasePath: string;
    entityName: string | undefined;
    /** EN source record (field name → value). */
    source: Record<string, unknown> | undefined;
    /** Target-locale record. */
    target: Record<string, unknown> | undefined;
    /**
     * Page-content records (aboutText/metaTitle/metaDescription). Omit all
     * three page-content props for an entity that has no page-content record -
     * the homepage is content-only, with no About/SEO body of its own, and
     * rendering empty fields that save nowhere would be worse than absent.
     */
    pageSource?: Record<string, unknown> | undefined;
    pageTarget?: Record<string, unknown> | undefined;
    extraSections?: ExtraSection[];
    isLoading: boolean;
    isMachineTranslated?: boolean;
    isSaving: boolean;
    /** Upsert the core locale. Values trimmed; '' means clear (null). */
    onSave: (values: Record<string, string>) => Promise<unknown>;
    /** Upsert the page-content locale record. Omit when there is none. */
    onSavePageContent?: (values: Record<string, string>) => Promise<unknown>;
}

function toFormValue(v: unknown): string {
    if (Array.isArray(v)) return v.join('\n');
    return typeof v === 'string' ? v : '';
}

function faqKey(groupId: string, field: 'question' | 'answer') {
    return `faq__${groupId}__${field}`;
}

function pcKey(name: string) {
    return `pc__${name}`;
}

function xsKey(section: string, itemId: string, fieldKey: string) {
    return `xs__${section}__${itemId}__${fieldKey}`;
}

interface FaqRow {
    groupId: string;
    base: { question: string; answer: string };
    existing: { question: string; answer: string };
}

export function ContentWorkspace({
    type,
    id,
    locale,
    fields,
    faqBasePath,
    entityName,
    source,
    target,
    pageSource,
    pageTarget,
    extraSections = [],
    isLoading,
    isMachineTranslated,
    isSaving,
    onSave,
    onSavePageContent,
}: ContentWorkspaceProps) {
    const { data: faqGroups, isLoading: faqLoading } = useFaqGroups(
        faqBasePath,
        id,
    );
    const upsertFaq = useUpsertFaqTranslation(faqBasePath, id);

    const faqRows = useMemo<FaqRow[]>(() => {
        return ((faqGroups ?? []) as FaqGroup[]).map(g => {
            const en = g.translations.find(t => t.locale === 'en');
            const t = g.translations.find(r => r.locale === locale);
            return {
                groupId: g.faqGroupId,
                base: {
                    question: en?.question ?? '',
                    answer: en?.answer ?? '',
                },
                existing: {
                    question: t?.question ?? '',
                    answer: t?.answer ?? '',
                },
            };
        });
    }, [faqGroups, locale]);

    const defaults = useMemo(() => {
        const d: Record<string, string> = {};
        for (const f of fields) d[f.name] = toFormValue(target?.[f.name]);
        for (const f of PAGE_CONTENT_FIELDS)
            d[pcKey(f.name)] = toFormValue(pageTarget?.[f.name]);
        for (const row of faqRows) {
            d[faqKey(row.groupId, 'question')] = row.existing.question;
            d[faqKey(row.groupId, 'answer')] = row.existing.answer;
        }
        for (const sec of extraSections) {
            for (const row of sec.rows) {
                d[xsKey(sec.key, row.itemId, row.fieldKey)] =
                    locale === 'en' ? row.source : row.existing;
            }
        }
        return d;
        // extraSections identity churns per render; row data is what matters.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fields, target, pageTarget, faqRows, locale, JSON.stringify(extraSections.map(s => s.rows))]);

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

    function copyFromEnglish() {
        let copied = 0;
        const trySet = (key: string, src: string) => {
            if (getValues(key)?.trim()) return;
            if (!src) return;
            setValue(key, src, { shouldDirty: true });
            copied++;
        };
        for (const f of fields) trySet(f.name, toFormValue(source?.[f.name]));
        for (const f of PAGE_CONTENT_FIELDS)
            trySet(pcKey(f.name), toFormValue(pageSource?.[f.name]));
        for (const row of faqRows) {
            trySet(faqKey(row.groupId, 'question'), row.base.question);
            trySet(faqKey(row.groupId, 'answer'), row.base.answer);
        }
        for (const sec of extraSections)
            for (const row of sec.rows)
                trySet(xsKey(sec.key, row.itemId, row.fieldKey), row.source);
        toast.info(
            copied
                ? `${copied} field${copied === 1 ? '' : 's'} copied from English - review before saving.`
                : 'Nothing to copy - every empty field is empty in English too.',
        );
    }

    async function handleSave() {
        const v = getValues();
        const failures: string[] = [];
        let updates = 0;

        // 1) Core translation record.
        const core: Record<string, string> = {};
        for (const f of fields) core[f.name] = v[f.name] ?? '';
        try {
            await onSave(core);
            updates++;
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : 'Failed to save translation.',
            );
            return;
        }

        // 2) Page content record - skipped entirely for entities that have none.
        if (onSavePageContent) {
            const pc: Record<string, string> = {};
            for (const f of PAGE_CONTENT_FIELDS)
                pc[f.name] = v[pcKey(f.name)] ?? '';
            try {
                await onSavePageContent(pc);
                updates++;
            } catch {
                failures.push('Page content');
            }
        }

        // 3) FAQ upserts for changed groups (payload requires BOTH fields).
        const faqJobs: Array<{ label: string; run: () => Promise<unknown> }> = [];
        const skippedHalf: string[] = [];
        for (const row of faqRows) {
            const question = (v[faqKey(row.groupId, 'question')] ?? '').trim();
            const answer = (v[faqKey(row.groupId, 'answer')] ?? '').trim();
            const changed =
                question !== row.existing.question ||
                answer !== row.existing.answer;
            if (!changed) continue;
            if (!question || !answer) {
                if (question || answer)
                    skippedHalf.push(row.base.question.slice(0, 40));
                continue;
            }
            faqJobs.push({
                label: `FAQ "${row.base.question.slice(0, 40)}"`,
                run: () =>
                    upsertFaq.mutateAsync({
                        groupId: row.groupId,
                        locale,
                        payload: { question, answer },
                    }),
            });
        }

        // 4) Extra sections: batch changed rows per section.
        const sectionJobs: Array<{ label: string; run: () => Promise<unknown> }> =
            [];
        for (const sec of extraSections) {
            const changes = sec.rows
                .map(row => {
                    const value = (
                        v[xsKey(sec.key, row.itemId, row.fieldKey)] ?? ''
                    ).trim();
                    const baseline =
                        locale === 'en' ? row.source : row.existing;
                    return value !== baseline.trim()
                        ? { itemId: row.itemId, fieldKey: row.fieldKey, value }
                        : null;
                })
                .filter((c): c is NonNullable<typeof c> => c !== null);
            if (changes.length === 0) continue;
            sectionJobs.push({
                label: sec.label,
                run: () => sec.save(changes),
            });
        }

        const jobs = [...faqJobs, ...sectionJobs];
        const results = await Promise.allSettled(jobs.map(j => j.run()));
        results.forEach((r, i) => {
            if (r.status === 'rejected') failures.push(jobs[i].label);
            else updates++;
        });

        if (failures.length > 0) {
            toast.error(
                `Saved with ${failures.length} failure${failures.length === 1 ? '' : 's'}: ${failures.slice(0, 3).join(', ')}${failures.length > 3 ? '…' : ''}`,
            );
        } else {
            toast.success(
                `${LOCALE_LABELS[locale]} translation saved (${updates} update${updates === 1 ? '' : 's'}).`,
            );
        }
        if (skippedHalf.length > 0) {
            toast.warning(
                `${skippedHalf.length} FAQ${skippedHalf.length === 1 ? '' : 's'} skipped - both question and answer are required: ${skippedHalf.slice(0, 2).join(', ')}${skippedHalf.length > 2 ? '…' : ''}`,
            );
        }
    }

    if (isLoading || faqLoading) {
        return <WorkspaceSkeleton />;
    }

    const sourceHidden = locale === 'en';

    return (
        <WorkspaceShell
            type={type}
            id={id}
            locale={locale}
            entityName={entityName}
            filled={filled}
            total={allKeys.length}
            isMachineTranslated={isMachineTranslated}
            isSaving={isSaving || upsertFaq.isPending}
            isDirty={isDirty}
            onSave={handleSave}
            onCopyFromEnglish={copyFromEnglish}>
            <div className='space-y-6'>
                <CollapsibleCard title='Page copy' defaultOpen>
                    <div>
                        {fields.map(f => (
                            <FieldPair
                                key={f.name}
                                field={f}
                                source={toFormValue(source?.[f.name])}
                                register={register}
                                targetLabel={LOCALE_LABELS[locale]}
                                sourceHidden={sourceHidden}
                            />
                        ))}
                    </div>
                </CollapsibleCard>

                {onSavePageContent ? (
                <CollapsibleCard title='About & SEO (page content)' defaultOpen>
                    <div>
                        {PAGE_CONTENT_FIELDS.map(f => (
                            <FieldPair
                                key={pcKey(f.name)}
                                field={{ ...f, name: pcKey(f.name) }}
                                source={toFormValue(pageSource?.[f.name])}
                                register={register}
                                targetLabel={LOCALE_LABELS[locale]}
                                sourceHidden={sourceHidden}
                            />
                        ))}
                    </div>
                </CollapsibleCard>
                ) : null}

                {extraSections.map(sec =>
                    sec.rows.length === 0 ? null : (
                        <CollapsibleCard
                            key={sec.key}
                            title={
                                <>
                                    {sec.label}
                                    <span className='ml-2 text-xs font-normal text-content-muted'>
                                        {sec.rows.length} item
                                        {sec.rows.length === 1 ? '' : 's'}
                                    </span>
                                </>
                            }>
                            <div>
                                {sec.rows.map(row => (
                                    <FieldPair
                                        key={xsKey(sec.key, row.itemId, row.fieldKey)}
                                        field={{
                                            name: xsKey(sec.key, row.itemId, row.fieldKey),
                                            label: row.label,
                                            kind: row.kind,
                                            rows: 3,
                                        }}
                                        source={row.source}
                                        register={register}
                                        targetLabel={LOCALE_LABELS[locale]}
                                        sourceHidden={sourceHidden}
                                    />
                                ))}
                            </div>
                        </CollapsibleCard>
                    ),
                )}

                {faqRows.length > 0 && (
                    <CollapsibleCard
                        title={
                            <>
                                FAQs
                                <span className='ml-2 text-xs font-normal text-content-muted'>
                                    {faqRows.length} question
                                    {faqRows.length === 1 ? '' : 's'}
                                </span>
                            </>
                        }>
                        <div>
                            {faqRows.map((row, i) => (
                                <div
                                    key={row.groupId}
                                    className='border-b border-line py-2 last:border-0'>
                                    <p className='mt-2 text-2xs font-semibold tracking-caps uppercase text-content-subtle'>
                                        FAQ {i + 1}
                                    </p>
                                    <FieldPair
                                        field={{
                                            name: faqKey(row.groupId, 'question'),
                                            label: 'Question',
                                            kind: 'input',
                                        }}
                                        source={row.base.question}
                                        register={register}
                                        targetLabel={LOCALE_LABELS[locale]}
                                        sourceHidden={sourceHidden}
                                    />
                                    <FieldPair
                                        field={{
                                            name: faqKey(row.groupId, 'answer'),
                                            label: 'Answer',
                                            kind: 'textarea',
                                            rows: 3,
                                        }}
                                        source={row.base.answer}
                                        register={register}
                                        targetLabel={LOCALE_LABELS[locale]}
                                        sourceHidden={sourceHidden}
                                    />
                                </div>
                            ))}
                        </div>
                    </CollapsibleCard>
                )}
            </div>
        </WorkspaceShell>
    );
}
