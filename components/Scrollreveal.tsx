'use client';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import React, { useMemo } from 'react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface ScrollRevealProps {
    // Unique id for this instance. Required whenever more than one
    // ScrollReveal is mounted at once — GSAP ScrollTrigger ids must be
    // unique or cleanup/getById calls collide between instances.
    id: string;
    children: string;
    scrollerRef?: React.RefObject<HTMLElement> | string;
    enableBlur?: boolean;
    baseOpacity?: number;
    baseRotation?: number;
    blurStrength?: number;
    containerClassName?: string;
    textClassName?: string;
    rotationEnd?: string;
    wordAnimationEnd?: string;
}

const ScrollReveal = ({
    id,
    children,
    scrollerRef,
    enableBlur = true,
    baseOpacity = 0.1,
    baseRotation = 3,
    blurStrength = 4,
    containerClassName = '',
    textClassName = '',
    rotationEnd = 'bottom center',
    wordAnimationEnd = 'bottom center',
}: ScrollRevealProps) => {
    const container = React.useRef<HTMLHeadingElement>(null);

    const scroller = scrollerRef
        ? typeof scrollerRef === 'string'
            ? scrollerRef
            : scrollerRef.current
        : undefined;

    const splitText = useMemo(() => {
        return children.split(/(\s+)/).map((word, index) => {
            if (word.match(/^\s+$/)) return word;
            return (
                <span className="word" key={index}>
                    {word}
                </span>
            );
        });
    }, [children]);

    useGSAP(
        () => {
            const el = container.current;
            if (!el) return;

            const rotationTrigger = gsap.fromTo(
                el,
                { transformOrigin: '0% 50%', rotate: baseRotation },
                {
                    ease: 'none',
                    rotate: 0,
                    scrollTrigger: {
                        id: `${id}-rotation`,
                        trigger: el,
                        scroller,
                        start: 'top bottom',
                        end: rotationEnd,
                        scrub: 2.5,
                    },
                },
            );

            const words = el.querySelectorAll('.word');

            const opacityTrigger = gsap.fromTo(
                words,
                { opacity: baseOpacity, willChange: 'opacity' },
                {
                    ease: 'none',
                    opacity: 1,
                    stagger: 0.08,
                    scrollTrigger: {
                        id: `${id}-opacity`,
                        trigger: el,
                        scroller,
                        start: 'top bottom+=10%',
                        end: wordAnimationEnd,
                        scrub: 2.5,
                    },
                },
            );

            let blurTrigger: gsap.core.Tween | undefined;
            if (enableBlur) {
                blurTrigger = gsap.fromTo(
                    words,
                    { filter: `blur(${blurStrength}px)` },
                    {
                        ease: 'none',
                        filter: 'blur(0px)',
                        stagger: 0.08,
                        scrollTrigger: {
                            id: `${id}-blur`,
                            trigger: el,
                            scroller,
                            start: 'top bottom+=10%',
                            end: wordAnimationEnd,
                            scrub: 2.5,
                        },
                    },
                );
            }

            return () => {
                rotationTrigger.scrollTrigger?.kill();
                opacityTrigger.scrollTrigger?.kill();
                blurTrigger?.scrollTrigger?.kill();
            };
        },
        {
            scope: container,
            dependencies: [
                id,
                scroller,
                enableBlur,
                baseOpacity,
                baseRotation,
                blurStrength,
                rotationEnd,
                wordAnimationEnd,
            ],
        },
    );

    return (
        <h2 ref={container} className={`scroll-reveal ${containerClassName}`}>
            <p className={`scroll-reveal-text ${textClassName}`}>{splitText}</p>
        </h2>
    );
};

export default ScrollReveal;
