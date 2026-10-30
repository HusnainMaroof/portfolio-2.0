'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { HERO } from '@/content/hero';

// three.js is heavy; load it only on the client, after the hero paints.
const Lanyard = dynamic(() => import('@/components/Lanyard'), { ssr: false });

/**
 * three.js is ~600KB and WebGL setup blocks the main thread, so the card waits
 * until the preloader and hero entrance have finished, then for an idle moment.
 * Phones never load it: the card is hidden below 768px.
 */
const MOUNT_DELAY_MS = 3000;

const useDeferredMount = () => {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!window.matchMedia('(min-width: 768px)').matches) return;

        let idle = 0;
        const timer = window.setTimeout(() => {
            if ('requestIdleCallback' in window) {
                idle = window.requestIdleCallback(() => setReady(true), {
                    timeout: 1500,
                });
            } else {
                setReady(true);
            }
        }, MOUNT_DELAY_MS);

        return () => {
            window.clearTimeout(timer);
            if (idle) window.cancelIdleCallback(idle);
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
            <div data-avatar-dock-keepout="" className="pointer-events-none h-[280px] w-[640px] lg:h-[330px] lg:w-[720px] xl:h-[380px] xl:w-[800px]">
                {ready && (
                    <Lanyard
                        frontImage="/coffee/front.svg"
                        backImage="/coffee/back.svg"
                        cardColor="#00F050"
                        strapColor="#00F050"
                        metal="silver"
                        finish="glossy"
                        size={0.42}
                        strapLength={0.45}
                        breeze={0.3}
                        onCardClick={openCoffee}
                    />
                )}
            </div>
        </div>
    );
};

export default HeroCoffeeCard;
