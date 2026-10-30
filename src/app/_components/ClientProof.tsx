'use client';

import Image from 'next/image';
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type KeyboardEvent,
    type MouseEvent,
} from 'react';
import { ChevronLeft, ChevronRight, Star, X } from 'lucide-react';
import {
    TESTIMONIAL_SHOTS,
    formatSlideCounter,
    type TestimonialShot,
} from '@/lib/testimonials';
import { cn } from '@/lib/utils';
import { pill } from '@/lib/pill';

/*
 * Client Proof section. Card and control treatment mirrors the project
 * carousel (SelectedWorkCarousel): same framed cards, snap scrolling,
 * and a reserved scroll-controls row at the bottom right.
 */

const CARD_SIZES = '(min-width: 1024px) 20vw, (min-width: 640px) 28vw, 60vw';

const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/* Lightbox                                                            */
/* ------------------------------------------------------------------ */

interface LightboxProps {
    shots: TestimonialShot[];
    index: number;
    onClose: () => void;
    onNavigate: (_nextIndex: number) => void;
}

const Lightbox = ({
    shots,
    index: currentIndex,
    onClose,
    onNavigate,
}: LightboxProps) => {
    const closeRef = useRef<HTMLButtonElement>(null);
    const restoreRef = useRef<HTMLElement | null>(null);
    const shot = shots[currentIndex];

    const handleKeyDown = useCallback(
        (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            } else if (event.key === 'ArrowRight' && shots.length > 1) {
                event.preventDefault();
                onNavigate((currentIndex + 1) % shots.length);
            } else if (event.key === 'ArrowLeft' && shots.length > 1) {
                event.preventDefault();
                onNavigate((currentIndex - 1 + shots.length) % shots.length);
            }
        },
        [currentIndex, onClose, onNavigate, shots.length],
    );

    useEffect(() => {
        restoreRef.current = document.activeElement as HTMLElement | null;
        closeRef.current?.focus();

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
            restoreRef.current?.focus();
        };
    }, [handleKeyDown]);

    if (!shot) return null;

    // Clicks on the backdrop close; clicks on the image must not.
    const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) onClose();
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={`${shot.title} screenshot, full size`}
            onClick={handleBackdropClick}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-background/90 p-6"
        >
            <button
                ref={closeRef}
                type="button"
                aria-label="Close screenshot"
                onClick={onClose}
                className={pill(false, 'absolute right-5 top-5 size-9')}
            >
                <X size={16} aria-hidden="true" />
            </button>

            <figure
                className="flex max-h-full flex-col items-center gap-3"
                onClick={(event) => event.stopPropagation()}
            >
                <Image
                    src={shot.src}
                    alt={shot.alt}
                    width={1600}
                    height={1000}
                    sizes="(min-width: 1024px) 80vw, 100vw"
                    className="max-h-[80vh] w-auto max-w-[90vw] rounded-lg border border-border/50 object-contain"
                />
                <figcaption className="text-xs text-muted-foreground">
                    {shot.title}
                </figcaption>
            </figure>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* Client Proof section                                                */
/* ------------------------------------------------------------------ */

