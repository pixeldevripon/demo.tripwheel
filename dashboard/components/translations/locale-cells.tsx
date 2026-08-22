'use client';

/**
 * The 7 locale cells of one matrix row. Cell = completeness of the entity's
 * CORE fields for that locale: full check, partial dot with fraction, or
 * quiet empty circle. Click-through to the workspace for that entity+locale.
 */

import Link from 'next/link';

import { Skeleton } from '@/components/ui/skeleton';
import { ALL_LOCALES, LOCALE_LABELS, type Locale } from '@/lib/constants/locales';
import {
    completenessFor,
    type TranslatableEntityType,
    type TranslatableFieldDef,
} from '@/lib/translatable-schema';

interface LocaleCellsProps {
    type: TranslatableEntityType;
    id: string;
    fields: TranslatableFieldDef[];
    /** All-locale translation records ({ locale } + field values). */
    records: Array<Record<string, unknown> & { locale: string }> | undefined;
    isLoading: boolean;
}

export function LocaleCells({
    type,
    id,
    fields,
    records,
    isLoading,
}: LocaleCellsProps) {
    if (isLoading) {
        return (
            <>
                {ALL_LOCALES.map(locale => (
                    <td key={locale} className='px-2 py-3 text-center'>
                        <Skeleton className='mx-auto size-5 rounded-full' />
                    </td>
                ))}
            </>
        );
    }

    return (
        <>
            {ALL_LOCALES.map(locale => {
                const record = records?.find(r => r.locale === locale);
                const c = completenessFor(fields, record, locale as Locale);
                const state =
                    c.filled === 0
                        ? 'missing'
                        : c.filled === c.total
                          ? 'full'
                          : 'partial';

                return (
                    <td key={locale} className='px-2 py-3 text-center'>
                        <Link
                            href={`/translations/${type}/${id}/${locale}`}
                            title={`${LOCALE_LABELS[locale]}: ${c.filled}/${c.total} fields`}
                            className='group inline-flex min-w-9 items-center justify-center gap-1 rounded-md px-1.5 py-1 transition-colors duration-fast hover:bg-surface-inset'>
                            {state === 'full' && (
                                <span className='inline-flex size-4 items-center justify-center rounded-full bg-success-solid text-content-inverse text-2xs leading-none'>
                                    ✓
                                </span>
                            )}
                            {state === 'partial' && (
                                <>
                                    <span className='size-2.5 rounded-full bg-warning-solid' />
                                    <span className='text-2xs tabular-nums text-content-muted'>
                                        {c.filled}/{c.total}
                                    </span>
                                </>
                            )}
                            {state === 'missing' && (
                                <span className='inline-flex items-center gap-0.5 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-2xs font-medium text-content-subtle transition-colors duration-fast group-hover:border-primary group-hover:bg-primary-subtle group-hover:text-primary-subtle-content'>
                                    <span aria-hidden className='text-xs leading-none'>
                                        +
                                    </span>
                                    Add
                                </span>
                            )}
                        </Link>
                    </td>
                );
            })}
        </>
    );
}
