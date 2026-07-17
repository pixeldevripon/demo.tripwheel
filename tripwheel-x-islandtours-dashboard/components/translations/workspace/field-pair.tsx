'use client';

/**
 * One workspace row (04 §3.2 C): the English source, always visible and
 * read-only, beside the target-locale input. Kills the memorize-or-second-
 * window problem - the operator never translates from memory.
 */

import type { UseFormRegister } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { TranslatableFieldDef } from '@/lib/translatable-schema';

interface FieldPairProps {
    field: TranslatableFieldDef;
    /** EN source value (string; lines-kind already joined with \n). */
    source: string;
    register: UseFormRegister<Record<string, string>>;
    targetLabel: string;
    /** Hide the source column (EN workspace edits the source itself). */
    sourceHidden?: boolean;
}

export function FieldPair({
    field,
    source,
    register,
    targetLabel,
    sourceHidden = false,
}: FieldPairProps) {
    const isMultiline = field.kind !== 'input';

    return (
        <div className='border-b border-line-subtle py-4 last:border-0'>
            <Label className='mb-2'>{field.label}</Label>
            <div
                className={
                    sourceHidden
                        ? 'grid grid-cols-1'
                        : 'grid grid-cols-1 gap-3 lg:grid-cols-2'
                }>
                {!sourceHidden && (
                    <div className='min-w-0'>
                        <p className='mb-1 text-2xs font-semibold tracking-caps uppercase text-content-subtle'>
                            English (source)
                        </p>
                        <div className='min-h-10 rounded-md border border-line-subtle bg-surface-sunken px-3.5 py-2 text-sm whitespace-pre-wrap text-content-muted'>
                            {source || (
                                <span className='text-content-subtle italic'>
                                    No English content yet.
                                </span>
                            )}
                        </div>
                    </div>
                )}
                <div className='min-w-0'>
                    {!sourceHidden && (
                        <p className='mb-1 text-2xs font-semibold tracking-caps uppercase text-content-subtle'>
                            {targetLabel}
                        </p>
                    )}
                    {isMultiline ? (
                        <Textarea
                            rows={field.rows ?? 3}
                            maxLength={field.maxLength}
                            {...register(field.name)}
                        />
                    ) : (
                        <Input
                            maxLength={field.maxLength}
                            {...register(field.name)}
                        />
                    )}
                    {field.description && (
                        <p className='mt-1 text-xs text-content-muted'>
                            {field.description}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
