'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { HERO } from '@/content/hero';

const loadLanyard = () => import('@/components/Lanyard');
// three.js is heavy; client only, never in the server render.
const Lanyard = dynamic(loadLanyard, { ssr: false });

/** Safety net if the preloader never reports (it unmounted early, an error). */
const FALLBACK_MS = 4500;

/**
 * three.js is ~600KB, so the card used to wait a fixed 3s plus an idle slot
 * (up to 4.5s) before even downloading it, and appeared well after the page
 * was uncovered. Now the download starts at once, while the preloader still
 * covers the page, and the card mounts the moment the preloader finishes, so
 * it swings in as the hero is revealed. WebGL setup still waits for that
 * moment, so it never competes with the preloader animation.
 * Phones never load it: the card is hidden below 768px.
 */
const useDeferredMount = () => {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!window.matchMedia('(min-width: 768px)').matches) return;

        void loadLanyard();

        if (document.documentElement.dataset.preloaded === 'true') {
            setReady(true);
            return;
        }

        const show = () => setReady(true);
        window.addEventListener('preloader:done', show, { once: true });
        const timer = window.setTimeout(show, FALLBACK_MS);

        return () => {
            window.removeEventListener('preloader:done', show);
            window.clearTimeout(timer);
        };
    }, []);

    return ready;
};

const openCoffee = () =>
    window.open(HERO.coffee.href, '_blank', 'noopener,noreferrer');

/**
 * A 3D card on a lanyard hanging from the top of the hero. Dragging swings it
 * and a tap opens the coffee page. The canvas is invisible to screen readers
 * and keyboards, so a hidden link carries the same target.
 */
const HeroCoffeeCard = () => {
    const ready = useDeferredMount();

    return (
        // The canvas is far wider than the card so a swing never runs off its
        // edge (a narrow canvas clipped the strap and card mid-swing). Width
        // only: the camera frames to the canvas height, so the card keeps its
        // size. The strap hangs from the canvas centre, so each breakpoint
        // shifts the box left by half its width to pin that centre: 96px from
        // the left on md, 128px on lg, 160px on xl.
        <div className="pointer-events-none absolute top-0 z-10 hidden md:block md:left-[-224px] lg:left-[-232px] xl:left-[-240px]">
            <a
                href={HERO.coffee.href}
                target="_blank"
                rel="noopener noreferrer"
                className="sr-only focus:not-sr-only"
            >
                {HERO.coffee.label}
            </a>
            {/* Lanyard switches the canvas itself on while the pointer is over the card. */}
            <div data-avatar-dock-keepout="" className="pointer-events-none h-[380px] w-[640px] lg:h-[450px] lg:w-[720px] xl:h-[520px] xl:w-[800px]">
                {ready && (
                    <Lanyard
                        frontImage="/coffee/front.svg"
                        backImage="/coffee/back.svg"
                        cardColor="#00F050"
                        strapColor="#00F050"
                        metal="silver"
                        finish="glossy"
                        // The card is a share of the canvas height, so the
                        // taller canvas (for a longer strap) takes a smaller
                        // share to keep the card itself the same size.
                        size={0.31}
                        strapLength={1}
                        breeze={0.3}
                        onCardClick={openCoffee}
                    />
                )}
            </div>
        </div>
    );
};

export default HeroCoffeeCard;
