'use client';

/**
 * The grouped tour editor (04 §2.2 B, Phase 18; in-page tabs per user
 * decision 2026-07-17 - one page, no separate routes). The old 13 FLAT tabs
 * become a two-level tab set on /trips/[id]/edit:
 *
 *   Setup         Details · Pricing · Schedules
 *   Content       Images · Highlights · Inclusions · Itinerary · Pickups ·
 *                 Info & Terms
 *   Reach         Attributes · Promotion · SEO
 *   Translations  English content + Translation Console links
 *
 * `?tab=` stays the single URL source of truth: the section implies its
 * group (TAB_TO_GROUP), so every old deep link - row actions, readiness
 * chips, bookmarks, e2e - keeps working unchanged. Tab switches write back
 * via router.replace so refresh/share keep the exact section.
 *
 * The header (status + lifecycle) and the readiness bar persist across all
 * groups - the publish contract never leaves the screen.
 */

import {
    Archive02Icon,
    ArrowLeft01Icon,
    ArrowRight01Icon,
    PauseIcon,
    RotateLeft01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/common/status-badge';
import { TRIP_STATUS } from '@/components/common/status-maps';
import { EnglishContentEditor } from '@/components/translations/english-content-editor';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRole } from '@/contexts/role-context';
import {
    usePauseTrip,
    usePublishTrip,
    useTrip,
    useTripTranslationByLocale,
    useUnpauseTrip,
} from '@/hooks/trips/use-trips';
import { getListingChecks, getPublishChecks } from '@/lib/trips/readiness';
import type { TripListItem } from '@/types/trip';
import { ReadinessRail } from '../readiness-rail';
import { TripArchiveDialog } from '../trip-archive-dialog';
import { TripAttributesTab } from '../trip-attributes-tab';
import { TripDetailShell } from '../trip-detail-shell';
import { TripDetailsTab } from '../trip-details-tab';
import { TripExclusionsTab } from '../trip-exclusions-tab';
import { TripFeaturesTab } from '../trip-features-tab';
import { TripHighlightsTab } from '../trip-highlights-tab';
import { TripImagesTab } from '../trip-images-tab';
import { TripInclusionsTab } from '../trip-inclusions-tab';
import { TripLocationsTab } from '../trip-locations-tab';
import { TripPickupLocationsTab } from '../trip-pickup-locations-tab';
import { TripPricingTab } from '../trip-pricing-tab';
import { TripPromotionTab } from '../trip-promotion-tab';
import { TripSchedulesTab } from '../trip-schedules-tab';
import { TripSeoTab } from '../trip-seo-tab';

export type TripEditorGroup = 'setup' | 'content' | 'reach';

export const GROUP_TABS: Record<TripEditorGroup, { value: string; label: string }[]> = {
    setup: [
        { value: 'details', label: 'Details' },
        { value: 'pricing', label: 'Pricing' },
        { value: 'schedules', label: 'Schedules' },
    ],
    content: [
        { value: 'copy', label: 'Text' },
        { value: 'images', label: 'Images' },
        { value: 'highlights', label: 'Highlights' },
        { value: 'inclusions', label: 'Inclusions & Exclusions' },
        { value: 'itinerary', label: 'Itinerary' },
        { value: 'pickups', label: 'Pickups' },
        { value: 'info', label: 'Info & Terms' },
    ],
    reach: [
        { value: 'attributes', label: 'Attributes' },
        { value: 'promotion', label: 'Promotion' },
        { value: 'seo', label: 'SEO' },
    ],
};

/** Old `?tab=` values → their new route group (edit/page.tsx redirect map). */
export const TAB_TO_GROUP: Record<string, TripEditorGroup> = {
    details: 'setup',
    pricing: 'setup',
    schedules: 'setup',
    copy: 'content',
    images: 'content',
    highlights: 'content',
    inclusions: 'content',
    exclusions: 'content',
    itinerary: 'content',
    pickups: 'content',
    info: 'content',
    attributes: 'reach',
    promotion: 'reach',
    seo: 'reach',
};

const GROUP_LABELS: Record<TripEditorGroup, string> = {
    setup: 'Setup',
    content: 'Content',
    reach: 'Reach',
};

const GROUP_ORDER: TripEditorGroup[] = ['setup', 'content', 'reach'];

/** Linear walk order across every section (prev/next footer). */
const FLAT_SECTIONS: { value: string; label: string }[] = [
    ...GROUP_TABS.setup,
    ...GROUP_TABS.content,
    ...GROUP_TABS.reach,
];

interface TripEditorViewProps {
    id: string;
    initialTab?: string;
}

