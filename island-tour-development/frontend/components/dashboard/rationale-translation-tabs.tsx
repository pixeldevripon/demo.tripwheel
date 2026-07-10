'use client';

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/ui/field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ALL_LOCALES, DEFAULT_LOCALE, LOCALE_LABELS, type Locale } from '@/lib/constants/locales';

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

interface RationaleTranslationTabsProps {
  /** Per-locale text (locale code -> value). Missing locales render empty. */
  values: Record<string, string>;
  onChange: (locale: Locale, value: string) => void;
  /** Field label, e.g. "Rationale" or "Description". */
  label: string;
  /** Optional word cap - shows a per-locale counter and turns red when exceeded. */
  maxWords?: number;
  rows?: number;
  placeholder?: (locale: Locale) => string;
}

/**
 * Per-locale editorial text editor using the standard dashboard tabbed translation
 * UI (English base + one tab per locale) - the same pattern as the Translations /
 * Page Content / Content Sections tabs. Shared by the Collection tours and hub Our
 * Picks managers so rationale translation looks identical everywhere. Owns no data:
 * the parent holds `values` and applies edits via `onChange`.
 */
export function RationaleTranslationTabs({
  values,
  onChange,
  label,
  maxWords,
  rows = 2,
  placeholder,
}: RationaleTranslationTabsProps) {
  return (
    <Tabs defaultValue={DEFAULT_LOCALE}>
      <div className="pb-2 mb-4">
        <TabsList>
          {ALL_LOCALES.map((loc) => (
            <TabsTrigger key={loc} value={loc} className="px-2.5 sm:px-4">
              <span className="sm:hidden uppercase">{loc}</span>
              <span className="hidden sm:inline">{LOCALE_LABELS[loc]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {ALL_LOCALES.map((loc) => {
        const value = values[loc] ?? '';
        const isBase = loc === DEFAULT_LOCALE;
        const words = wordCount(value);
        const over = maxWords != null && words > maxWords;
        return (
          <TabsContent key={loc} value={loc} className="space-y-2">
            <div className="text-xs text-muted-foreground bg-muted px-3 py-2">
              {isBase
                ? 'English is the base and is required to publish.'
                : `Translation for ${LOCALE_LABELS[loc]}. Blank falls back to English on the page.`}
            </div>
            <Field>
              <Label className="text-xs font-semibold uppercase">
                {label}
                {!isBase && (
                  <span className="ml-1 normal-case text-muted-foreground">
                    ({LOCALE_LABELS[loc]})
                  </span>
                )}
              </Label>
              <Textarea
                value={value}
                onChange={(e) => onChange(loc, e.target.value)}
                rows={rows}
                placeholder={
                  placeholder
                    ? placeholder(loc)
                    : isBase
                      ? `${label} in English`
                      : `${label} in ${LOCALE_LABELS[loc]} (optional)`
                }
              />
              {maxWords != null && (
                <span className={`text-xs ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {words}/{maxWords} words
                </span>
              )}
            </Field>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
