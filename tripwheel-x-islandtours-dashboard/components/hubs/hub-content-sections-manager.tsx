'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronDownIcon,
  LayersIcon,
  PlusIcon,
  Trash2Icon,
  ArrowUpIcon,
  ArrowDownIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/ui/field';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageSelectorField } from '@/components/media/image-selector-field';
import { Skeleton } from '@/components/ui/skeleton';
import { useHubContentSections, useReplaceHubContentSections } from '@/hooks/hubs/use-hubs';
import { ALL_LOCALES, DEFAULT_LOCALE, LOCALE_LABELS, type Locale } from '@/lib/constants/locales';
import { HUB_SECTION_TYPE_VALUES, type HubSectionType } from '@/types/enums';
import type { HubContentSection } from '@/types/hub';

/** Per-type editorial guidance + which fields each type needs. */
const SECTION_TYPE_META: Record<
  HubSectionType,
  {
    label: string;
    hint: string;
    hasHeading: boolean;
    hasImage: boolean;
    /** Exactly one block, always expanded, no add/remove/collapse. */
    singleton?: boolean;
  }
> = {
  DISCOVER: {
    label: 'Discover',
    hint: 'Cards in the "Discover" grid - heading, body and an optional image. English required to publish.',
    hasHeading: true,
    hasImage: true,
  },
  LOCAL_TIP: {
    label: 'Local Tip',
    hint: 'Titled first-timer tips (orange-ruled body) under "What we tell first-timers". English required to publish.',
    hasHeading: true,
    hasImage: false,
  },
  FAST_FACT: {
    label: 'Fast Fact',
    hint: 'Quick facts that feed the hero bar at the top of the hub page.',
    hasHeading: true,
    hasImage: false,
  },
  EDITORIAL: {
    label: 'Discover Intro',
    hint: 'The subtitle shown under the "Discover" heading (body only).',
    hasHeading: false,
    hasImage: false,
    singleton: true,
  },
  HIGHLIGHT: {
    label: 'First-timer Highlight',
    hint: 'Green-check takeaways in the "What we tell first-timers" section (body only).',
    hasHeading: false,
    hasImage: false,
  },
};

/** Types managed in this tab. Fast Fact is intentionally excluded. */
const MANAGED_TYPES: HubSectionType[] = HUB_SECTION_TYPE_VALUES.filter((t) => t !== 'FAST_FACT');

/** Per-locale editable fields for one content block. */
type LocaleFields = { heading: string; body: string };

/** A logical content block - one entry per (sectionType, displayOrder), with a
 *  heading/body per locale and a locale-neutral image. */
interface ContentBlock {
  /** Stable client-side key for list rendering. */
  key: string;
  sectionType: HubSectionType;
  /** Shared across locales (not translated). */
  image: string | null;
  translations: Partial<Record<Locale, LocaleFields>>;
}

let blockCounter = 0;
function nextKey() {
  blockCounter += 1;
  return `cb-${blockCounter}`;
}

/** Group flat per-locale rows into logical blocks keyed by (sectionType, displayOrder). */
function rowsToBlocks(rows: HubContentSection[]): ContentBlock[] {
  const map = new Map<string, ContentBlock>();
  const order: string[] = [];
  // Stable: type order first, then displayOrder, then locale.
  const sorted = [...rows].sort((a, b) => {
    const t = HUB_SECTION_TYPE_VALUES.indexOf(a.sectionType) - HUB_SECTION_TYPE_VALUES.indexOf(b.sectionType);
    if (t !== 0) return t;
    return a.displayOrder - b.displayOrder;
  });
  for (const r of sorted) {
    if (!MANAGED_TYPES.includes(r.sectionType)) continue;
    const id = `${r.sectionType}#${r.displayOrder}`;
    let block = map.get(id);
    if (!block) {
      block = { key: nextKey(), sectionType: r.sectionType, image: r.image, translations: {} };
      map.set(id, block);
      order.push(id);
    }
    // Image is shared - keep the first non-null we encounter.
    if (!block.image && r.image) block.image = r.image;
    block.translations[r.locale] = { heading: r.heading, body: r.body };
  }
  return order.map((id) => map.get(id)!);
}

/** Guarantee each singleton type has exactly one block (create if missing, trim extras). */
function normalizeBlocks(list: ContentBlock[]): ContentBlock[] {
  let result = list;
  for (const type of MANAGED_TYPES) {
    if (!SECTION_TYPE_META[type].singleton) continue;
    const ofType = result.filter((b) => b.sectionType === type);
    if (ofType.length === 0) {
      result = [...result, emptyBlock(type)];
    } else if (ofType.length > 1) {
      const keep = ofType[0];
      result = result.filter((b) => b.sectionType !== type || b === keep);
    }
  }
  return result;
}

function emptyBlock(sectionType: HubSectionType): ContentBlock {
  return {
    key: nextKey(),
    sectionType,
    image: null,
    translations: { [DEFAULT_LOCALE]: { heading: '', body: '' } },
  };
}

interface HubContentSectionsManagerProps {
  hubId: string;
}

