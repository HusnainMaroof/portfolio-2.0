'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useLenis } from 'lenis/react';
import { PROJECTS } from '@/lib/data';
import { padIndex } from '@/lib/projects';
import { STACK_QUERY } from '@/lib/stack';
import { ProjectShowcase } from './SelectedWorkCarousel';

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Intro copy reuses the site's own wording; it stays because the header needs
// a supporting line under the heading.
const INTRO_COPY =
    "I'm a full-stack developer focused on building fast, polished web experiences, from pixel-level scroll animation to production-grade data-driven apps.";

/** Scroll distance (in screen heights) spent on each project change. */
const SCREENS_PER_PROJECT = 0.8;

/** Wheel: snap this long after the last wheel event. */
const WHEEL_IDLE_MS = 140;
/** Touch: snap this long after the finger lifts and momentum scrolling stops. */
const TOUCH_IDLE_MS = 160;
const SNAP_DURATION = 0.9;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/*
 * Same idea as the Pizza Way story. In stacked mode (STACK_QUERY: any width,
 * motion allowed, screen at least 500px tall) the stage sticks for the length
 * of the section while ONE scrubbed timeline plays: the "Projects" header stays
 * pinned and every next project slides up over the previous one, which sinks
 * back and dims. A small scroll is enough: when input pauses between two stops
 * the page glides on to the next stop in that direction.
 *
 * Each panel's content is scaled down (never up) to fit its screen, so short
 * phones and short laptops never clip a project.
 *
 * Outside stacked mode (reduced motion, a phone held sideways) the header and
 * projects simply flow.
 */
