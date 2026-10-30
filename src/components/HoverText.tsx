'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

if (typeof window !== 'undefined') {
    gsap.registerPlugin(SplitText);
}

export interface BoldHoverTextProps {
    /** the word or phrase to display, e.g. "hello" */
    text: string;
    /** resting letter color */
    color?: string;
    /** color a letter tweens to while hovered, defaults to `color` if omitted */
    hoverColor?: string;
    /** extra classes, e.g. "hero-word inline-block" to match sibling words */
    className?: string;
    /** never a heading tag. This sits inside your own <h1> */
    as?: 'span' | 'div' | 'p';
    /**
     * needs a variable font with a wght axis (e.g. Fraunces, Inter).
     * Omit only if the inherited parent font already has one, a fixed-weight
     * font like Anton has nothing for this to animate.
     */
    fontFamily?: string;
    baseWeight?: number;
    hoverWeight?: number;
    baseTracking?: string;
    hoverTracking?: string;
    /** seconds for the weight/tracking/color tween */
    duration?: number;
}

export default function BoldHoverText({
    text,
    color = 'inherit',
    hoverColor,
    className,
    as = 'span',
    fontFamily,
    baseWeight = 100,
    hoverWeight = 700,
    baseTracking = '-0.02em',
    hoverTracking = '0em',
    duration = 0.5,
}: BoldHoverTextProps) {
    const containerRef = useRef<HTMLElement>(null);
    const Tag = as as any;
    const targetHoverColor = hoverColor || color;

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const split = SplitText.create(el, { type: 'chars' });
        const cleanupFns: (() => void)[] = [];

        split.chars.forEach((charEl) => {
            const c = charEl as HTMLElement;
            let tween: gsap.core.Tween | null = null;

            c.style.display = 'inline-block';
            c.style.setProperty('--wght', String(baseWeight));
            c.style.fontVariationSettings = "'wght' var(--wght)";
            c.style.letterSpacing = baseTracking;
            c.style.color = color;
            if (fontFamily) c.style.fontFamily = fontFamily;

            // Standard hover in/out: bold+colored while hovered, reverts the
            // instant the pointer leaves; no persistent per-letter state.
            const onEnter = () => {
                tween?.kill();
                tween = gsap.to(c, {
                    '--wght': hoverWeight,
                    letterSpacing: hoverTracking,
                    color: targetHoverColor,
                    duration,
                    ease: 'power3.out',
                } as gsap.TweenVars);
            };

            const onLeave = () => {
                tween?.kill();
                tween = gsap.to(c, {
                    '--wght': baseWeight,
                    letterSpacing: baseTracking,
                    color,
                    duration,
                    ease: 'power3.out',
                } as gsap.TweenVars);
            };

            c.addEventListener('mouseenter', onEnter);
            c.addEventListener('mouseleave', onLeave);
            cleanupFns.push(() => {
                c.removeEventListener('mouseenter', onEnter);
                c.removeEventListener('mouseleave', onLeave);
            });
        });

        return () => {
            cleanupFns.forEach((fn) => fn());
            split.revert();
        };
    }, [
        text,
        fontFamily,
        baseWeight,
        hoverWeight,
        baseTracking,
        hoverTracking,
        color,
        targetHoverColor,
        duration,
    ]);

    return (
        <Tag
            ref={containerRef}
            className={className}
            style={{
                display: 'inline-block',
                fontFamily: fontFamily || 'inherit',
                fontSize: 'inherit',
                letterSpacing: 'inherit',
                color,
                // no `cursor: 'default'`; an inline cursor beats the global
                // `cursor: none` and flashes the native cursor over the custom one.
            }}
        >
            {text}
        </Tag>
    );
}