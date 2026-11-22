'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { rate, useRating } from './rating-store';

const LABELS = ['', 'Not for me', 'It is okay', 'Nice', 'Really good', 'Loved it'];

/**
 * Five stars to rate the portfolio, with the live average beside them.
 * Hovering previews a score; the chosen star pops with a small spring.
 * Hidden until the rating loads (and while analytics is not set up).
 */
export default function RatingStars({ className }: { className?: string }) {
    const rating = useRating();
    const [hover, setHover] = useState(0);
    const [popped, setPopped] = useState(0);
    const [thanks, setThanks] = useState(false);

    if (!rating) return null;

    const shown = hover || rating.mine;

    const choose = async (stars: number) => {
        setPopped(stars);
        window.setTimeout(() => setPopped(0), 450);
        if (await rate(stars)) setThanks(true);
    };

    return (
        <div className={cn('flex flex-col items-center gap-2', className)}>
            <div
                role="radiogroup"
                aria-label="Rate this portfolio"
                className="flex items-center gap-1"
                onPointerLeave={() => setHover(0)}
            >
                {[1, 2, 3, 4, 5].map((stars) => {
                    const filled = stars <= shown;
                    return (
                        <button
                            key={stars}
                            type="button"
                            role="radio"
                            aria-checked={rating.mine === stars}
                            aria-label={`${stars} star${stars > 1 ? 's' : ''}: ${LABELS[stars]}`}
                            onPointerEnter={() => setHover(stars)}
                            onFocus={() => setHover(stars)}
                            onBlur={() => setHover(0)}
                            onClick={() => choose(stars)}
                            className="grid size-9 place-items-center rounded-full transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                        >
                            <Star
                                aria-hidden
                                size={22}
                                strokeWidth={1.6}
                                className={cn(
                                    'transition-[color,fill,transform] duration-200',
                                    filled
                                        ? 'fill-primary text-primary'
                                        : 'fill-transparent text-muted-foreground/60',
                                    popped === stars && 'animate-star-pop',
                                )}
                            />
                        </button>
                    );
                })}
            </div>

            <p className="min-h-[1.25rem] text-xs tracking-wide text-muted-foreground" aria-live="polite">
                {hover
                    ? LABELS[hover]
                    : thanks
                      ? `Thanks for rating! Average ${rating.average.toFixed(1)} from ${rating.count}`
                      : rating.count > 0
                        ? `${rating.average.toFixed(1)} average · ${rating.count} rating${rating.count > 1 ? 's' : ''}`
                        : 'Be the first to rate'}
            </p>
        </div>
    );
}
