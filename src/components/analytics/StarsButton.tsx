'use client';

import { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import RatingStars from './RatingStars';
import { useRating } from './rating-store';

/**
 * Star tile beside the theme switch (tablet and up): shows the average and
 * opens a small panel to rate the portfolio. Phones rate from the footer,
 * since the top bar has no room left there.
 */
export default function StarsButton({ className }: { className?: string }) {
    const rating = useRating();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onPointer = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (!rating) return null;

    return (
        <div ref={rootRef} className={cn('relative', className)}>
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label={
                    rating.count > 0
                        ? `Rate this portfolio. Average ${rating.average.toFixed(1)} from ${rating.count} ratings`
                        : 'Rate this portfolio'
                }
                className={cn(
                    'flex h-14 items-center gap-1.5 rounded-[10px] bg-[color-mix(in_oklab,hsl(var(--foreground))_8%,hsl(var(--background)))] px-4 text-sm tabular-nums text-foreground backdrop-blur-md transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    open && 'text-primary',
                )}
            >
                <Star
                    aria-hidden
                    size={18}
                    strokeWidth={1.8}
                    className={cn(rating.mine > 0 && 'fill-primary text-primary')}
                />
                {rating.count > 0 && <span>{rating.average.toFixed(1)}</span>}
            </button>

            <div
                role="dialog"
                aria-label="Rate this portfolio"
                className={cn(
                    'absolute right-0 top-full mt-2 w-64 origin-top-right rounded-2xl border border-border/60 bg-background-light/95 p-4 text-center shadow-[0_16px_40px_-16px_rgba(0,0,0,0.5)] backdrop-blur-md transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
                    open
                        ? 'pointer-events-auto scale-100 opacity-100'
                        : 'pointer-events-none scale-95 opacity-0',
                )}
            >
                <p className="mb-2 text-sm text-foreground">
                    Enjoying the portfolio?
                </p>
                <RatingStars />
            </div>
        </div>
    );
}