function SectionPanel({
    tab,
    trip,
    onWarnings,
}: {
    tab: string;
    trip: TripListItem;
    onWarnings: (w: string[]) => void;
}) {
    switch (tab) {
        case 'details':
            return <TripDetailsTab trip={trip} onWarnings={onWarnings} />;
        case 'pricing':
            return <TripPricingTab trip={trip} />;
        case 'schedules':
            return (
                <TripSchedulesTab
                    tripId={trip.id}
                    maxPartySize={trip.maxPartySize}
                    declaredStartTimes={trip.startTimes ?? []}
                />
            );
        case 'copy':
            return <EnglishContentEditor type='tour' id={trip.id} />;
        case 'images':
            return <TripImagesTab trip={trip} />;
        case 'highlights':
            return <TripHighlightsTab tripId={trip.id} />;
        case 'inclusions':
            return (
                <div className='space-y-6'>
                    <TripInclusionsTab tripId={trip.id} />
                    <TripExclusionsTab tripId={trip.id} />
                </div>
            );
        case 'itinerary':
            return <TripLocationsTab tripId={trip.id} />;
        case 'pickups':
            return <TripPickupLocationsTab tripId={trip.id} />;
        case 'info':
            return <TripFeaturesTab tripId={trip.id} />;
        case 'attributes':
            return <TripAttributesTab trip={trip} />;
        case 'promotion':
            return <TripPromotionTab trip={trip} />;
        case 'seo':
            return <TripSeoTab trip={trip} />;
        default:
            return null;
    }
}

