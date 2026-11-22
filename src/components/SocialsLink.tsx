'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { ArrowUpRight } from 'lucide-react';
import TransitionLink from '@/components/TransitionLink';
import { EASE, MOTION_OK } from '@/lib/motion';
import { afterPreloaderStage } from '@/lib/preloader';

/**
 * Bottom-left link to the socials page (LinkedIn, GitHub, resume).
 *
 * It used to live inside the hero, so it shared the hero's stacking layer:
 * the project panels slid over it and it vanished for the whole projects
 * section, then reappeared. Mounted once at the root, it now stays put above
 * every section. Hidden on the socials page itself.
 */
const SocialsLink = () => {
    const pathname = usePathname();
    const ref = useRef<HTMLDivElement>(null);
    const hidden = pathname === '/socials';

    useEffect(() => {
        const el = ref.current;
        if (!el || hidden) return;

        if (!window.matchMedia(MOTION_OK).matches) {
            gsap.set(el, { autoAlpha: 1 });
            return;
        }

        let tween: gsap.core.Tween | null = null;
        // The curtain's first strip (bottom-left) clears about 0.5s in.
        const stop = afterPreloaderStage('reveal', () => {
            tween = gsap.fromTo(
                el,
                { autoAlpha: 0, y: 12 },
                {
                    autoAlpha: 1,
                    y: 0,
                    duration: 0.7,
                    ease: EASE.enter,
                    delay: 0.45,
                },
            );
        });

        return () => {
            stop();
            tween?.kill();
        };
    }, [hidden]);

    if (hidden) return null;

    return (
        <div
            ref={ref}
            className="invisible fixed bottom-5 left-5 z-[45] opacity-0 lg:left-[22px]"
        >
            <TransitionLink
                href="/socials"
                data-avatar="social"
                data-avatar-label="Socials"
                className="inline-flex items-center gap-2 rounded-sm text-sm font-medium uppercase tracking-[0.16em] text-primary underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                Socials
                <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
            </TransitionLink>
        </div>
    );
};

export default SocialsLink;
