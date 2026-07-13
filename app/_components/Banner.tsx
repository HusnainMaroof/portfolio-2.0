'use client';
import ArrowAnimation from '@/components/ArrowAnimation';
import Button from '@/components/Button';
import BoldHoverText from '@/components/HoverText';
import { GENERAL_INFO } from '@/lib/data';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import { useRef } from 'react';
import { useTheme } from '@/components/ThemeProvider';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const Banner = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();
    const heroTextColor = theme === 'light' ? '#111111' : '#DEDEDE';
    const heroAccentColor = theme === 'light' ? '#111111' : '#00F050';

    useGSAP(
        () => {
            // entrance: word-by-word reveal on mount, plays once
            gsap.from('.hero-word', {
                yPercent: 210,
                stagger: 0.08,
                duration: 6,
                ease: 'power4.out',
                delay: 0.15,
            });

            // existing scroll-out fade, untouched logic
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: 'bottom 70%',
                    end: 'bottom 10%',
                    scrub: 1,
                },
            });

            tl.fromTo(
                '.slide-up-and-fade',
                { y: 0 },
                { y: -150, opacity: 0, stagger: 0.02 },
            );
        },
        { scope: containerRef },
    );

    return (
        <section className="relative overflow-hidden" id="banner">
            <ArrowAnimation />
            <div
                className="container relative h-[100svh] min-h-[600px] flex flex-col justify-center items-center text-center"
                ref={containerRef}
            >
                {/* nameplate pill */}
                <div className="slide-up-and-fade text-start   mb-10">
                    <span className="text-sm font-medium text-foreground">
                        Hey there, I&apos;m{' '}
                        <span className="text-primary">Husnain</span>
                    </span>
                </div>

                {/* headline — each word masked + revealed independently */}
                <h1 className="slide-up-and-fade leading-[.9] text-[clamp(2.5rem,12vw,120px)] font-anton">
                    <span className="flex flex-wrap justify-center gap-x-4 md:gap-x-6 pb-10">
                        <span className="overflow-hidden inline-block  -mb-2">
                            <BoldHoverText
                                text="Full"
                                className="hero-word inline-block uppercase"
                                fontFamily="'Fraunces', serif"
                                baseWeight={300}
                                hoverWeight={900}
                                color={heroTextColor}
                                hoverColor={heroAccentColor}
                            />
                        </span>
                        <span className="overflow-hidden inline-block pb-2 -mb-2">
                            <BoldHoverText
                                text="Stack"
                                className="hero-word inline-block uppercase"
                                fontFamily="'Fraunces', serif"
                                baseWeight={300}
                                hoverWeight={900}
                                color={heroTextColor}
                                hoverColor={heroTextColor}
                            />
                        </span>
                    </span>
                    <span className="flex flex-wrap justify-center">
                        <span className="overflow-hidden inline-block pb-2 -mb-2">
                            <BoldHoverText
                                text="Developer"
                                className="hero-word inline-block uppercase"
                                fontFamily="'Fraunces', serif"
                                baseWeight={300}
                                hoverWeight={900}
                                color={heroTextColor}
                                hoverColor={heroTextColor}
                            />
                        </span>
                    </span>
                </h1>

                {/* bottom-left: availability */}
                <div className="slide-up-and-fade absolute bottom-8 left-6 md:left-10  items-center gap-2 hidden md:flex">
                    <span className="size-3 rounded-full bg-primary" />
                    <span className="text-sm text-muted-foreground">
                        Available for full-time opportunities
                    </span>
                </div>

                {/* bottom-right: CTA in the corner */}
                <div className="slide-up-and-fade absolute bottom-8 right-6 md:right-10 rounded-sm bg-background/80 backdrop-blur-md px-4 py-2 flex items-center gap-3">
                    <Button
                        as="link"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={GENERAL_INFO.upworkProfile}
                        variant="primary"
                    >
                        Let&apos;s Talk
                    </Button>
                </div>
            </div>
        </section>
    );
};

export default Banner;
