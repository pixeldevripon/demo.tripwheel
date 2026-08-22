'use client';

/**
 * The in-field AI translate icon for per-locale inputs OUTSIDE the Translation
 * Console (hub Curation / Page Content tabs, collection rationales) - the same
 * affordance as the console FieldPair button: translates the English source
 * into the tab's locale and fills the input (dirty, review-then-save). Nothing
 * is persisted until the surrounding editor saves.
 *
 * A leaf component on purpose: each locale tab mounts its own instance, so the
 * loading state and the `useInlineTranslate(locale)` hook stay per-tab without
 * violating hook rules in the managers' render loops. The parent supplies the
 * `relative` container and `pr-8` on the input.
 */

import { AiMagicIcon, Loading03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useInlineTranslate } from '@/hooks/translations/use-inline-translate';
import { LOCALE_LABELS, type Locale } from '@/lib/constants/locales';

interface AiFieldIconButtonProps {
    onClick: () => void;
    isTranslating: boolean;
    /** Field name for the accessible label, e.g. "Rationale". */
    label: string;
    /** Human name of the target language for the tooltip. */
    targetLabel: string;
    /** Textarea (top-right) vs single-line input (vertically centered). */
    multiline?: boolean;
}

/**
 * Presentational-only chrome of the in-field AI icon, shared with the
 * console's FieldPair so the affordance looks identical everywhere. Owns no
 * state - callers keep their own click handling and loading flag.
 */
export function AiFieldIconButton({
    onClick,
    isTranslating,
    label,
    targetLabel,
    multiline = false,
}: AiFieldIconButtonProps) {
    return (
        <Button
            variant='ghost'
            size='icon-sm'
            type='button'
            className={`absolute right-1 size-6 text-content-muted hover:text-content ${
                multiline ? 'top-1' : 'top-1/2 -translate-y-1/2'
            }`}
            aria-label={`Translate "${label}" with AI`}
            title={`Translate this field into ${targetLabel} with AI - fills the input for review, replacing what is typed there.`}
            disabled={isTranslating}
            onClick={onClick}>
            <HugeiconsIcon
                icon={isTranslating ? Loading03Icon : AiMagicIcon}
                className={`size-3.5 ${isTranslating ? 'animate-spin' : ''}`}
            />
        </Button>
    );
}

interface AiTranslateFieldButtonProps {
    /** English source text to translate. Render nothing when it is empty. */
    sourceText: string;
    /** Target locale (the tab this field belongs to). */
    locale: Locale;
    /** Receives the translation - fill the field, do not persist. */
    onTranslated: (text: string) => void;
    /** Field name for the accessible label, e.g. "Rationale". */
    label: string;
    /** Textarea (top-right) vs single-line input (vertically centered). */
    multiline?: boolean;
}

export function AiTranslateFieldButton({
    sourceText,
    locale,
    onTranslated,
    label,
    multiline = false,
}: AiTranslateFieldButtonProps) {
    const translate = useInlineTranslate(locale);
    const [isTranslating, setIsTranslating] = useState(false);

    if (!sourceText.trim()) return null;

    async function handleClick() {
        if (isTranslating) return;
        setIsTranslating(true);
        try {
            const translated = await translate(sourceText);
            if (translated !== null) onTranslated(translated);
        } finally {
            setIsTranslating(false);
        }
    }

    return (
        <AiFieldIconButton
            onClick={() => void handleClick()}
            isTranslating={isTranslating}
            label={label}
            targetLabel={LOCALE_LABELS[locale]}
            multiline={multiline}
        />
    );
}
