'use client';

/**
 * Workspace chrome shared by every entity type: breadcrumb, header with the
 * entity name + locale, a locale switcher (flags), the fields-filled counter,
 * and the sticky action footer (Copy from English → review → one Save).
 */

import { AiMagicIcon, Loading03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { Breadcrumb } from '@/components/breadcrumb';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/common/status-badge';
import {
    ALL_LOCALES,
    LOCALE_LABELS,
    LOCALE_NATIVE_LABELS,
    localeFlag,
    type Locale,
} from '@/lib/constants/locales';
import type { TranslatableEntityType } from '@/lib/translatable-schema';
import { ENTITY_TYPE_LABELS } from '@/lib/translatable-schema';

interface WorkspaceShellProps {
    type: TranslatableEntityType;
    id: string;
    locale: Locale;
    entityName: string | undefined;
    filled: number;
    total: number;
    isMachineTranslated?: boolean;
    isSaving: boolean;
    isDirty: boolean;
    onSave: () => void;
    onCopyFromEnglish: () => void;
    /** AI translation of the CURRENT locale; button hidden when absent or on en. */
    onTranslateWithAI?: () => void;
    isTranslating?: boolean;
    children: ReactNode;
}

export function WorkspaceShell({
    type,
    id,
    locale,
    entityName,
    filled,
    total,
    isMachineTranslated,
    isSaving,
    isDirty,
    onSave,
    onCopyFromEnglish,
    onTranslateWithAI,
    isTranslating,
    children,
}: WorkspaceShellProps) {
    const isEn = locale === 'en';
    // The whole-locale button FORCE-translates (founder 2026-07-27): after
    // confirmation it replaces every field for this locale, hand-written rows
    // included, and reloads the form (unsaved edits go with it). The dialog
    // is the consent step - always shown.
    const [confirmTranslate, setConfirmTranslate] = useState(false);

    return (
        // No bottom padding here: the action bar is the last in-flow child and
        // any padding after it renders as dead space UNDER the bar at the end
        // of the scroll (the "floating footer" bug).
        <div>
            <Breadcrumb
                items={[
                    { label: 'Dashboard', href: '/' },
                    { label: 'Translations', href: '/translations' },
                    { label: entityName ?? '…' },
                    { label: LOCALE_LABELS[locale] },
                ]}
            />

            <div className='mb-4 flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <h1 className='text-2xl font-semibold'>
                        {entityName ?? '…'}
                    </h1>
                    <p className='text-sm text-content-muted mt-1'>
                        {ENTITY_TYPE_LABELS[type].replace(/s$/, '')} ·{' '}
                        {LOCALE_LABELS[locale]} translation
                    </p>
                </div>
                <div className='flex items-center gap-2'>
                    <span className='rounded-full bg-surface-inset px-2.5 py-1 text-xs font-medium tabular-nums text-content-muted'>
                        {filled} / {total} fields
                    </span>
                    {isMachineTranslated && (
                        <StatusBadge variant='info'>
                            Machine translated
                        </StatusBadge>
                    )}
                </div>
            </div>

            {/* Locale switcher - jump between languages without the matrix -
                with the AI trigger for the current locale on the right. */}
            <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
                <div className='flex flex-wrap gap-1.5'>
                    {ALL_LOCALES.map(l => (
                        <Link
                            key={l}
                            href={`/translations/${type}/${id}/${l}`}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors duration-fast ${
                                l === locale
                                    ? 'border-transparent bg-primary-subtle font-semibold text-primary-subtle-content'
                                    : 'border-line bg-surface-raised text-content-muted hover:text-content'
                            }`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={localeFlag(l)}
                                alt=''
                                aria-hidden
                                className='size-3.5 rounded-full'
                            />
                            {LOCALE_LABELS[l]}
                            <span className='text-content-subtle'>
                                {LOCALE_NATIVE_LABELS[l]}
                            </span>
                        </Link>
                    ))}
                </div>
                {onTranslateWithAI && !isEn && (
                    <>
                        <Button
                            variant='outline'
                            size='sm'
                            type='button'
                            onClick={() => setConfirmTranslate(true)}
                            disabled={isTranslating || isSaving}
                            title={`Re-translate every ${LOCALE_LABELS[locale]} field from the English source.`}>
                            <HugeiconsIcon
                                icon={
                                    isTranslating ? Loading03Icon : AiMagicIcon
                                }
                                className={`size-4 ${isTranslating ? 'animate-spin' : ''}`}
                            />
                            {isTranslating ? 'Translating…' : 'Translate with AI'}
                        </Button>
                        <ConfirmDialog
                            open={confirmTranslate}
                            onOpenChange={setConfirmTranslate}
                            title={`Translate everything into ${LOCALE_LABELS[locale]}?`}
                            description={
                                isDirty
                                    ? 'Every field for this language is re-translated from the English source - existing translations, INCLUDING hand-written ones, are replaced. Your unsaved edits on this form will also be replaced.'
                                    : 'Every field for this language is re-translated from the English source - existing translations, INCLUDING hand-written ones, are replaced.'
                            }
                            confirmLabel='Translate everything'
                            onConfirm={() => {
                                setConfirmTranslate(false);
                                onTranslateWithAI();
                            }}
                        />
                    </>
                )}
            </div>

            {isEn && (
                <div className='mb-4 rounded-md border border-info-border bg-info-subtle px-4 py-3'>
                    <p className='text-sm text-info-fg'>
                        English is the base locale. What you edit here is the
                        SOURCE every other language translates from.
                    </p>
                </div>
            )}

            {children}

            {/* Sticky action footer: ONE save for the whole locale.
                In-flow `sticky`, NOT `fixed`: fixed spanned the viewport (ran
                under the sidebar, centered on the screen instead of the pane)
                and broke outright during the page-enter animation - the
                transformed motion.div becomes the containing block for fixed
                descendants. Negative margins bleed it to the pane edges
                horizontally AND through the layout's lg padding at the bottom,
                so the bar rests near the pane edge instead of floating above a
                strip of empty background. The inner row uses the same padding
                scale as the pane, so the text/buttons line up with the card
                edges instead of a centered max-width column. */}
            <div className='sticky bottom-0 z-20 mt-8 -mx-4 lg:-mx-8 lg:-mb-8 border-t border-line bg-surface-raised/95 backdrop-blur-sm'>
                <div className='flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8'>
                    <p className='text-xs text-content-muted'>
                        {isDirty
                            ? 'Unsaved changes.'
                            : 'All changes saved.'}
                    </p>
                    <div className='flex flex-wrap items-center gap-2'>
                        {!isEn && (
                            <Button
                                variant='outline'
                                size='sm'
                                type='button'
                                onClick={onCopyFromEnglish}
                                disabled={isSaving}>
                                Copy from English (empty fields)
                            </Button>
                        )}
                        <Button
                            size='sm'
                            type='button'
                            onClick={onSave}
                            disabled={isSaving || !isDirty}>
                            {isSaving ? 'Saving…' : 'Save all'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