const ClientProof = () => {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [canScroll, setCanScroll] = useState(false);
    const [atStart, setAtStart] = useState(true);
    const [atEnd, setAtEnd] = useState(false);

    // Same sync logic as the project carousel's ScreenshotCarousel.
    const syncControls = useCallback(() => {
        const el = scrollerRef.current;
        if (!el) return;

        const maxScroll = el.scrollWidth - el.clientWidth;

        setCanScroll(maxScroll > 2);
        setAtStart(el.scrollLeft <= 2);
        setAtEnd(el.scrollLeft >= maxScroll - 2);
    }, []);

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;

        syncControls();
        el.addEventListener('scroll', syncControls, { passive: true });
        window.addEventListener('resize', syncControls);

        const observer = new ResizeObserver(syncControls);
        observer.observe(el);

        return () => {
            el.removeEventListener('scroll', syncControls);
            window.removeEventListener('resize', syncControls);
            observer.disconnect();
        };
    }, [syncControls]);

    // One card + one gap per step, measured like the project carousel.
    const scrollByCard = (direction: -1 | 1) => {
        const el = scrollerRef.current;
        if (!el) return;

        const cards = Array.from(
            el.querySelectorAll<HTMLElement>('[data-card]'),
        );
        const step =
            cards.length > 1
                ? cards[1].offsetLeft - cards[0].offsetLeft
                : el.clientWidth;

        el.scrollBy({
            left: direction * step,
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            scrollByCard(-1);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            scrollByCard(1);
        }
    };

    const openLightbox = (index: number) => setLightboxIndex(index);
    const closeLightbox = useCallback(() => setLightboxIndex(null), []);

    return (
        // Same centred page container as every other section, so the panel
        // no longer spills outside the page grid on wide screens.
        <section aria-label="Client proof" className="page-container pb-24 md:pb-32">
            <div className="overflow-hidden rounded-2xl border border-border/50 bg-background-light">
                {/* Header: eyebrow + stars left, action right */}
                <header className="flex flex-col gap-6 px-6 pb-7 pt-7 md:flex-row md:items-center md:justify-between md:gap-6 md:px-9 md:py-8">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                Client proof
                            </span>
                            <span aria-hidden className="h-3 w-px bg-border" />
                            <span
                                className="flex items-center gap-0.5"
                                aria-label="Rated five stars"
                            >
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                        key={i}
                                        size={9}
                                        fill="#e8f52a"
                                        strokeWidth={0}
                                        aria-hidden="true"
                                    />
                                ))}
                            </span>
                        </div>

                        <h2 className="mt-3 text-2xl font-bold leading-tight text-foreground md:text-[26px]">
                            What clients say
                        </h2>

                        <p className="mt-2.5 max-w-[520px] text-sm leading-6 text-muted-foreground">
                            Real feedback from shipped projects. Tap any card
                            to view the full screenshot.
                        </p>
                    </div>

                    <a
                        href="#my-projects"
                        className="shrink-0 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background-light md:self-center"
                    >
                        Browse all testimonials
                    </a>
                </header>

                {/* Divider */}
                <div
                    aria-hidden
                    className="h-px w-full bg-white/10"
                />

                {/* Carousel: same pattern as the project screenshots row,
                    one rounded container around all the cards */}
                <div className="mx-4 mb-9 mt-8 rounded-2xl border border-border/50 bg-background-light/40 p-2.5 sm:p-3 md:mx-6">
                    <div
                        ref={scrollerRef}
                        role="region"
                        aria-roledescription="carousel"
                        aria-label="Client testimonials"
                        tabIndex={0}
                        onKeyDown={handleKeyDown}
                        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                        {TESTIMONIAL_SHOTS.map((shot, index) => (
                            <button
                                key={shot.src}
                                type="button"
                                data-card
                                onClick={() => openLightbox(index)}
                                aria-label={`${shot.alt}, open full screenshot`}
                                className="group w-[60%] shrink-0 snap-start text-left focus-visible:outline-none sm:w-[28%] lg:w-[20%]"
                            >
                                <span className="relative block aspect-[2/3] w-full overflow-hidden rounded-xl">
                                    <Image
                                        src={shot.src}
                                        alt=""
                                        fill
                                        sizes={CARD_SIZES}
                                        className="object-cover transition-opacity duration-300 group-hover:opacity-90"
                                    />
                                </span>

                                <span className="mt-2 flex items-center justify-between px-1.5">
                                    <span className="text-[10px] tabular-nums text-muted-foreground">
                                        {formatSlideCounter(
                                            index + 1,
                                            TESTIMONIAL_SHOTS.length,
                                        )}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground transition-colors duration-200 group-hover:text-foreground">
                                        Tap to view
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Reserved space keeps the layout stable once measurements land,
                        same as the project carousel. */}
                    <div
                        className={cn(
                            'mt-3 flex justify-end gap-2',
                            !canScroll && 'invisible',
                        )}
                    >
                        <button
                            type="button"
                            onClick={() => scrollByCard(-1)}
                            disabled={atStart}
                            aria-label="Scroll testimonials backwards"
                            className={pill(false, 'size-11 lg:size-9')}
                        >
                            <ChevronLeft size={16} aria-hidden="true" />
                        </button>

                        <button
                            type="button"
                            onClick={() => scrollByCard(1)}
                            disabled={atEnd}
                            aria-label="Scroll testimonials forwards"
                            className={pill(false, 'size-11 lg:size-9')}
                        >
                            <ChevronRight size={16} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>

            {lightboxIndex !== null && (
                <Lightbox
                    shots={TESTIMONIAL_SHOTS}
                    index={lightboxIndex}
                    onClose={closeLightbox}
                    onNavigate={setLightboxIndex}
                />
            )}
        </section>
    );
};

export default ClientProof;
