'use client';

import { createContext, useContext } from 'react';
import type { WholeUnitType } from '@/types/trip';

/**
 * Per-tour display metadata for the global calendar's departure chips: the
 * island zone (one-clock audit timestamps, MCK-16 change 4) and the
 * whole-unit noun ("Whole boat", change 11). A context rather than a third
 * threaded map - operatorNameById already rides through three components,
 * and every chip needs this regardless of which surface renders it. Radix
 * portals keep React context, so popover-rendered chips resolve it too.
 */
export interface CalendarTourMeta {
    timeZone?: string;
    wholeUnitType?: WholeUnitType | null;
}

const CalendarTourMetaContext = createContext<
    ReadonlyMap<string, CalendarTourMeta>
>(new Map());

export const CalendarTourMetaProvider = CalendarTourMetaContext.Provider;

export function useCalendarTourMeta(tourId: string): CalendarTourMeta {
    return useContext(CalendarTourMetaContext).get(tourId) ?? {};
}
