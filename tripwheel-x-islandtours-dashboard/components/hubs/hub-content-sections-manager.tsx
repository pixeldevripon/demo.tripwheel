'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, ArrowDown02Icon, ArrowUp02Icon, Delete02Icon, Layers01Icon, PlusSignIcon } from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { toast } from 'sonner';
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
import { CurationLoadError } from '@/components/common/curation-load-error';
import { ImageSelectorField } from '@/components/common/image-selector-field';
import { LocaleCompletenessChip, TranslationConsoleNote } from '@/components/common/locale-completeness';
import { Skeleton } from '@/components/ui/skeleton';
import { useHubContentSections, useReplaceHubContentSections } from '@/hooks/hubs/use-hubs';
import { ALL_LOCALES, DEFAULT_LOCALE, type Locale } from '@/lib/constants/locales';
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
  const { data, isLoading, isError, error, refetch } = useHubContentSections(hubId);
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
    // Replace-all backstop: never submit a payload built from unseeded state -
    // it would wipe every existing block in every locale.
    if (!seededFrom) {
      toast.error('Content sections have not loaded yet - reload before saving.');
      return;
    }
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
      const displayOrder = orderByType[block.sectionType] ?? 0;
      orderByType[block.sectionType] = displayOrder + 1;

      // Non-English rows are round-tripped from the read-back untouched - the
      // editor is English-only, the Translation Console owns them. Dropping
      // them here would DELETE them (replace-all).
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

  /** The English block editor + optional image - shared by regular and singleton
   *  blocks. Non-English rows are held in state untouched and round-tripped on
   *  save; the Translation Console owns them. */
  function renderBlockFields(
    block: ContentBlock,
    meta: (typeof SECTION_TYPE_META)[HubSectionType]
  ) {
    const en = block.translations[DEFAULT_LOCALE] ?? { heading: '', body: '' };
    return (
      <>
        {meta.hasHeading && (
          <Field>
            <Label>Heading (English)</Label>
            <Input
              value={en.heading}
              onChange={(e) =>
                updateLocaleField(block.key, DEFAULT_LOCALE, { heading: e.target.value })
              }
              placeholder="Heading"
            />
          </Field>
        )}

        <Field>
          <Label>{meta.hasHeading ? 'Body (English)' : 'Content (English)'}</Label>
          <Textarea
            value={en.body}
            onChange={(e) =>
              updateLocaleField(block.key, DEFAULT_LOCALE, { body: e.target.value })
            }
            rows={3}
            placeholder="Content"
          />
        </Field>

        {meta.hasImage && (
          <Field>
            <Label>Image (optional, shared across locales)</Label>
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

 if (isError) {
 return (
 <CurationLoadError
 label="the content sections"
 error={error}
 onRetry={() => void refetch()}
 />
 );
 }

 return (
 <div className="space-y-6">
      <div className="text-xs text-muted-foreground bg-muted px-3 py-2">
        Editorial blocks for the hub page, grouped by type. <strong>Discover</strong> and{' '}
        <strong>Local Tip</strong> (English) are required before the hub can be published. Blocks
        are ordered as listed. <TranslationConsoleNote type="hub" id={hubId} />
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
 <h3 className="text-sm font-semibold ">
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
 <h3 className="text-sm font-semibold ">
 {meta.label}
 <span className="ml-2 text-xs font-normal text-muted-foreground">
 {typeBlocks.length}
 </span>
 </h3>
 <p className="text-xs text-muted-foreground mt-0.5">{meta.hint}</p>
 </div>
 <Button size="sm" type="button" variant="outline" onClick={() => addBlock(type)}>
 <HugeiconsIcon icon={PlusSignIcon} />
 Add
 </Button>
 </div>

 {typeBlocks.length === 0 ? (
 <div className="flex items-center gap-2 border border-dashed px-3 py-4 text-xs text-muted-foreground">
 <HugeiconsIcon icon={Layers01Icon} className="size-4 opacity-40" />
 No {meta.label} blocks yet.
 </div>
 ) : (
 <div className="space-y-2">
 {typeBlocks.map((block, idx) => {
 const enHeading = block.translations[DEFAULT_LOCALE]?.heading?.trim();
 const title =
 enHeading || block.translations[DEFAULT_LOCALE]?.body?.trim() ||'Untitled block';
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
                          <HugeiconsIcon icon={ArrowDown01Icon}
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
                            <HugeiconsIcon icon={ArrowUp02Icon} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={idx === typeBlocks.length - 1}
                            onClick={() => moveBlock(block.key, 1)}
                            aria-label="Move down"
                          >
                            <HugeiconsIcon icon={ArrowDown02Icon} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeBlock(block.key)}
                            aria-label="Remove block"
                          >
                            <HugeiconsIcon icon={Delete02Icon} />
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

/** Translation completeness of one block (read-only - the Console owns translations). */
function LocaleStatus({ block }: { block: ContentBlock }) {
  const filled = ALL_LOCALES.filter((loc) => {
    const t = block.translations[loc];
    return !!t?.heading.trim() && !!t?.body.trim();
  }).length;
  return <LocaleCompletenessChip filled={filled} />;
}
