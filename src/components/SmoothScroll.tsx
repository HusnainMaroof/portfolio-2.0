'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ReactLenis, useLenis } from 'lenis/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis driven by GSAP's ticker, so smooth scrolling and every ScrollTrigger
 * read the same scroll position on the same frame. Two separate loops (Lenis's
 * own rAF + ScrollTrigger's) were a frame apart, which showed as a stutter
 * where sticky/scrubbed sections start.
 */
const GsapSync = () => {
    const lenis = useLenis();
    const pathname = usePathname();

    useEffect(() => {
        if (!lenis) return;

        const tick = (time: number) => lenis.raf(time * 1000);
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);

        return () => {
            lenis.off('scroll', ScrollTrigger.update);
            gsap.ticker.remove(tick);
        };
    }, [lenis]);

    // A client-side page change swaps the content without a resize event, so
    // triggers that outlive the page (the footer's, which sits in the layout)
    // kept positions measured on the previous page and could stay hidden.
    // Re-measure once the new page has laid out.
    useEffect(() => {
        let second = 0;
        const first = requestAnimationFrame(() => {
            second = requestAnimationFrame(() => ScrollTrigger.refresh());
        });

        return () => {
            cancelAnimationFrame(first);
            cancelAnimationFrame(second);
        };
    }, [pathname]);

    return null;
};

const SmoothScroll = ({ children }: { children: ReactNode }) => (
    <ReactLenis
        root
        options={{
            autoRaf: false,
            lerp: 0.12,
            wheelMultiplier: 1,
        }}
    >
        <GsapSync />
        {children}
    </ReactLenis>
);

export default SmoothScroll;
