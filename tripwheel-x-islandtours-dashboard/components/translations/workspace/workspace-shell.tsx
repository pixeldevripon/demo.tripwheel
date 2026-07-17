'use client';

/**
 * Workspace chrome shared by every entity type: breadcrumb, header with the
 * entity name + locale, a locale switcher (flags), the fields-filled counter,
 * and the sticky action footer (Copy from English → review → one Save).
 */

import Link from 'next/link';
import type { ReactNode } from 'react';

import { Breadcrumb } from '@/components/breadcrumb';
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
    children,
}: WorkspaceShellProps) {
    const isEn = locale === 'en';

    return (
        <div className='pb-24'>
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

            {/* Locale switcher - jump between languages without the matrix. */}
            <div className='mb-6 flex flex-wrap gap-1.5'>
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

            {isEn && (
                <div className='mb-4 rounded-md border border-info-border bg-info-subtle px-4 py-3'>
                    <p className='text-sm text-info-fg'>
                        English is the base locale. What you edit here is the
                        SOURCE every other language translates from.
                    </p>
                </div>
            )}

            {children}

            {/* Sticky action footer: ONE save for the whole locale. */}
            <div className='fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface-raised/95 backdrop-blur-sm'>
                <div className='mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-3'>
                    <p className='text-xs text-content-muted'>
                        {isDirty
                            ? 'Unsaved changes.'
                            : 'All changes saved.'}
                    </p>
                    <div className='flex items-center gap-2'>
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
