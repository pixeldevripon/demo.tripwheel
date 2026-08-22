'use client';

/**
 * Coordinate picker: a map bound to two text fields (07 §11 task 7).
 *
 * Purely additive - it writes the SAME `latitude` / `longitude` numbers those
 * fields always held, so no payload, endpoint or validation changed. What it
 * removes is the step where an operator leaves the dashboard, finds their dock
 * on another map, right-clicks, copies two numbers, and pastes them into boxes
 * that give no feedback if the sign is wrong.
 *
 * Binding is two-way and string-based, because that is what the forms hold:
 * typing into the inputs moves the marker, and clicking or dragging the marker
 * rewrites the inputs. Anything unparseable simply shows no marker rather than
 * throwing or snapping to (0, 0) in the Atlantic.
 *
 * The map itself is loaded with `ssr: false`. Leaflet touches `window` at
 * module scope, and this is the boundary that keeps it off the server.
 */

import { Location01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { MapViewMode, RoutePoint } from './map-picker';

const MapPicker = dynamic(() => import('./map-picker'), {
    ssr: false,
    loading: () => <Skeleton className='h-64 w-full rounded-lg' />,
});

interface MapPickerFieldProps {
    /** Raw form values - may be empty or half-typed. */
    lat: string;
    lng: string;
    onChange: (next: { lat: string; lng: string }) => void;
    /**
     * Where the map opens before a point is picked. Pass the destination's
     * coordinates so an operator on Curacao does not start over the Atlantic.
     */
    fallbackCenter?: { lat: number; lng: number } | null;
    disabled?: boolean;
    heightClassName?: string;
}

/** The Caribbean, roughly. Only used when a destination has no coordinates. */
const REGION_FALLBACK = { lat: 12.1696, lng: -68.99 };

function parsePoint(
    lat: string,
    lng: string,
): { lat: number; lng: number } | null {
    const a = Number.parseFloat(lat);
    const b = Number.parseFloat(lng);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    // Out-of-range values are a typo, not a location - show no marker rather
    // than let Leaflet clamp them somewhere confidently wrong.
    if (a < -90 || a > 90 || b < -180 || b > 180) return null;
    return { lat: a, lng: b };
}

/**
 * Read-only overview of an ordered set of stops: numbered markers joined by a
 * dashed line, auto-framed to fit them all. No pin to place - the coordinates
 * are edited per stop in the list beside it.
 */
export function RouteMap({
    stops,
    fallbackCenter,
    heightClassName,
    onStopDrag,
    connect = true,
}: {
    stops: RoutePoint[];
    /** Join the markers with a line. Off for scattered points. */
    connect?: boolean;
    fallbackCenter?: { lat: number; lng: number } | null;
    heightClassName?: string;
    /** Omit to keep the route read-only. */
    onStopDrag?: (
        stop: RoutePoint,
        next: { lat: number; lng: number },
    ) => void;
}) {
    const [viewMode, setViewMode] = useState<MapViewMode>('map');

    return (
        <div>
            <MapPicker
                value={null}
                disabled
                route={stops}
                connect={connect}
                onStopDrag={onStopDrag}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                fallbackCenter={fallbackCenter ?? REGION_FALLBACK}
                heightClassName={heightClassName}
            />
        </div>
    );
}

export function MapPickerField({
    lat,
    lng,
    onChange,
    fallbackCenter,
    disabled = false,
    heightClassName,
}: MapPickerFieldProps) {
    const value = useMemo(() => parsePoint(lat, lng), [lat, lng]);
    const center = fallbackCenter ?? REGION_FALLBACK;
    const [viewMode, setViewMode] = useState<MapViewMode>('map');

    return (
        <div className='space-y-2'>
            <MapPicker
                value={value}
                fallbackCenter={center}
                disabled={disabled}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                heightClassName={heightClassName}
                onChange={next =>
                    onChange({ lat: String(next.lat), lng: String(next.lng) })
                }
            />
            <div className='flex flex-wrap items-center gap-2'>
                <p className='text-xs text-content-muted'>
                    <HugeiconsIcon
                        icon={Location01Icon}
                        className='mr-1 inline size-3.5 align-text-bottom'
                    />
                    {value
                        ? 'Drag the pin or click the map to adjust.'
                        : 'Click the map to drop a pin, or type the coordinates below.'}
                </p>
                {value && !disabled && (
                    <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        className='ml-auto h-auto py-0.5 text-xs text-content-muted'
                        onClick={() => onChange({ lat: '', lng: '' })}>
                        Clear pin
                    </Button>
                )}
            </div>
        </div>
    );
}
