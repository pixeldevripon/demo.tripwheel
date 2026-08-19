'use client';

import { useEffect, useState } from 'react';

// Custom hook for managing visible sections with localStorage persistence
export function useVisibleSections(storageKey = 'dashboard-visible-sections') {
    const [visibleSections, setVisibleSections] = useState(() => {
        // Initialize from localStorage if available
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem(storageKey);
                if (stored) {
                    return JSON.parse(stored);
                }
            } catch (error) {
                console.error('Error reading from localStorage:', error);
            }
        }
        // Default state
        return {
            'quick-setup': false,
            'statistics': true,
            'recent-activity': true,
            'matrics': true,
        };
    });

    // Persist to localStorage whenever state changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(
                    storageKey,
                    JSON.stringify(visibleSections)
                );
            } catch (error) {
                console.error('Error writing to localStorage:', error);
            }
        }
    }, [visibleSections, storageKey]);

    return [visibleSections, setVisibleSections] as const;
}
