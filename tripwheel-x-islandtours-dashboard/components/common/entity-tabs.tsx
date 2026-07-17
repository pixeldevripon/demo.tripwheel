'use client';

/**
 * EntityTabs (Phase 19) - THE tab system for entity edit pages, carrying the
 * tours-editor friction fixes to every module:
 *
 * - `?tab=` is the URL source of truth: deep links, refresh and share keep
 *   the exact tab; switches write back via router.replace (no history spam).
 * - Visited panels stay MOUNTED (hidden, not unmounted): switching tabs is
 *   instant and never silently discards unsaved form edits.
 * - `aliases` map legacy tab values (e.g. the removed `translations` tab) to
 *   their new home so old bookmarks and row-action links keep working.
 *
 * Four entity editors used to hand-roll this scaffold with drifting behavior
 * (some URL-synced, some useState, all unmount-on-switch).
 */

import { useRouter, useSearchParams } from 'next/navigation';
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
    const router = useRouter();
    const searchParams = useSearchParams();

    const rawTab = searchParams.get('tab') ?? initialTab ?? tabs[0]?.value;
    const normalized = (rawTab && aliases[rawTab]) || rawTab;
    const activeTab = tabs.some(t => t.value === normalized)
        ? (normalized as string)
        : (tabs[0]?.value ?? '');

    const [visited, setVisited] = useState<Set<string>>(
        () => new Set([activeTab]),
    );
    useEffect(() => {
        setVisited(prev =>
            prev.has(activeTab) ? prev : new Set(prev).add(activeTab),
        );
    }, [activeTab]);

    function switchTab(tab: string) {
        router.replace(`${basePath}?tab=${tab}`, { scroll: false });
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
