'use client';

/**
 * The actual Leaflet map. NEVER import this directly - go through
 * `map-picker-field.tsx`, which loads it with `ssr: false`. Leaflet touches
 * `window` at module scope and will crash a server render.
 *
 * Two modes, one component:
 * - **picker** - a draggable pin the operator places (meeting point, a stop, a
 *   pickup zone).
 * - **route** - a read-only overview: every itinerary stop numbered in order,
 *   joined by a dashed line.
 *
 * Tiles are CARTO Positron / Dark Matter, not OSM standard. Standard OSM is a
 * full colour reference map - green landcover, orange roads, every footpath -
 * which meant a meeting-point picker was the loudest thing on an otherwise
 * greyscale page, and a teal pin had to compete with it. Positron is near
 * monochrome, so the pin and the route line become the only colour on the map,
 * which is exactly the rule the rest of the wizard follows.
 *
 * Three Leaflet-specific things worth knowing:
 * - The default marker icon is a bundled PNG whose path breaks under every
 *   bundler, so every marker here is a `divIcon` with plain markup - no image
 *   asset to resolve at all.
 * - A map created inside a container that was hidden or resized (a collapsible
 *   wizard section, exactly our case) renders grey tiles until it is told to
 *   re-measure. `ResizeObserver` -> `invalidateSize` is the fix.
 * - Tile URLs cannot be swapped in place on a `TileLayer`; the layer is keyed
 *   by theme so React remounts it instead.
 */

import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils';
import { useEffect, useMemo, useRef } from 'react';
import {
    MapContainer,
    Marker,
    Polyline,
    TileLayer,
    useMap,
    useMapEvents,
} from 'react-leaflet';

export interface RoutePoint {
    lat: number;
    lng: number;
    label?: string | null;
    /** Identifies the row this marker belongs to, so a drag can write back. */
    id?: string;
}

export interface MapPickerProps {
    /** Current point. Null when the operator has not picked one yet. */
    value: { lat: number; lng: number } | null;
    onChange?: (next: { lat: number; lng: number }) => void;
    /** Where to open when there is no value - usually the destination. */
    fallbackCenter: { lat: number; lng: number };
    /** Read-only preview (no click, no drag). */
    disabled?: boolean;
    /** Points to draw as numbered markers. */
    route?: RoutePoint[];
    /** Join them with a line. Off for scattered points like pickup zones. */
    connect?: boolean;
    /**
     * Makes the numbered stop markers draggable. Fires on drag END, not on
     * every frame - a stop is a saved record, and writing one per pointer
     * move would be a request storm.
     */
    onStopDrag?: (stop: RoutePoint, next: { lat: number; lng: number }) => void;
    /** Base layer. Terrain and satellite ignore the dark theme by nature. */
    viewMode?: MapViewMode;
    /** Provide to render the style switcher on the map. */
    onViewModeChange?: (next: MapViewMode) => void;
    heightClassName?: string;
}

/** Six decimals is roughly 0.1m - far past what a meeting point needs. */
function round(n: number): number {
    return Math.round(n * 1e6) / 1e6;
}

export type MapViewMode = 'map' | 'terrain' | 'satellite';

interface TileConfig {
    url: string;
    attribution: string;
    maxZoom: number;
}

/**
 * All three sources are keyless and free to use WITH attribution, which is why
 * they are here rather than Mapbox or MapTiler. Each provider's terms are met
 * by the credit line baked into its config below - do not strip them.
 *
 * If tile volume ever becomes real traffic, these are the wrong providers:
 * OpenTopoMap and Esri both publish fair-use policies aimed at low-volume use,
 * and a keyed provider would be the honest upgrade.
 */
const TILES: Record<MapViewMode | 'mapDark', TileConfig> = {
    // Near-monochrome by design: the pin and the route line stay the only
    // colour on the map, matching the rest of the wizard.
    map: {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
    },
    mapDark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
    },
    // Contours and relief - useful for a hike or a viewpoint. Caps at 17.
    terrain: {
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution:
            'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
        maxZoom: 17,
    },
    // Imagery - the one that answers "is this pin actually on the dock".
    satellite: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution:
            'Tiles &copy; Esri - Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        maxZoom: 19,
    },
};

