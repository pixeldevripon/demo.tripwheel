'use client';

/**
 * Guide languages - the spoken languages a guide runs the tour in, NOT the
 * website's UI language.
 *
 * Extracted from the retired `trip-details-tab.tsx` (07 §11 task 8). It was
 * always an odd fit there: a child-collection manager with its own mutations
 * sitting inside a 40-field trip-core form. It now lives on the wizard's
 * content step, next to the other things a traveller reads.
 *
 * Logic is unchanged - same add/remove mutations, same duplicate guard, same
 * ISO 639-1 custom-code escape hatch. `bare` drops the Card chrome the
 * wizard's section header already provides.
 */

import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useAddLanguage,
    useLanguages,
    useRemoveLanguage,
} from '@/hooks/trips/use-trips';

const COMMON_LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'nl', label: 'Dutch' },
    { code: 'es', label: 'Spanish' },
    { code: 'pt', label: 'Portuguese' },
    { code: 'de', label: 'German' },
    { code: 'fr', label: 'French' },
];

export function LanguagesCard({
    tripId,
    bare = false,
}: {
    tripId: string;
    bare?: boolean;
}) {
    const { data: languages, isLoading } = useLanguages(tripId);
    const { mutate: addLanguage, isPending: isAdding } = useAddLanguage();
    const { mutate: removeLanguage } = useRemoveLanguage();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [selected, setSelected] = useState('');
    const [customCode, setCustomCode] = useState('');
    const [showCustom, setShowCustom] = useState(false);

    function handleAdd() {
        const code = (showCustom ? customCode : selected).toLowerCase().trim();
        if (!code) return;
        const existing = (languages ?? []).map(l => l.language.toLowerCase());
        if (existing.includes(code)) {
            toast.error('Already added.');
            return;
        }

        addLanguage(
            { tripId, payload: { language: code } },
            {
                onSuccess: () => {
                    setSelected('');
                    setCustomCode('');
                },
                onError: err =>
                    toast.error(
                        err instanceof Error ? err.message : 'Failed to add.'
                    ),
            }
        );
    }

    function handleDelete(languageId: string, code: string) {
        setDeletingId(languageId);
        removeLanguage(
            { tripId, languageId },
            {
                onSuccess: () => {
                    setDeletingId(null);
                },
                onError: err => {
                    toast.error(
                        err instanceof Error ? err.message : 'Failed to remove.'
                    );
                    setDeletingId(null);
                },
            }
        );
    }

    const body = (
        <div className='space-y-4'>
            <p className='text-xs text-content-muted'>
                Shown as a badge strip (for example EN &middot; NL &middot; ES)
                on the booking page, so travellers know before they book. Not
                required to publish, but it matters in the Caribbean where many
                travellers speak Dutch, Spanish or Papiamentu.
            </p>

            {isLoading ? (
                <Skeleton className='h-8 w-48 rounded-md' />
            ) : (languages?.length ?? 0) > 0 ? (
                <div className='flex flex-wrap gap-2'>
                    {languages!.map(lang => (
                        <Badge
                            key={lang.id}
                            variant='secondary'
                            className='gap-1.5 pr-1'>
                            <span>{lang.language}</span>
                            <button
                                type='button'
                                onClick={() =>
                                    handleDelete(lang.id, lang.language)
                                }
                                disabled={deletingId === lang.id}
                                className='rounded-sm p-0.5 transition-colors hover:bg-foreground/10'
                                aria-label={`Remove ${lang.language}`}>
                                <HugeiconsIcon
                                    icon={Cancel01Icon}
                                    className='size-3'
                                />
                            </button>
                        </Badge>
                    ))}
                </div>
            ) : (
                <p className='text-sm text-content-muted'>
                    No languages specified yet.
                </p>
            )}

            <div className='flex items-end gap-2 border-t border-line pt-4'>
                {showCustom ? (
                    <Field className='flex-1'>
                        <Label>ISO 639-1 code</Label>
                        <Input
                            value={customCode}
                            onChange={e => setCustomCode(e.target.value)}
                            placeholder='e.g. ja, ko, ru'
                            className='h-9'
                            onKeyDown={e =>
                                e.key === 'Enter' &&
                                (e.preventDefault(), handleAdd())
                            }
                        />
                    </Field>
                ) : (
                    <Field className='flex-1'>
                        <Label>Language</Label>
                        <Select value={selected} onValueChange={setSelected}>
                            <SelectTrigger className='h-9'>
                                <SelectValue placeholder='Select language...' />
                            </SelectTrigger>
                            <SelectContent>
                                {COMMON_LANGUAGES.map(l => (
                                    <SelectItem key={l.code} value={l.code}>
                                        {l.label} ({l.code.toUpperCase()})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                )}
                <Button
                    type='button'
                    size='sm'
                    onClick={handleAdd}
                    disabled={
                        isAdding ||
                        (!showCustom && !selected) ||
                        (showCustom && !customCode.trim())
                    }
                    className='h-9'>
                    Add
                </Button>
                <button
                    type='button'
                    onClick={() => {
                        setShowCustom(v => !v);
                        setSelected('');
                        setCustomCode('');
                    }}
                    className='pb-0.5 text-xs whitespace-nowrap text-content-muted underline underline-offset-2 hover:text-content'>
                    {showCustom ? 'Common' : 'Custom code'}
                </button>
            </div>
        </div>
    );

    if (bare) return body;

    return (
        <Card>
            <CardHeader className='border-b pb-4'>
                <CardTitle className='text-lg font-medium'>
                    Guide Languages
                </CardTitle>
            </CardHeader>
            <CardContent className='pt-6'>{body}</CardContent>
        </Card>
    );
}

