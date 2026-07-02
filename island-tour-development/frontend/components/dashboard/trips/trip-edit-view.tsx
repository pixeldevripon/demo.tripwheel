'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRole } from '@/contexts/role-context';
import {
    usePauseTrip,
    usePublishTrip,
    useTrip,
    useTripTranslationByLocale,
    useUnpauseTrip,
} from '@/hooks/trips/use-trips';
import type { TripStatus } from '@/types/trip';
import {
    ArchiveIcon,
    CheckIcon,
    PauseIcon,
    PlayIcon,
    RotateCcwIcon,
    XIcon,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { TripArchiveDialog } from './trip-archive-dialog';
import { TripAttributesTab } from './trip-attributes-tab';
import { TripDetailShell } from './trip-detail-shell';
import { TripDetailsTab } from './trip-details-tab';
import { TripExclusionsTab } from './trip-exclusions-tab';
import { TripHighlightsTab } from './trip-highlights-tab';
import { TripImagesTab } from './trip-images-tab';
import { TripInclusionsTab } from './trip-inclusions-tab';
import { TripLocationsTab } from './trip-locations-tab';
import { TripPickupLocationsTab } from './trip-pickup-locations-tab';
import { TripPricingTab } from './trip-pricing-tab';
import { TripPromotionTab } from './trip-promotion-tab';
import { TripSchedulesTab } from './trip-schedules-tab';
import { TripTranslationsTab } from './trip-translations-tab';

const statusVariant: Record<
    TripStatus,
    'default' | 'secondary' | 'destructive' | 'outline'
> = {
    DRAFT: 'secondary',
    LIVE: 'default',
    PAUSED: 'outline',
    ARCHIVED: 'destructive',
};

interface ReadinessItemProps {
    label: string;
    passed: boolean;
}

function ReadinessItem({ label, passed }: ReadinessItemProps) {
    return (
        <div className='flex items-center gap-2 text-sm'>
            {passed ? (
                <CheckIcon className='size-4 text-emerald-500 shrink-0' />
            ) : (
                <XIcon className='size-4 text-destructive shrink-0' />
            )}
            <span
                className={
                    passed ? 'text-muted-foreground' : 'text-destructive'
                }>
                {label}
            </span>
        </div>
    );
}

const VALID_TABS = [
    'details',
    'images',
    'highlights',
    'inclusions',
    'itinerary',
    'pickups',
    'pricing',
    'attributes',
    'schedules',
    'promotion',
    'translations',
] as const;

interface TripEditViewProps {
    id: string;
    initialTab?: string;
}

export function TripEditView({ id, initialTab }: TripEditViewProps) {
    const activeTab =
        initialTab && (VALID_TABS as readonly string[]).includes(initialTab)
            ? initialTab
            : 'details';
    const { data: trip, isLoading } = useTrip(id);

    const { data: enTranslation } = useTripTranslationByLocale(id, 'en');
    const { can } = useRole();
    const [warnings, setWarnings] = useState<string[]>([]);
    const [archiveOpen, setArchiveOpen] = useState(false);

    const { mutate: publishTrip, isPending: isPublishing } = usePublishTrip();
    const { mutate: pauseTrip, isPending: isPausing } = usePauseTrip();
    const { mutate: unpauseTrip, isPending: isUnpausing } = useUnpauseTrip();

    const isLifecyclePending = isPublishing || isPausing || isUnpausing;

    function handlePublish() {
        publishTrip(id, {
            onSuccess: () => toast.success('Trip published successfully.'),
            onError: err =>
                toast.error(
                    err instanceof Error ? err.message : 'Failed to publish.'
                ),
        });
    }

    function handlePause() {
        pauseTrip(id, {
            onSuccess: () => toast.success('Trip paused.'),
            onError: err =>
                toast.error(
                    err instanceof Error ? err.message : 'Failed to pause.'
                ),
        });
    }

    function handleUnpause() {
        unpauseTrip(id, {
            onSuccess: () => toast.success('Trip resumed.'),
            onError: err =>
                toast.error(
                    err instanceof Error ? err.message : 'Failed to unpause.'
                ),
        });
    }

    const imageCount = trip?.imageCount ?? 0;
    const highlightCount = trip?.highlightCount ?? 0;
    const hasHero = !!trip?.heroImage;
    const hasEnOverview = !!enTranslation?.overview?.trim();

    const hasPrice = trip?.priceFrom != null || trip?.basePrice != null;

    const readinessChecks = [
        { label: 'At least 5 images uploaded', passed: imageCount >= 5 },
        { label: 'Hero image set', passed: hasHero },
        { label: 'At least 3 highlights added', passed: highlightCount >= 3 },
        { label: 'English overview filled', passed: hasEnOverview },
        { label: 'Price set (base price or age band)', passed: hasPrice },
    ];
    const allPassed = readinessChecks.every(c => c.passed);

    if (isLoading) {
        return (
            <TripDetailShell
                id={id}
                name={undefined}
                isLoading
                subtitle='Edit trip'>
                <div className='space-y-4'>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton
                            key={i}
                            className='h-12 w-full rounded-none'
                        />
                    ))}
                </div>
            </TripDetailShell>
        );
    }

    if (!trip) {
        return (
            <TripDetailShell
                id={id}
                name={undefined}
                isLoading={false}
                subtitle='Edit trip'>
                <p className='text-sm text-muted-foreground'>Trip not found.</p>
            </TripDetailShell>
        );
    }

    return (
        <TripDetailShell
            id={id}
            name={trip.name}
            isLoading={false}
            subtitle='Edit trip'>
            {/* Header with status + lifecycle actions */}
            <div className='flex flex-wrap items-center justify-between gap-3 mb-6'>
                <div className='flex items-center gap-3'>
                    <Badge variant={statusVariant[trip.status]}>
                        {trip.status}
                    </Badge>
                    {trip.isSponsored && (
                        <Badge variant='outline'>Sponsored</Badge>
                    )}
                </div>

                {can('MANAGE_TRIPS') && (
                    <div className='flex flex-wrap gap-2'>
                        {trip.status === 'DRAFT' && (
                            <Button
                                size='sm'
                                onClick={handlePublish}
                                disabled={isLifecyclePending}>
                                <PlayIcon className='size-3.5' />
                                Publish
                            </Button>
                        )}
                        {trip.status === 'LIVE' && (
                            <>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    onClick={handlePause}
                                    disabled={isLifecyclePending}>
                                    <PauseIcon className='size-3.5' />
                                    Pause
                                </Button>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    onClick={() => setArchiveOpen(true)}
                                    disabled={isLifecyclePending}>
                                    <ArchiveIcon className='size-3.5' />
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
                                    <RotateCcwIcon className='size-3.5' />
                                    Unpause
                                </Button>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    onClick={() => setArchiveOpen(true)}
                                    disabled={isLifecyclePending}>
                                    <ArchiveIcon className='size-3.5' />
                                    Archive
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Warnings banner */}
            {warnings.length > 0 && (
                <div className='mb-4 bg-amber-50 border border-amber-200 px-4 py-3 space-y-1'>
                    <p className='text-xs font-semibold uppercase text-amber-700'>
                        Warnings
                    </p>
                    {warnings.map((w, i) => (
                        <p key={i} className='text-sm text-amber-700'>
                            {w}
                        </p>
                    ))}
                </div>
            )}

            {/* Publish readiness */}
            {trip.status === 'DRAFT' && (
                <Card
                    className={`mb-6 ${allPassed ? 'border-emerald-200' : 'border-amber-200'}`}>
                    <CardHeader className='border-b pb-4'>
                        <CardTitle className='text-sm'>
                            Publish Readiness
                        </CardTitle>
                    </CardHeader>
                    <CardContent className='pt-4'>
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                            {readinessChecks.map(check => (
                                <ReadinessItem
                                    key={check.label}
                                    label={check.label}
                                    passed={check.passed}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Tabbed interface */}
            <Tabs defaultValue={activeTab}>
                <div className='pb-2 mb-6'>
                    <TabsList>
                        <TabsTrigger value='details'>Details</TabsTrigger>
                        <TabsTrigger value='images'>
                            Images
                            {imageCount < 5 && (
                                <span className='ml-1.5 size-1.5 rounded-full bg-destructive' />
                            )}
                        </TabsTrigger>
                        <TabsTrigger value='highlights'>
                            Highlights
                            {highlightCount < 3 && (
                                <span className='ml-1.5 size-1.5 rounded-full bg-destructive' />
                            )}
                        </TabsTrigger>
                        <TabsTrigger value='inclusions'>
                            Inclusions &amp; Exclusions
                        </TabsTrigger>
                        <TabsTrigger value='itinerary'>Itinerary</TabsTrigger>
                        <TabsTrigger value='pickups'>Pickups</TabsTrigger>
                        <TabsTrigger value='pricing'>Pricing</TabsTrigger>
                        <TabsTrigger value='attributes'>Attributes</TabsTrigger>
                        <TabsTrigger value='schedules'>Schedules</TabsTrigger>
                        <TabsTrigger value='promotion'>Promotion</TabsTrigger>
                        <TabsTrigger value='translations'>
                            Translations
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value='details'>
                    <TripDetailsTab trip={trip} onWarnings={setWarnings} />
                </TabsContent>

                <TabsContent value='images'>
                    <TripImagesTab trip={trip} />
                </TabsContent>

                <TabsContent value='highlights'>
                    <TripHighlightsTab tripId={id} />
                </TabsContent>

                <TabsContent value='inclusions' className='space-y-6'>
                    <TripInclusionsTab tripId={id} />
                    <TripExclusionsTab tripId={id} />
                </TabsContent>

                <TabsContent value='itinerary'>
                    <TripLocationsTab tripId={id} />
                </TabsContent>

                <TabsContent value='pickups'>
                    <TripPickupLocationsTab tripId={id} />
                </TabsContent>

                <TabsContent value='pricing'>
                    <TripPricingTab tripId={id} />
                </TabsContent>

                <TabsContent value='attributes'>
                    <TripAttributesTab trip={trip} />
                </TabsContent>

                <TabsContent value='schedules'>
                    <TripSchedulesTab tripId={id} />
                </TabsContent>

                <TabsContent value='promotion'>
                    <TripPromotionTab trip={trip} />
                </TabsContent>

                <TabsContent value='translations'>
                    <TripTranslationsTab tripId={id} tripName={trip.name} />
                </TabsContent>
            </Tabs>

            {trip && (
                <TripArchiveDialog
                    tripId={id}
                    tripName={trip.name}
                    tripStatus={trip.status}
                    open={archiveOpen}
                    onOpenChange={setArchiveOpen}
                />
            )}
        </TripDetailShell>
    );
}

