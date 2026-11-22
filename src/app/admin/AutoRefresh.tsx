'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Re-reads the dashboard from the server every 20s while the tab is visible. */
export default function AutoRefresh({ everyMs = 20_000 }: { everyMs?: number }) {
    const router = useRouter();

    useEffect(() => {
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') router.refresh();
        }, everyMs);
        return () => window.clearInterval(timer);
    }, [router, everyMs]);

    return null;
}