export function HubContentSectionsManager({ hubId }: HubContentSectionsManagerProps) {
  const { data, isLoading } = useHubContentSections(hubId);
  const { mutate: replace, isPending } = useReplaceHubContentSections();

  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  // Per-block open/collapsed state (kept out of the data model).
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  // Seed local edit state from the loaded set (guarded reference check - React's
  // sanctioned alternative to a setState-in-effect).
  const [seededFrom, setSeededFrom] = useState<typeof data>(undefined);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    setBlocks(normalizeBlocks(rowsToBlocks(data)));
  }

  function toggleOpen(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function updateLocaleField(key: string, locale: Locale, patch: Partial<LocaleFields>) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.key === key
          ? {
              ...b,
              translations: {
                ...b.translations,
                [locale]: {
                  heading: b.translations[locale]?.heading ?? '',
                  body: b.translations[locale]?.body ?? '',
                  ...patch,
                },
              },
            }
          : b
      )
    );
  }

  function updateImage(key: string, image: string | null) {
    setBlocks((prev) => prev.map((b) => (b.key === key ? { ...b, image } : b)));
  }

  function clearLocale(key: string, locale: Locale) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.key !== key) return b;
        const next = { ...b.translations };
        delete next[locale];
        return { ...b, translations: next };
      })
    );
  }

  function addBlock(sectionType: HubSectionType) {
    const block = emptyBlock(sectionType);
    setBlocks((prev) => [...prev, block]);
    setOpenKeys((prev) => new Set(prev).add(block.key));
  }

  function removeBlock(key: string) {
    setBlocks((prev) => prev.filter((b) => b.key !== key));
  }

  /** Swap a block with its same-type neighbour (order drives displayOrder on save). */
  function moveBlock(key: string, dir: -1 | 1) {
    setBlocks((prev) => {
      const block = prev.find((b) => b.key === key);
      if (!block) return prev;
      const sameType = prev.filter((b) => b.sectionType === block.sectionType);
      const idx = sameType.findIndex((b) => b.key === key);
      const swapWith = sameType[idx + dir];
      if (!swapWith) return prev;
      // Swap the two blocks' positions in the flat array.
      const next = [...prev];
      const a = next.indexOf(block);
      const c = next.indexOf(swapWith);
      [next[a], next[c]] = [next[c], next[a]];
      return next;
    });
  }

  function handleSave() {
    const sections: HubContentSection[] = [];
    const orderByType: Partial<Record<HubSectionType, number>> = {};

    for (const block of blocks) {
      const meta = SECTION_TYPE_META[block.sectionType];
      const en = block.translations[DEFAULT_LOCALE];
      // English (base) must be complete: body always, heading only when the type uses it.
      if (!en?.body.trim() || (meta.hasHeading && !en?.heading.trim())) {
        toast.error(
          meta.hasHeading
            ? `Every ${meta.label} block needs an English heading and body.`
            : `Every ${meta.label} block needs English content.`
        );
        return;
      }
      // A non-English locale must be complete or empty (no half-filled headings).
      if (meta.hasHeading) {
        for (const locale of ALL_LOCALES) {
          if (locale === DEFAULT_LOCALE) continue;
          const t = block.translations[locale];
          if (!t) continue;
          if (!!t.heading.trim() !== !!t.body.trim()) {
            toast.error(
              `${LOCALE_LABELS[locale]} translation of a ${meta.label} block is incomplete - fill both heading and body, or clear it.`
            );
            return;
          }
        }
      }

      const displayOrder = orderByType[block.sectionType] ?? 0;
      orderByType[block.sectionType] = displayOrder + 1;

      for (const locale of ALL_LOCALES) {
        const t = block.translations[locale];
        const body = t?.body.trim();
        if (!body) continue;
        if (meta.hasHeading && !t?.heading.trim()) continue;
        sections.push({
          locale,
          sectionType: block.sectionType,
          // Types without a heading field reuse the body so the (unused-but-required)
          // backend heading stays non-empty.
          heading: meta.hasHeading ? t!.heading.trim() : body,
          body,
          // Send null (not '') when empty - the backend's @IsUrl rejects '',
          // while @IsOptional short-circuits on null. Image only applies to Discover.
          image: meta.hasImage ? block.image || null : null,
          displayOrder,
        });
      }
    }

    replace(
      { id: hubId, payload: { sections } },
      {
        onSuccess: (res) => toast.success(`Saved ${res.count} content section(s).`),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to save content sections.'),
      }
    );
  }

  /** The per-locale tabbed editor + optional image - shared by regular and singleton blocks. */
  function renderBlockFields(
    block: ContentBlock,
    meta: (typeof SECTION_TYPE_META)[HubSectionType]
  ) {
    return (
      <>
        {/* Per-locale translations - same tabbed UI as the Translations / Page Content tabs. */}
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
            const fields = block.translations[loc] ?? { heading: '', body: '' };
            const isBase = loc === DEFAULT_LOCALE;
            return (
              <TabsContent key={loc} value={loc} className="space-y-4">
                {isBase ? (
                  <div className="text-xs text-muted-foreground bg-muted px-3 py-2">
                    English is the base locale and is required to publish.
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground bg-muted px-3 py-2">
                    Translation for {LOCALE_LABELS[loc]}.{' '}
                    {meta.hasHeading
                      ? 'Fill both fields, or leave both empty to skip this locale.'
                      : 'Leave empty to skip this locale.'}
                  </div>
                )}

                {meta.hasHeading && (
                  <Field>
                    <Label className="text-xs font-semibold uppercase">Heading</Label>
                    <Input
                      value={fields.heading}
                      onChange={(e) =>
                        updateLocaleField(block.key, loc, { heading: e.target.value })
                      }
                      placeholder={`Heading in ${LOCALE_LABELS[loc]}`}
                    />
                  </Field>
                )}

                <Field>
                  <Label className="text-xs font-semibold uppercase">
                    {meta.hasHeading ? 'Body' : 'Content'}
                  </Label>
                  <Textarea
                    value={fields.body}
                    onChange={(e) => updateLocaleField(block.key, loc, { body: e.target.value })}
                    rows={3}
                    placeholder={`Content in ${LOCALE_LABELS[loc]}`}
                  />
                </Field>

                {!isBase && (fields.heading || fields.body) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => clearLocale(block.key, loc)}
                  >
                    <Trash2Icon />
                    Clear {LOCALE_LABELS[loc]} translation
                  </Button>
                )}
              </TabsContent>
            );
          })}
        </Tabs>

        {meta.hasImage && (
          <Field>
            <Label className="text-xs font-semibold uppercase">
              Image (optional, shared across locales)
            </Label>
            <ImageSelectorField
              value={block.image || null}
              onChange={(url) => updateImage(block.key, url ?? null)}
            />
          </Field>
        )}
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-none" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-xs text-muted-foreground bg-muted px-3 py-2">
        Editorial blocks for the hub page, grouped by type. <strong>Discover</strong> and{' '}
        <strong>Local Tip</strong> (English) are required before the hub can be published. Each block
        carries its own translations - switch locale inside the block. Saving replaces the full set
        across all locales.
      </div>

      {MANAGED_TYPES.map((type) => {
        const meta = SECTION_TYPE_META[type];
        const typeBlocks = blocks.filter((b) => b.sectionType === type);

        // Singleton (Discover Intro): exactly one block, always open, no add/remove/collapse.
        if (meta.singleton) {
          const block = typeBlocks[0];
          return (
            <section key={type} className="space-y-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  {meta.label}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{meta.hint}</p>
              </div>
              {block && (
                <div className="space-y-4 border bg-card px-3 py-4">
                  {renderBlockFields(block, meta)}
                </div>
              )}
            </section>
          );
        }

        return (
          <section key={type} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  {meta.label}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {typeBlocks.length}
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{meta.hint}</p>
              </div>
              <Button size="sm" type="button" variant="outline" onClick={() => addBlock(type)}>
                <PlusIcon />
                Add
              </Button>
            </div>

            {typeBlocks.length === 0 ? (
              <div className="flex items-center gap-2 border border-dashed px-3 py-4 text-xs text-muted-foreground">
                <LayersIcon className="size-4 opacity-40" />
                No {meta.label} blocks yet.
              </div>
            ) : (
              <div className="space-y-2">
                {typeBlocks.map((block, idx) => {
                  const enHeading = block.translations[DEFAULT_LOCALE]?.heading?.trim();
                  const title =
                    enHeading || block.translations[DEFAULT_LOCALE]?.body?.trim() || 'Untitled block';
                  const isOpen = openKeys.has(block.key);
                  return (
                    <Collapsible
                      key={block.key}
                      open={isOpen}
                      onOpenChange={() => toggleOpen(block.key)}
                      className="border bg-card"
                    >
                      <div className="flex items-center gap-2 px-3 py-2">
                        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
                          <ChevronDownIcon
                            className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                              isOpen ? 'rotate-0' : '-rotate-90'
                            }`}
                          />
                          <span className="truncate text-sm font-medium">{title}</span>
                        </CollapsibleTrigger>
                        <LocaleStatus block={block} />
                        <div className="flex shrink-0 items-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={idx === 0}
                            onClick={() => moveBlock(block.key, -1)}
                            aria-label="Move up"
                          >
                            <ArrowUpIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={idx === typeBlocks.length - 1}
                            onClick={() => moveBlock(block.key, 1)}
                            aria-label="Move down"
                          >
                            <ArrowDownIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeBlock(block.key)}
                            aria-label="Remove block"
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </div>

                      <CollapsibleContent className="space-y-4 border-t px-3 py-4">
                        {renderBlockFields(block, meta)}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      <div className="flex justify-end pt-2">
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Content Sections'}
        </Button>
      </div>
    </div>
  );
}

/** Compact "3 / 7 locales" translation-completeness badge for a collapsed block. */
function LocaleStatus({ block }: { block: ContentBlock }) {
  const filled = ALL_LOCALES.filter((loc) => {
    const t = block.translations[loc];
    return !!t?.heading.trim() && !!t?.body.trim();
  }).length;
  return (
    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
      {filled}/{ALL_LOCALES.length} locales
    </span>
  );
}