const pinIcon = L.divIcon({
    className: '',
    html: `<span class="block size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-md"></span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
});

/** Numbered stop marker. Order is the whole point of an itinerary. */
function stopIcon(index: number): L.DivIcon {
    return L.divIcon({
        className: '',
        html: `<span class="flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-primary text-2xs font-semibold leading-none text-white shadow-md">${index + 1}</span>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
    });
}

export default function MapPicker({
    value,
    onChange,
    fallbackCenter,
    disabled = false,
    route,
    connect = true,
    onStopDrag,
    viewMode = 'map',
    onViewModeChange,
    heightClassName = 'h-64',
}: MapPickerProps) {
    const { resolvedTheme } = useTheme();
    const tiles =
        viewMode === 'map' && resolvedTheme === 'dark'
            ? TILES.mapDark
            : TILES[viewMode];

    const stops = useMemo(
        () => (route ?? []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
        [route],
    );

    const center = useMemo(
        () => value ?? stops[0] ?? fallbackCenter,
        [value, stops, fallbackCenter],
    );

    const editable = !disabled && !!onChange;

    return (
        // `isolate` is load-bearing, not decoration. Leaflet stacks its panes at
        // z-index 400 and its controls at 800, and the toggle below sits at
        // 1000. `relative` alone leaves this element at `z-index: auto`, which
        // does NOT open a stacking context - so those numbers competed in the
        // ROOT context and beat every overlay in the app, which top out at
        // z-50. The symptom was a map painting straight through the dialog
        // backdrop, and over the dialog itself, when leaving a step with
        // unsaved changes. `isolation: isolate` contains all of it; the wrapper
        // then paints in normal document order, under the overlay.
        <div
            className={`relative isolate ${heightClassName} overflow-hidden rounded-lg border border-line`}>
            {/* Top-RIGHT: Leaflet owns the top-left with its zoom buttons and
                the bottom-right with the attribution it is legally required to
                keep visible. z-1000 clears Leaflet's own control layer - and is
                now scoped to this element's stacking context. */}
            {onViewModeChange && (
                <div className='absolute top-2 right-2 z-[1000]'>
                    <MapViewToggle
                        value={viewMode}
                        onChange={onViewModeChange}
                    />
                </div>
            )}
            <MapContainer
                center={[center.lat, center.lng]}
                zoom={value || stops.length ? 14 : 11}
                scrollWheelZoom={false}
                dragging
                className='size-full'>
                {/* Keyed: a TileLayer will not swap its URL in place, so the
                    layer is remounted when the source changes. */}
                <TileLayer
                    key={`${viewMode}-${resolvedTheme === 'dark' ? 'dark' : 'light'}`}
                    attribution={tiles.attribution}
                    url={tiles.url}
                    maxZoom={tiles.maxZoom}
                />

                {editable && <ClickToPlace onChange={onChange} />}
                <RecenterOnValue value={value} />
                <FitToRoute stops={stops} />
                <InvalidateOnResize />

                {/* Dashed, so the connector never reads as a real road. */}
                {connect && stops.length > 1 && (
                    <Polyline
                        positions={stops.map(p => [p.lat, p.lng] as [number, number])}
                        pathOptions={{
                            color: 'currentColor',
                            weight: 2,
                            opacity: 0.7,
                            dashArray: '4 6',
                        }}
                        className='text-primary'
                    />
                )}

                {stops.map((p, i) => (
                    <Marker
                        key={p.id ?? `${i}`}
                        position={[p.lat, p.lng]}
                        icon={stopIcon(i)}
                        title={p.label ?? undefined}
                        draggable={!!onStopDrag && !!p.id}
                        eventHandlers={{
                            dragend: e => {
                                const { lat, lng } = e.target.getLatLng();
                                onStopDrag?.(p, {
                                    lat: round(lat),
                                    lng: round(lng),
                                });
                            },
                        }}
                    />
                ))}

                {value && (
                    <Marker
                        position={[value.lat, value.lng]}
                        icon={pinIcon}
                        draggable={editable}
                        eventHandlers={{
                            dragend: e => {
                                const { lat, lng } = e.target.getLatLng();
                                onChange?.({ lat: round(lat), lng: round(lng) });
                            },
                        }}
                    />
                )}
            </MapContainer>
        </div>
    );
}

function ClickToPlace({
    onChange,
}: {
    onChange: (next: { lat: number; lng: number }) => void;
}) {
    useMapEvents({
        click: e =>
            onChange({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }),
    });
    return null;
}

/**
 * Follow the value when it changes from OUTSIDE the map - the operator typing
 * into the latitude field, or a form reset landing new defaults. Panning only
 * when the point moves off screen keeps typing from yanking the view around.
 */
function RecenterOnValue({
    value,
}: {
    value: { lat: number; lng: number } | null;
}) {
    const map = useMap();
    useEffect(() => {
        if (!value) return;
        const point = L.latLng(value.lat, value.lng);
        if (!map.getBounds().contains(point)) {
            map.setView(point, Math.max(map.getZoom(), 13));
        }
    }, [map, value]);
    return null;
}

/** Frame the whole route, so adding a distant stop does not hide it offscreen. */
function FitToRoute({ stops }: { stops: RoutePoint[] }) {
    const map = useMap();
    // Serialised so the effect re-runs on a coordinate change, not on every
    // re-render that rebuilds the array.
    const key = stops.map(p => `${p.lat},${p.lng}`).join('|');

    useEffect(() => {
        if (stops.length < 2) return;
        map.fitBounds(
            L.latLngBounds(stops.map(p => L.latLng(p.lat, p.lng))),
            { padding: [32, 32], maxZoom: 15 },
        );
        // `key` is the real dependency; `stops` is its source.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, key]);

    return null;
}

/** Collapsible sections resize the container; a stale map renders grey. */
function InvalidateOnResize() {
    const map = useMap();
    const frame = useRef<number | undefined>(undefined);

    useEffect(() => {
        const el = map.getContainer();
        const observer = new ResizeObserver(() => {
            // Coalesce: a height animation fires this every frame.
            if (frame.current) cancelAnimationFrame(frame.current);
            frame.current = requestAnimationFrame(() => map.invalidateSize());
        });
        observer.observe(el);
        return () => {
            if (frame.current) cancelAnimationFrame(frame.current);
            observer.disconnect();
        };
    }, [map]);

    return null;
}

const VIEW_MODES: { value: MapViewMode; label: string }[] = [
    { value: 'map', label: 'Map' },
    { value: 'terrain', label: 'Terrain' },
    { value: 'satellite', label: 'Satellite' },
];

/**
 * Base-layer switch, overlaid on the map.
 *
 * It carries its own opaque surface and shadow rather than inheriting the
 * page: on satellite the tiles underneath are photographic, and a transparent
 * control would be unreadable over water one moment and over rooftops the
 * next.
 */
function MapViewToggle({
    value,
    onChange,
}: {
    value: MapViewMode;
    onChange: (next: MapViewMode) => void;
}) {
    return (
        <div
            role='group'
            aria-label='Map style'
            className='inline-flex overflow-hidden rounded-md border border-line bg-surface-overlay shadow-sm'>
            {VIEW_MODES.map(m => (
                <button
                    key={m.value}
                    type='button'
                    aria-pressed={value === m.value}
                    onClick={() => onChange(m.value)}
                    className={cn(
                        'px-2 py-1 text-xs transition-colors duration-fast',
                        'border-r border-line last:border-r-0',
                        value === m.value
                            ? 'bg-primary-subtle font-medium text-primary-subtle-content'
                            : 'text-content-muted hover:bg-surface-sunken/60 hover:text-content',
                    )}>
                    {m.label}
                </button>
            ))}
        </div>
    );
}
