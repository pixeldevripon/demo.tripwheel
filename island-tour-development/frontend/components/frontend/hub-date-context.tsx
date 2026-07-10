'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

type HubDateContextValue = {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
};

const HubDateContext = createContext<HubDateContextValue | null>(null);

/**
 * Shares one selected date across the hub hero and every trips/charters panel,
 * so a date picked in the hero auto-selects in the panels' date filters (and
 * vice-versa - it is a single source of truth). Wrap the hub page body in this;
 * the hero and panels fall back to their own local date state when rendered
 * outside a provider, so both stay usable standalone.
 */
export function HubDateProvider({ children }: { children: ReactNode }) {
    const [date, setDate] = useState<Date | undefined>(undefined);
    return (
        <HubDateContext.Provider value={{ date, setDate }}>
            {children}
        </HubDateContext.Provider>
    );
}

/** The shared date, or null when there is no provider (component works standalone). */
export function useOptionalHubDate(): HubDateContextValue | null {
    return useContext(HubDateContext);
}
