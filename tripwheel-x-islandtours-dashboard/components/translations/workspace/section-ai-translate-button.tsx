'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiMagicIcon, Loading03Icon } from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { contentTranslationApi } from '@/lib/api/content-translation';
import type { Locale } from '@/lib/constants/locales';

export interface SectionAiField {
    /** RHF field name to fill. */
    name: string;
    /** English source text ('' rows are skipped). */
    source: string;
}

/** Backend cap is 30k chars / 100 keys per request - stay under both. */
const MAX_CHARS_PER_REQUEST = 25_000;
const MAX_KEYS_PER_REQUEST = 100;
/** A SINGLE field longer than the backend's hard 30k cap cannot be batched
 *  around (it is one form field - there is nothing to split). The conditions
 *  document is the first field that can legally reach 50k. */
const MAX_SINGLE_FIELD_CHARS = 30_000;

/** Split fields into request-sized batches (a single batch in practice). */
function toBatches(fields: SectionAiField[]): SectionAiField[][] {
    const batches: SectionAiField[][] = [];
    let current: SectionAiField[] = [];
    let chars = 0;
    for (const field of fields) {
        if (
            current.length > 0 &&
            (chars + field.source.length > MAX_CHARS_PER_REQUEST ||
                current.length >= MAX_KEYS_PER_REQUEST)
        ) {
            batches.push(current);
            current = [];
            chars = 0;
        }
        current.push(field);
        chars += field.source.length;
    }
    if (current.length > 0) batches.push(current);
    return batches;
}

/**
 * Per-card "Translate section" button (rendered in a CollapsibleCard's
 * actions slot, which already stops click propagation). Sits between the
 * per-field AI icon and the header's whole-locale "Translate with AI":
 * it AI-fills ONLY this card's fields, overwriting their current form
 * values - nothing persists until Save all, same contract as the icon.
 *
 * The whole card rides in ONE `translate-fields` request and one provider
 * call (one system prompt instead of N, one round trip instead of N) -
 * the sequential per-field loop this replaced took 1-3s per field and
 * died mid-card on rate limits. Oversized cards fall back to a couple of
 * sequential batches; a failed batch aborts instead of hammering a
 * rate-limited provider.
 */
export function SectionAiTranslateButton({
    fields,
    locale,
    onFill,
}: {
    fields: SectionAiField[];
    locale: Locale;
    onFill: (name: string, text: string) => void;
}) {
    const [busy, setBusy] = useState(false);
    // State updates are async - the ref makes the double-run guard synchronous
    // (two activations in the same tick would both read busy === false).
    const runningRef = useRef(false);

    const translatable = fields.filter(f => f.source.trim());
    if (locale === 'en' || translatable.length === 0) return null;

    async function run() {
        if (runningRef.current) return;
        // An unsplittable oversized field would ride alone in one batch and
        // be REJECTED by the backend with a "split the request" message the
        // user cannot act on - refuse up front with an actionable one.
        if (
            translatable.some(f => f.source.length > MAX_SINGLE_FIELD_CHARS)
        ) {
            toast.error(
                'One field is longer than the 30,000-character translation limit - translate it manually.'
            );
            return;
        }
        runningRef.current = true;
        setBusy(true);
        const batches = toBatches(translatable);
        let filled = 0;
        try {
            for (const batch of batches) {
                // Index-keyed payload: stable, token-cheap, and immune to any
                // odd characters in the RHF field names.
                const payload: Record<string, string> = {};
                batch.forEach((f, i) => {
                    payload[`f${i}`] = f.source;
                });
                const res = await contentTranslationApi.translateFields(
                    payload,
                    locale,
                );
                batch.forEach((f, i) => {
                    const translated = res.fields[`f${i}`];
                    if (
                        typeof translated === 'string' &&
                        translated.trim()
                    ) {
                        onFill(f.name, translated);
                        filled += 1;
                    }
                });
            }
            toast.success(
                `${filled} field${filled === 1 ? '' : 's'} translated - review before saving.`,
            );
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : 'AI translation failed.',
            );
            if (filled > 0) {
                toast.info(
                    `${filled}/${translatable.length} fields were translated before the failure - they are kept for review.`,
                );
            }
        } finally {
            runningRef.current = false;
            setBusy(false);
        }
    }

    return (
        <Button
            type='button'
            size='sm'
            variant='outline'
            onClick={() => void run()}
            disabled={busy}>
            {busy ? (
                <>
                    <HugeiconsIcon
                        icon={Loading03Icon}
                        className='animate-spin'
                    />
                    Translating…
                </>
            ) : (
                <>
                    <HugeiconsIcon icon={AiMagicIcon} />
                    Translate section
                </>
            )}
        </Button>
    );
}