const SelectedWork = () => {
    const sectionRef = useRef<HTMLElement>(null);
    const digitsRef = useRef<HTMLSpanElement>(null);
    const progressRef = useRef<HTMLSpanElement>(null);
    const total = PROJECTS.length;
    // Lenis arrives a render after mount; the effect re-runs when it does.
    const lenis = useLenis();

    useGSAP(
        () => {
            const section = sectionRef.current;
            if (!section || total < 2) return;

            const mm = gsap.matchMedia();

            mm.add(STACK_QUERY, () => {
                const panels = gsap.utils.toArray<HTMLElement>(
                    '[data-project-panel]',
                    section,
                );
                const fits = panels.map(
                    (panel) => panel.querySelector<HTMLElement>('[data-fit]')!,
                );

                // ---- Fit: scale each project down to its panel's height ----
                const applyFit = () =>
                    panels.forEach((panel, i) => {
                        const style = getComputedStyle(panel);
                        const room =
                            panel.clientHeight -
                            parseFloat(style.paddingTop) -
                            parseFloat(style.paddingBottom);
                        // offsetHeight ignores transforms: the unscaled height.
                        const height = fits[i].offsetHeight;
                        const scale =
                            height > 0 ? Math.min(1, room / height) : 1;
                        gsap.set(fits[i], {
                            scale,
                            transformOrigin: '50% 50%',
                        });
                    });

                applyFit();
                // Fonts, a resize or a rotated phone change the heights.
                const fitObserver = new ResizeObserver(applyFit);
                fits.forEach((el) => fitObserver.observe(el));
                fitObserver.observe(panels[0]);

                // ---- Hero: sinks back and dims as Projects slides over it ----
                // The same depth cue the projects use on each other, so the
                // first hand-over reads like the rest of the stack.
                const hero = document.getElementById('banner');
                if (hero) {
                    gsap.fromTo(
                        hero,
                        { scale: 1, opacity: 1 },
                        {
                            scale: 0.94,
                            opacity: 0.35,
                            ease: 'none',
                            transformOrigin: '50% 35%',
                            immediateRender: false,
                            scrollTrigger: {
                                trigger: section,
                                start: 'top bottom',
                                end: 'top top',
                                scrub: true,
                            },
                        },
                    );
                }

                // ---- Stack: each project slides up over the previous ----
                gsap.set(panels.slice(1), { yPercent: 100 });

                let shownIndex = 0;
                const tl = gsap.timeline({
                    defaults: { ease: 'none' },
                    scrollTrigger: {
                        trigger: section,
                        start: 'top top',
                        end: 'bottom bottom',
                        // Lenis already smooths the scroll.
                        scrub: true,
                        invalidateOnRefresh: true,
                        onUpdate: (self) => {
                            // Progress line: one segment per project.
                            if (progressRef.current) {
                                progressRef.current.style.transform = `scaleX(${(self.progress * (total - 1) + 1) / total})`;
                            }

                            const index = Math.min(
                                total - 1,
                                Math.round(self.progress * (total - 1)),
                            );
                            if (index !== shownIndex && digitsRef.current) {
                                shownIndex = index;
                                // The counter rolls like a ticker to the new number.
                                digitsRef.current.style.transform = `translateY(-${index}em)`;
                            }
                        },
                    },
                });

                panels.forEach((panel, i) => {
                    if (i === 0) return;

                    tl.to(
                        panel,
                        { yPercent: 0, duration: 1, ease: 'power2.inOut' },
                        i - 1,
                    ).to(
                        panels[i - 1],
                        { scale: 0.94, opacity: 0.35, duration: 1 },
                        i - 1,
                    );
                });

                // ---- Directional snap ----
                const st = tl.scrollTrigger!;

                /** Hero, Projects header + first project, then each project. */
                const stops = () => {
                    const span = st.end - st.start;
                    // A hero only slightly taller than the screen still counts
                    // as "the top"; a much taller one (phones) is read freely
                    // until its bottom edge reaches the screen bottom.
                    const heroOverflow = Math.max(
                        0,
                        st.start - window.innerHeight,
                    );
                    const heroStop =
                        heroOverflow < window.innerHeight * 0.25
                            ? 0
                            : heroOverflow;

                    return [
                        heroStop,
                        ...panels.map(
                            (_, k) => st.start + (span * k) / (total - 1),
                        ),
                    ];
                };

                let timer: ReturnType<typeof setTimeout> | undefined;
                let snapping = false;
                let touching = false;
                let usingTouch = false;
                let direction = 1;
                let lastY = window.scrollY;

                const settle = (at: number) => {
                    if (!lenis || touching) return;

                    const points = stops();
                    const next = points.findIndex((p) => p > at + 2);
                    // Above the first stop, past the last one, or exactly on a
                    // stop: leave the scroll alone.
                    if (next <= 0) return;
                    const prev = points[next - 1];
                    if (at - prev < 2) return;

                    snapping = true;
                    lenis.scrollTo(direction > 0 ? points[next] : prev, {
                        duration: SNAP_DURATION,
                        easing: easeOutCubic,
                        onComplete: () => {
                            snapping = false;
                        },
                    });
                };

                // Wheel / trackpad (through Lenis).
                const onVirtualScroll = ({
                    deltaY,
                    event,
                }: {
                    deltaY: number;
                    event: Event;
                }) => {
                    if (event.type.startsWith('touch')) return;
                    usingTouch = false;
                    snapping = false;
                    if (deltaY) direction = Math.sign(deltaY);
                    clearTimeout(timer);
                    timer = setTimeout(
                        () => settle(lenis?.targetScroll ?? window.scrollY),
                        WHEEL_IDLE_MS,
                    );
                };

                // Touch: native scroll with momentum. Wait for the finger to
                // lift and the momentum to die out, then snap.
                const onTouchStart = () => {
                    usingTouch = true;
                    touching = true;
                    clearTimeout(timer);
                    if (snapping) {
                        // The visitor grabbed the page mid-glide: let go of it.
                        lenis?.scrollTo(window.scrollY, { immediate: true });
                        snapping = false;
                    }
                };
                const armTouch = () => {
                    clearTimeout(timer);
                    timer = setTimeout(
                        () => settle(window.scrollY),
                        TOUCH_IDLE_MS,
                    );
                };
                const onTouchEnd = () => {
                    touching = false;
                    armTouch();
                };
                const onScroll = () => {
                    const y = window.scrollY;
                    if (y !== lastY) {
                        if (usingTouch && !snapping) {
                            direction = Math.sign(y - lastY);
                        }
                        lastY = y;
                    }
                    if (usingTouch && !touching && !snapping) armTouch();
                };

                lenis?.on('virtual-scroll', onVirtualScroll);
                window.addEventListener('touchstart', onTouchStart, {
                    passive: true,
                });
                window.addEventListener('touchend', onTouchEnd, {
                    passive: true,
                });
                window.addEventListener('touchcancel', onTouchEnd, {
                    passive: true,
                });
                window.addEventListener('scroll', onScroll, { passive: true });

                return () => {
                    clearTimeout(timer);
                    fitObserver.disconnect();
                    gsap.set(fits, { clearProps: 'transform' });
                    lenis?.off('virtual-scroll', onVirtualScroll);
                    window.removeEventListener('touchstart', onTouchStart);
                    window.removeEventListener('touchend', onTouchEnd);
                    window.removeEventListener('touchcancel', onTouchEnd);
                    window.removeEventListener('scroll', onScroll);
                };
            });

            return () => mm.revert();
        },
        { scope: sectionRef, dependencies: [total, lenis] },
    );

    return (
        <section
            id="my-projects"
            ref={sectionRef}
            style={
                {
                    '--stack-h': `calc(100svh + ${(total - 1) * SCREENS_PER_PROJECT * 100}svh)`,
                } as React.CSSProperties
            }
            className="work-stack relative z-10 bg-background"
        >
            <div className="work-stage">
                {/* Pinned while the projects change beneath it. Top padding
                    clears the fixed site nav. */}
                <header className="page-container relative z-20 shrink-0 bg-background pb-4 pt-[92px] md:pb-5 md:pt-24">
                    <div className="flex items-end justify-between gap-6 md:gap-10">
                        <div className="min-w-0">
                            <h2 className="font-anton text-3xl leading-none text-foreground sm:text-4xl md:text-6xl">
                                Projects
                            </h2>

                            <p className="work-intro mt-3 max-w-[560px] text-sm leading-relaxed text-muted-foreground/70 md:mt-4">
                                {INTRO_COPY}
                            </p>
                        </div>

                        {/* Ticker: a column of numbers behind a one-line
                            window; the column slides to the current one. */}
                        <span
                            aria-hidden
                            className="work-counter shrink-0 text-[11px] uppercase leading-none tabular-nums tracking-[0.18em] text-muted-foreground"
                        >
                            <span className="relative inline-block h-[1em] overflow-hidden align-top text-foreground">
                                <span
                                    ref={digitsRef}
                                    className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                                >
                                    {PROJECTS.map((project, i) => (
                                        <span
                                            key={project.slug}
                                            className="block h-[1em]"
                                        >
                                            {padIndex(i + 1)}
                                        </span>
                                    ))}
                                </span>
                            </span>
                            {` / ${padIndex(total)}`}
                        </span>
                    </div>

                    {/* Progress through the projects, one segment each. */}
                    <span aria-hidden className="work-progress">
                        <span ref={progressRef} />
                    </span>
                </header>

                <div className="work-panels">
                    {PROJECTS.map((project, index) => (
                        <div
                            key={project.slug}
                            data-project-panel
                            style={{ zIndex: index + 1 }}
                            className="work-panel"
                        >
                            <div data-fit className="page-container w-full">
                                <ProjectShowcase
                                    project={project}
                                    index={index}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default SelectedWork;
