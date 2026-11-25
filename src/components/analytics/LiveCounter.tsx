'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const REFRESH_MS = 20_000;

const formatter = new Intl.NumberFormat('en');

/**
 * "● 3 online now · 1,204 visitors": refreshed every 20s while the tab is
 * visible. Hidden until the first answer arrives (and while analytics is not
 * set up), so it never shows a zero or a placeholder.
 */
export default function LiveCounter({ className }: { className?: string }) {
    const [live, setLive] = useState<{ online: number; visits: number } | null>(
        null,
    );

    useEffect(() => {
        let alive = true;
        const load = async () => {
            if (document.visibilityState !== 'visible') return;
            try {
                const res = await fetch('/api/live', { cache: 'no-store' });
                const data = res.ok ? await res.json() : null;
                if (alive && data?.ok) setLive({ online: data.online, visits: data.visits });
            } catch {
                // Keeps the last value (or stays hidden).
            }
        };
        void load();
        const timer = window.setInterval(load, REFRESH_MS);
        document.addEventListener('visibilitychange', load);
        return () => {
            alive = false;
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', load);
        };
    }, []);

    if (!live) return null;

    return (
        <p
            className={cn(
                'inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground',
                className,
            )}
            aria-live="polite"
        >
            <span className="relative flex size-2" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            <span className="tabular-nums">
                {formatter.format(live.online)} online now
            </span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
                {formatter.format(live.visits)} visitors
            </span>
        </p>
    );
}