export function TripEditorView({ id, initialTab }: TripEditorViewProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const rawTab = searchParams.get('tab') ?? initialTab ?? 'details';
    const normalized =
        rawTab === 'exclusions'
            ? 'inclusions'
            : rawTab === 'translations'
              ? 'copy'
              : rawTab;
    const group: TripEditorGroup = TAB_TO_GROUP[normalized] ?? 'setup';
    const tabs = GROUP_TABS[group];
    const activeTab = tabs.some(t => t.value === normalized)
        ? normalized
        : (tabs[0]?.value ?? '');

    const { data: trip, isLoading } = useTrip(id);
    const { data: enTranslation } = useTripTranslationByLocale(id, 'en');
    const { can } = useRole();
    const [warnings, setWarnings] = useState<string[]>([]);
    const [archiveOpen, setArchiveOpen] = useState(false);

    // Friction killers (user session 2026-07-17):
    // - visited sections stay MOUNTED (hidden, not unmounted): switching
    //   tabs is instant and never discards unsaved form edits.
    // - each group remembers its last section, so Setup ↔ Content round
    //   trips land where you left off.
    const currentSection = activeTab;
    const [visited, setVisited] = useState<Set<string>>(
        () => new Set([currentSection]),
    );
    const lastTabByGroup = useRef<Partial<Record<TripEditorGroup, string>>>({});
    useEffect(() => {
        setVisited(prev =>
            prev.has(currentSection) ? prev : new Set(prev).add(currentSection),
        );
        lastTabByGroup.current[group] = activeTab;
    }, [currentSection, group, activeTab]);

    const { mutate: publishTrip, isPending: isPublishing } = usePublishTrip();
    const { mutate: pauseTrip, isPending: isPausing } = usePauseTrip();
    const { mutate: unpauseTrip, isPending: isUnpausing } = useUnpauseTrip();
    const isLifecyclePending = isPublishing || isPausing || isUnpausing;

    function handlePublish() {
        publishTrip(id, {
            onSuccess: () => toast.success('Trip published successfully.'),
            onError: err =>
                toast.error(
                    err instanceof Error ? err.message : 'Failed to publish.',
                ),
        });
    }

    function handlePause() {
        pauseTrip(id, {
            onSuccess: () => toast.success('Trip paused.'),
            onError: err =>
                toast.error(
                    err instanceof Error ? err.message : 'Failed to pause.',
                ),
        });
    }

    function handleUnpause() {
        unpauseTrip(id, {
            onSuccess: () => toast.success('Trip resumed.'),
            onError: err =>
                toast.error(
                    err instanceof Error ? err.message : 'Failed to unpause.',
                ),
        });
    }

    function switchTab(tab: string) {
        router.replace(`/trips/${id}/edit?tab=${tab}`, { scroll: false });
    }

    function switchGroup(g: string) {
        const next = g as TripEditorGroup;
        switchTab(lastTabByGroup.current[next] ?? GROUP_TABS[next][0].value);
    }

    if (isLoading) {
        return (
            <TripDetailShell id={id} name={undefined} isLoading subtitle='Edit trip'>
                <div className='space-y-4'>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className='h-12 w-full' />
                    ))}
                </div>
            </TripDetailShell>
        );
    }

    if (!trip) {
        return (
            <TripDetailShell id={id} name={undefined} isLoading={false} subtitle='Edit trip'>
                <p className='text-sm text-content-muted'>Trip not found.</p>
            </TripDetailShell>
        );
    }

    const publishChecks = getPublishChecks(trip, !!enTranslation?.overview?.trim());
    const listingChecks = getListingChecks(trip);
    const statusMeta = TRIP_STATUS[trip.status];

    return (
        <TripDetailShell id={id} name={trip.name} isLoading={false} subtitle='Edit trip'>
            {/* Status + lifecycle. Publish lives in the readiness bar. */}
            <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
                <div className='flex items-center gap-3'>
                    <StatusBadge variant={statusMeta.variant}>
                        {statusMeta.label}
                    </StatusBadge>
                    {trip.isSponsored && (
                        <StatusBadge variant='neutral'>Sponsored</StatusBadge>
                    )}
                </div>

                {can('MANAGE_TRIPS') && (
                    <div className='flex flex-wrap gap-2'>
                        {trip.status === 'LIVE' && (
                            <>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    onClick={handlePause}
                                    disabled={isLifecyclePending}>
                                    <HugeiconsIcon icon={PauseIcon} className='size-3.5' />
                                    Pause
                                </Button>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    onClick={() => setArchiveOpen(true)}
                                    disabled={isLifecyclePending}>
                                    <HugeiconsIcon icon={Archive02Icon} className='size-3.5' />
                                    Archive
                                </Button>
                            </>
                        )}
                        {trip.status === 'PAUSED' && (
                            <>
                                <Button
                                    size='sm'
                                    onClick={handleUnpause}
                                    disabled={isLifecyclePending}>
                                    <HugeiconsIcon icon={RotateLeft01Icon} className='size-3.5' />
                                    Unpause
                                </Button>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    onClick={() => setArchiveOpen(true)}
                                    disabled={isLifecyclePending}>
                                    <HugeiconsIcon icon={Archive02Icon} className='size-3.5' />
                                    Archive
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Warnings from the details form */}
            {warnings.length > 0 && (
                <div className='mb-4 space-y-1 rounded-md border border-warning-border bg-warning-subtle px-4 py-3'>
                    <p className='text-xs font-semibold text-warning-fg'>Warnings</p>
                    {warnings.map((w, i) => (
                        <p key={i} className='text-sm text-warning-fg'>
                            {w}
                        </p>
                    ))}
                </div>
            )}

            {/* Published-not-listed notice */}
            {trip.status === 'LIVE' && !trip.isBookable && (
                <div className='mb-4 rounded-md border border-warning-border bg-warning-subtle px-4 py-3'>
                    <p className='text-xs font-semibold text-warning-fg'>
                        Published, not yet listed
                    </p>
                    <p className='mt-1 text-sm text-warning-fg'>
                        This tour has no bookable availability in the next 30
                        days, so it will not appear in public listings yet. Add
                        recurring schedules in Setup → Schedules and make sure
                        each one has a capacity - set a Max Party Size in
                        Details, or a capacity override per schedule. It lists
                        automatically once bookable departures exist.
                    </p>
                </div>
            )}

            <ReadinessRail
                tripId={id}
                status={trip.status}
                publishChecks={publishChecks}
                listingChecks={listingChecks}
                canManage={can('MANAGE_TRIPS')}
                onPublish={handlePublish}
                isPublishing={isPublishing}
            />

            {/* Sticky two-level rails: switching never requires scrolling
                back up, even deep inside a long section. */}
            <div className='sticky top-0 z-20 -mx-2 mb-6 space-y-2 bg-shell-content/95 px-2 py-2 backdrop-blur-sm'>
                <Tabs value={group} onValueChange={switchGroup}>
                    <TabsList>
                        {GROUP_ORDER.map(g => (
                            <TabsTrigger key={g} value={g}>
                                {GROUP_LABELS[g]}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
                <Tabs value={activeTab} onValueChange={switchTab}>
                    <TabsList variant='line'>
                        {tabs.map(t => (
                            <TabsTrigger key={t.value} value={t.value}>
                                {t.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            </div>

            {/* Visited sections stay mounted (hidden) - instant switches,
                no silently-discarded edits, queries stay warm. */}
            {FLAT_SECTIONS.map(sec => {
                if (!visited.has(sec.value)) return null;
                const active = currentSection === sec.value;
                return (
                    <div key={sec.value} hidden={!active}>
                        <SectionPanel
                            tab={sec.value}
                            trip={trip}
                            onWarnings={setWarnings}
                        />
                    </div>
                );
            })}

            {/* Linear walk: complete the whole tour without hunting tabs. */}
            <div className='mt-8 flex items-center justify-between border-t border-line pt-4'>
                {(() => {
                    const idx = FLAT_SECTIONS.findIndex(
                        sec => sec.value === currentSection,
                    );
                    const prev = idx > 0 ? FLAT_SECTIONS[idx - 1] : null;
                    const next =
                        idx >= 0 && idx < FLAT_SECTIONS.length - 1
                            ? FLAT_SECTIONS[idx + 1]
                            : null;
                    const go = (v: string) => switchTab(v);
                    return (
                        <>
                            {prev ? (
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => go(prev.value)}>
                                    <HugeiconsIcon
                                        icon={ArrowLeft01Icon}
                                        className='size-3.5'
                                    />
                                    {prev.label}
                                </Button>
                            ) : (
                                <span />
                            )}
                            {next && (
                                <Button
                                    variant='outline'
                                    size='sm'
                                    onClick={() => go(next.value)}>
                                    Next: {next.label}
                                    <HugeiconsIcon
                                        icon={ArrowRight01Icon}
                                        className='size-3.5'
                                    />
                                </Button>
                            )}
                        </>
                    );
                })()}
            </div>

            <TripArchiveDialog
                tripId={id}
                tripName={trip.name}
                tripStatus={trip.status}
                open={archiveOpen}
                onOpenChange={setArchiveOpen}
            />
        </TripDetailShell>
    );
}
