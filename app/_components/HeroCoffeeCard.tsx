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
        <div className="pointer-events-none absolute right-0 top-0 z-10 hidden md:block lg:right-4">
            <a
                href={HERO.coffee.href}
                target="_blank"
                rel="noopener noreferrer"
                className="sr-only focus:not-sr-only"
            >
                {HERO.coffee.label}
            </a>
            <div data-avatar-dock-keepout="" className="pointer-events-auto h-[280px] w-[170px] lg:h-[330px] lg:w-[200px] xl:h-[380px] xl:w-[230px]">
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
