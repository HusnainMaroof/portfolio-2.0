'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/** How often an open, visible tab says "still here". */
const HEARTBEAT_MS = 20_000;

const SOURCE_KEY = 'visit-source';

/**
 * Tracking-link tag: a link like husnain.cc/?ref=acme tells the dashboard
 * who it was sent to. Read once from the landing URL, kept for the rest of
 * the visit, and removed from the address bar so a copied link stays clean.
 */
const readSource = () => {
    const url = new URL(window.location.href);
    const tag = url.searchParams.get('ref') ?? url.searchParams.get('utm_source');

    if (tag) {
        const clean = tag.trim().slice(0, 60);
        try {
            sessionStorage.setItem(SOURCE_KEY, clean);
        } catch {
            // Private mode: still sent for this page.
        }
        url.searchParams.delete('ref');
        url.searchParams.delete('utm_source');
        window.history.replaceState(window.history.state, '', url.toString());
        return clean;
    }

    try {
        return sessionStorage.getItem(SOURCE_KEY);
    } catch {
        return null;
    }
};

/**
 * Records each page view and keeps the visitor in the live count while the
 * tab is open. Renders nothing. The admin page itself is never tracked.
 */
export default function VisitTracker() {
    const pathname = usePathname();
    const firstView = useRef(true);

    useEffect(() => {
        if (pathname.startsWith('/admin')) return;

        let visitId: string | null = null;
        let active = true;
        // The outside referrer only belongs to the first page of the visit.
        const referrer = firstView.current ? document.referrer : '';
        firstView.current = false;

        fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: pathname, referrer, source: readSource() }),
            keepalive: true,
        })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (active && typeof data?.visitId === 'string') {
                    visitId = data.visitId;
                }
            })
            .catch(() => {});

        const beat = (leaving = false) => {
            const body = JSON.stringify({ visitId, path: pathname });
            // A closing tab can't wait for fetch; a beacon still gets out.
            if (leaving && navigator.sendBeacon) {
                navigator.sendBeacon('/api/heartbeat', body);
                return;
            }
            fetch('/api/heartbeat', { method: 'POST', body, keepalive: true }).catch(
                () => {},
            );
        };

        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') beat();
        }, HEARTBEAT_MS);
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') beat(true);
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            active = false;
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibility);
            // Leaving this page: record its final time-on-page.
            if (visitId) beat(true);
        };
    }, [pathname]);

    return null;
}
