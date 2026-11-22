'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { HERO } from '@/content/hero';
import { useTheme } from '@/components/ThemeProvider';
import { afterPreloaderStage } from '@/lib/preloader';

const loadLanyard = () => import('@/components/Lanyard');
// three.js is heavy; client only, never in the server render.
const Lanyard = dynamic(loadLanyard, { ssr: false });

/**
 * three.js is ~600KB. The download starts at once, while the preloader still
 * covers the page. The card used to mount only when the preloader had fully
 * finished, then compile its shaders and load its art, so it appeared a beat
 * after the hero was already on screen.
 *
 * Now it mounts during the preloader's hold (the name has landed and the
 * curtain stays closed for a second), so WebGL setup happens out of sight
 * without competing with any animation, and its swing-in is released the
 * moment the curtain starts to lift: it swings in as it is uncovered.
 * Phones never load it: the card is hidden below 768px.
 */
const useDeferredMount = () => {
    const [mounted, setMounted] = useState(false);
    const [released, setReleased] = useState(false);

    useEffect(() => {
        if (!window.matchMedia('(min-width: 768px)').matches) return;

        void loadLanyard();

        const stopMount = afterPreloaderStage('hold', () => setMounted(true));
        const stopRelease = afterPreloaderStage('reveal', () =>
            setReleased(true),
        );

        return () => {
            stopMount();
            stopRelease();
        };
    }, []);

    return { mounted, released };
};

/** The card's colours per theme: neon on black, a deeper emerald on white. */
const CARD = {
    dark: {
        front: '/coffee/front.svg',
        back: '/coffee/back.svg',
        color: '#00F050',
    },
    light: {
        front: '/coffee/front-light.svg',
        back: '/coffee/back-light.svg',
        color: '#0E8147',
    },
} as const;

const openCoffee = () =>
    window.open(HERO.coffee.href, '_blank', 'noopener,noreferrer');

/**
 * A 3D card on a lanyard hanging from the top of the hero. Dragging swings it
 * and a tap opens the coffee page. The canvas is invisible to screen readers
 * and keyboards, so a hidden link carries the same target.
 */
const HeroCoffeeCard = () => {
    const { mounted, released } = useDeferredMount();
    const { theme } = useTheme();
    const card = CARD[theme];

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
                {mounted && (
                    <Lanyard
                        paused={!released}
                        frontImage={card.front}
                        backImage={card.back}
                        cardColor={card.color}
                        strapColor={card.color}
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
