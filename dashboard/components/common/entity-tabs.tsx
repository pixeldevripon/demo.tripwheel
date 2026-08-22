'use client';

/**
 * EntityTabs (Phase 19) - THE tab system for entity edit pages, carrying the
 * tours-editor friction fixes to every module:
 *
 * - `?tab=` stays in the URL: deep links, refresh and share keep the exact tab.
 * - Visited panels stay MOUNTED (hidden, not unmounted): switching tabs is
 *   instant and never silently discards unsaved form edits.
 * - `aliases` map legacy tab values (e.g. the removed `translations` tab) to
 *   their new home so old bookmarks and row-action links keep working.
 *
 * Four entity editors used to hand-roll this scaffold with drifting behavior
 * (some URL-synced, some useState, all unmount-on-switch).
 *
 * ## Why the URL is written with history.replaceState, not router.replace
 *
 * `router.replace` is a real App Router navigation. Every `[id]/edit` page is
 * dynamic (its `page.tsx` awaits `searchParams`), so a tab click round-tripped
 * to the server for an RSC payload and dropped the page into `(app)/loading.tsx`
 * on the way - a blank flash and a network wait for a switch that changes
 * nothing the server renders, since `activeTab` is resolved on the client and
 * every visited panel is already mounted.
 *
 * Worse, the remount threw away those panels, so the "never discards unsaved
 * form edits" guarantee above was false: switching tabs and coming back lost
 * whatever had been typed.
 *
 * `window.history.replaceState` is what the Next docs prescribe for exactly
 * this ("Shallow routing on the client", app/guides/single-page-applications):
 * it updates the URL, stays in sync with `useSearchParams`, and does not
 * navigate. Local state drives the panel so the switch is instant and cannot
 * depend on the router re-rendering at all.
 */

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface EntityTab {
    value: string;
    label: string;
    content: ReactNode;
}

interface EntityTabsProps {
    /** Base path written back to the URL, e.g. `/destinations/abc/edit`. */
    basePath: string;
    tabs: EntityTab[];
    initialTab?: string;
    /** Legacy tab value → current tab value. */
    aliases?: Record<string, string>;
}

export function EntityTabs({
    basePath,
    tabs,
    initialTab,
    aliases = {},
}: EntityTabsProps) {
    const searchParams = useSearchParams();

    const rawTab = searchParams.get('tab') ?? initialTab ?? tabs[0]?.value;
    const normalized = (rawTab && aliases[rawTab]) || rawTab;
    const urlTab = tabs.some(t => t.value === normalized)
        ? (normalized as string)
        : (tabs[0]?.value ?? '');

    // Local state, not the URL, drives which panel shows. The URL is kept in
    // sync for deep links, but a click must never wait on the router.
    const [activeTab, setActiveTab] = useState(urlTab);

    // Follow the URL when it changes from OUTSIDE this component - back/forward,
    // or a row-action link into a specific tab. Our own switchTab has already
    // set the state before touching the URL, so this is a no-op for it and
    // cannot loop.
    useEffect(() => {
        setActiveTab(prev => (prev === urlTab ? prev : urlTab));
    }, [urlTab]);

    const [visited, setVisited] = useState<Set<string>>(
        () => new Set([activeTab]),
    );
    useEffect(() => {
        setVisited(prev =>
            prev.has(activeTab) ? prev : new Set(prev).add(activeTab),
        );
    }, [activeTab]);

    function switchTab(tab: string) {
        setActiveTab(tab);
        // Preserve any other query params rather than rebuilding the string
        // from `basePath` alone, which used to drop them.
        const params = new URLSearchParams(window.location.search);
        params.set('tab', tab);
        window.history.replaceState(null, '', `${basePath}?${params}`);
    }

    return (
        <>
            <Tabs value={activeTab} onValueChange={switchTab}>
                <div className='mb-6 pb-2'>
                    <TabsList>
                        {tabs.map(t => (
                            <TabsTrigger key={t.value} value={t.value}>
                                {t.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>
            </Tabs>

            {tabs.map(t =>
                visited.has(t.value) ? (
                    <div key={t.value} hidden={activeTab !== t.value}>
                        {t.content}
                    </div>
                ) : null,
            )}
        </>
    );
}
