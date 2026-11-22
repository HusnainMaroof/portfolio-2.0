'use client';

import { useEffect, useSyncExternalStore } from 'react';

export interface RatingState {
    average: number;
    count: number;
    /** This visitor's own stars, 0 if they have not rated. */
    mine: number;
}

/**
 * One shared copy of the rating for every widget on the page (the corner
 * button and the footer), so rating in one updates the other at once.
 * `null` = not loaded or analytics not set up yet (widgets stay hidden).
 */
let state: RatingState | null = null;
let loading = false;
const listeners = new Set<() => void>();

const emit = (next: RatingState) => {
    state = next;
    listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const load = async () => {
    if (state || loading) return;
    loading = true;
    try {
        const res = await fetch('/api/rating', { cache: 'no-store' });
        const data = res.ok ? await res.json() : null;
        if (data?.ok) emit({ average: data.average, count: data.count, mine: data.mine });
    } catch {
        // Stays hidden.
    } finally {
        loading = false;
    }
};

/** Sends a rating; the shared state updates for every widget. */
export const rate = async (stars: number) => {
    // Optimistic: the stars fill at once, the averages follow the server.
    if (state) emit({ ...state, mine: stars });
    try {
        const res = await fetch('/api/rating', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stars }),
        });
        const data = res.ok ? await res.json() : null;
        if (data?.ok) emit({ average: data.average, count: data.count, mine: data.mine });
        return Boolean(data?.ok);
    } catch {
        return false;
    }
};

export const useRating = () => {
    useEffect(() => {
        void load();
    }, []);
    return useSyncExternalStore(
        subscribe,
        () => state,
        () => null,
    );
};
