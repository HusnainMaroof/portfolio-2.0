'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

gsap.registerPlugin(useGSAP);

export default function Template({ children }: { children: React.ReactNode }) {
    const scope = useRef<HTMLDivElement>(null);

    // Scoped to this template's own cover, so a cover left behind by the
    // previous page can't swallow the reveal.
    useGSAP(
        () => {
            gsap.timeline({ defaults: { ease: 'power2.inOut' } })
                .fromTo(
                    '.page-transition--inner',
                    { yPercent: 100 },
                    { yPercent: 0, duration: 0.15 },
                )
                .to('.page-transition--inner', {
                    yPercent: -100,
                    duration: 0.15,
                })
                .to(
                    '.page-transition',
                    { yPercent: -100, duration: 0.35 },
                    '<',
                );
        },
        { scope },
    );

    return (
        <div ref={scope}>
            <div className="page-transition pointer-events-none fixed left-0 top-0 z-[5] h-screen w-screen bg-background-light">
                <div className="page-transition--inner fixed left-0 top-0 z-[5] h-screen w-screen translate-y-full bg-primary"></div>
            </div>

            {children}
        </div>
    );
}
