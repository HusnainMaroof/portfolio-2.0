import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/*
 * The site's motion language, in one place.
 *
 * - Smooth beats bouncy: entrances settle on `power3.out` (or a near
 *   critically damped spring), never a cartoon overshoot.
 * - Three energies only: calm (`sine.inOut`) for ambient motion, standard
 *   (`power3.out`) for entrances, punch (`expo.out`) for hero moments.
 * - Exits are quicker than entrances and ease *in*.
 * - Only transforms and opacity move, so nothing triggers layout.
 * - A stagger never adds more than ~0.5s to a group, however long the list.
 */

export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

export const EASE = {
    calm: 'sine.inOut',
    enter: 'power3.out',
    punch: 'expo.out',
    exit: 'power2.in',
} as const;

export const DUR = {
    fast: 0.2,
    base: 0.6,
    slow: 0.9,
} as const;

/** Per-item stagger for a group of `count`, capped so the group takes <= `cap`s. */
export const cappedStagger = (count: number, each = 0.06, cap = 0.5) =>
    count > 1 ? Math.min(each, cap / (count - 1)) : 0;

/**
 * A damped spring's exact position curve as a GSAP ease, plus the duration it
 * needs to settle (use both). `dampingFraction` 1 = no overshoot; 0.8 is the
 * "alive, not bouncy" register (about 1% overshoot, felt rather than seen).
 */
export const springEase = ({
    response = 0.5,
    dampingFraction = 1,
}: { response?: number; dampingFraction?: number } = {}) => {
    const w = (2 * Math.PI) / response;
    const z = dampingFraction;
    // Under-damped, over-damped and critically damped closed forms.
    const wd = w * Math.sqrt(Math.abs(1 - z * z));
    const pos = (t: number) =>
        z < 1
            ? 1 -
              Math.exp(-z * w * t) *
                  (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t))
            : z > 1
              ? 1 -
                Math.exp(-z * w * t) *
                    (Math.cosh(wd * t) + ((z * w) / wd) * Math.sinh(wd * t))
              : 1 - Math.exp(-w * t) * (1 + w * t);

    // Settle time: the last moment the curve sits outside +-0.1% of target.
    const rate = z <= 1 ? z * w : (z - Math.sqrt(z * z - 1)) * w;
    const scan = 12 / rate;
    const steps = 2400;
    let settle = scan;
    for (let i = steps; i >= 0; i--) {
        const t = (i / steps) * scan;
        if (Math.abs(1 - pos(t)) > 0.001) {
            settle = ((i + 1) / steps) * scan;
            break;
        }
    }
    const end = pos(settle);

    return {
        duration: settle,
        ease: (p: number) => pos(p * settle) + p * (1 - end),
    };
};

/** Small UI landing (chips, the avatar): quick, about 1% overshoot. */
export const SPRING_UI = springEase({ response: 0.42, dampingFraction: 0.8 });

/**
 * Reveal-on-enter for a group of elements: each rises 24px and fades in once,
 * the first time it scrolls into view. Elements entering together share a
 * capped stagger. Content is never dimmed while it is on screen and never
 * fades back out, so it stays readable.
 *
 * Call inside a useGSAP / gsap.context so it reverts on unmount. With reduced
 * motion nothing is hidden or moved.
 */
export const revealOnEnter = (
    targets: string | Element[],
    {
        start = 'top 88%',
        y = 24,
        each = 0.06,
    }: { start?: string; y?: number; each?: number } = {},
) => {
    if (!window.matchMedia(MOTION_OK).matches) return;

    const elements = gsap.utils.toArray<HTMLElement>(targets);
    if (!elements.length) return;

    gsap.set(elements, { autoAlpha: 0, y });

    ScrollTrigger.batch(elements, {
        start,
        once: true,
        onEnter: (batch) =>
            gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                duration: DUR.slow,
                ease: EASE.enter,
                stagger: cappedStagger(batch.length, each),
                overwrite: true,
                // Hand the element back to the stylesheet once it has landed.
                clearProps: 'transform,visibility',
            }),
    });
};
