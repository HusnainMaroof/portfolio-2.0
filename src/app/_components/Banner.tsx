'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
    motion,
    MotionConfig,
    useReducedMotion,
    useScroll,
    useTransform,
    type Variants,
} from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import TransitionLink from '@/components/TransitionLink';
import { HERO } from '@/content/hero';
import BoldHoverText from '@/components/HoverText';
import { useTheme } from '@/components/ThemeProvider';
import HeroCoffeeCard from './HeroCoffeeCard';
import ParticlePortrait from '@/components/hero/particle-portrait';

/** Entry choreography: portrait rises first, then the copy staggers in. */
const container: Variants = {
    hidden: {},
    shown: { transition: { delayChildren: 0.35, staggerChildren: 0.09 } },
};

// No opacity fade: Chrome ignores fully transparent elements for LCP, so a
// fade delayed the largest paint. The portrait only rises into place.
const portrait: Variants = {
    hidden: { y: 24 },
    shown: {
        y: 0,
        transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
    },
};

const item: Variants = {
    hidden: { opacity: 0, y: 14 },
    shown: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    },
};

const focusRing =
    'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Same click-to-reveal note the hero has always used for the Top 5% line. */
const Credibility = () => {
    const [open, setOpen] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        },
        [],
    );

    const reveal = () => {
        setOpen(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setOpen(false), 4000);
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={reveal}
                data-avatar="action"
                className={`inline-flex items-start gap-1.5 text-left text-sm text-foreground transition-colors hover:text-primary ${focusRing}`}
            >
                {HERO.credibility.text}
                <ArrowUpRight
                    size={14}
                    strokeWidth={1.75}
                    className="mt-0.5 shrink-0"
                    aria-hidden
                />
            </button>

            {open && (
                <div
                    role="status"
                    className="animate-in fade-in slide-in-from-bottom-2 absolute left-0 top-full z-10 mt-3 lg:left-auto lg:right-0 w-max max-w-[260px] rounded-xl bg-green-600 px-4 py-3 text-left text-sm leading-relaxed text-white shadow-lg duration-300"
                >
                    {HERO.credibility.notice}
                </div>
            )}
        </div>
    );
};

/** One link in the bottom-left corner to the socials page (LinkedIn, GitHub, resume). */
const Socials = ({ className }: { className: string }) => (
    <motion.div variants={item} className={className}>
        <TransitionLink
            href="/socials"
            data-avatar="social"
            data-avatar-label="Socials"
            className={`inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.16em] text-primary underline-offset-4 transition-colors hover:text-foreground hover:underline ${focusRing}`}
        >
            Socials
            <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
        </TransitionLink>
    </motion.div>
);

const Stats = ({ className }: { className: string }) => (
    <motion.div variants={item} className={className}>

        <Credibility />

        <dl className="flex gap-8 lg:flex-col lg:gap-5">
            {HERO.stats.map((stat) => (
                <div
                    key={stat.label}
                    data-avatar="stat"
                    data-avatar-label={stat.label}
                    data-avatar-context={stat.context}
                    className="flex flex-col-reverse"
                >
                    <dt className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        {stat.label}
                    </dt>
                    <dd className="text-2xl font-semibold leading-tight text-foreground md:text-3xl">
                        {stat.value}
                    </dd>
                </div>
            ))}
        </dl>
    </motion.div>
);

const Banner = () => {
    const { theme } = useTheme();
    const nameColor = theme === 'light' ? '#111111' : '#f2efe8';
    const nameHover = theme === 'light' ? '#111111' : '#00F050';
    const nameProps = {
        fontFamily: 'var(--font-display), Georgia, serif',
        // Instrument Serif ships only 400, so hover changes colour, not weight.
        baseWeight: 400,
        hoverWeight: 400,
        color: nameColor,
        hoverColor: nameHover,
    } as const;

    const sectionRef = useRef<HTMLElement>(null);
    const portraitRef = useRef<HTMLDivElement>(null);
    const imageLayerRef = useRef<HTMLDivElement>(null);
    const nameRef = useRef<HTMLHeadingElement>(null);

    // Scroll fade: the portrait lags behind the page, so it seems to stay put
    // while the name slides up over it, and sinks into the dark over the first
    // half of the hero. The particle layer fades its dots over the same range.
    const reduceMotion = useReducedMotion();
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ['start start', 'end start'],
    });
    const portraitFade = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
    const portraitLag = useTransform(scrollYProgress, (v) =>
        reduceMotion ? '0%' : `${Math.min(v, 0.6) * 55}%`,
    );

    return (
        <MotionConfig reducedMotion="user">
            <section
                id="banner"
                ref={sectionRef}
                className="hero-surface relative isolate overflow-hidden"
            >
                {/* Faint vertical grid, pure CSS. */}
                <div
                    aria-hidden
                    className="hero-grid pointer-events-none absolute inset-0 -z-10"
                />

                {/* GPU particle layer: aligned over the portrait, dissolves into the name on scroll. */}
                <ParticlePortrait
                    sectionRef={sectionRef}
                    portraitRef={portraitRef}
                    nameRef={nameRef}
                    imageLayerRef={imageLayerRef}
                    theme={theme}
                />

                <HeroCoffeeCard />

                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="shown"
                    className="page-container relative flex min-h-[100svh] flex-col items-center justify-end pb-[88px] pt-16 lg:pb-10 lg:pt-12"
                >
                    {/* Desktop: stats sit top-right, clear of the portrait and below the top nav. */}
                    <Stats className="absolute -right-10 top-32 hidden max-w-[220px] flex-col items-end gap-6 border-r border-border pr-6 text-right lg:flex" />

                    <motion.div style={{ opacity: portraitFade, y: portraitLag }}>
                    <motion.div
                        ref={portraitRef}
                        variants={portrait}
                        data-avatar="portrait"
                        data-avatar-label={HERO.name.roman}
                        className="hero-portrait relative w-[min(92vw,620px,62svh)] lg:w-[clamp(620px,40vw,680px)] [mask-image:linear-gradient(to_bottom,black_55%,transparent_92%)]"
                    >
                        {/* LCP, no-JS and fallback layer. The particle canvas samples this exact image. */}
                        <div ref={imageLayerRef}>
                            <Image
                                src={HERO.portrait.src}
                                alt={HERO.portrait.alt}
                                width={HERO.portrait.width}
                                height={HERO.portrait.height}
                                priority
                                sizes="(min-width: 1024px) clamp(620px, 40vw, 680px), min(92vw, 620px)"
                                draggable={false}
                                className="h-auto w-full select-none grayscale"
                            />
                        </div>
                    </motion.div>
                    </motion.div>

         

                    <motion.h1
                        ref={nameRef}
                        variants={item}
                        data-avatar="name"
                        className="font-name pointer-events-none relative z-10 -mt-[clamp(70px,6.5vw,220px)] text-center text-[clamp(4.5rem,9.5vw,12.5rem)] font-normal leading-[0.9] tracking-[-0.025em] text-foreground dark:text-[#f2efe8]"
                    >
                        <BoldHoverText
                            text={HERO.name.roman}
                            className="inline-block"
                            {...nameProps}
                        />{' '}
                        <em className="inline-block italic">
                            <BoldHoverText
                                text={HERO.name.italic}
                                {...nameProps}
                            />
                        </em>
                    </motion.h1>





                    {/* <motion.p
                        variants={item}
                        data-avatar="bio"
                        className="font-display  max-w-[34rem] mt-10 text-balance text-center text-base leading-snug text-foreground/75  lg:text-[clamp(1.125rem,2.6svh,1.5rem)]"
                    >
                        {HERO.address.text}
                        <em className="italic text-primary">
                            {HERO.address.location}
                        </em>
                        
                    </motion.p> */}

                    <motion.p
                        variants={item}
                        data-avatar="bio"
                        className="font-display mt-4 max-w-[40rem] text-balance text-center text-base leading-snug text-foreground/75 sm:text-lg lg:mt-5 lg:text-[clamp(1.125rem,2.6svh,1.5rem)]"
                    >
                        {HERO.tagline.lead}
                        <em className="italic text-primary">
                            {HERO.tagline.accent}
                        </em>
                        {HERO.tagline.tail}
                    </motion.p>

                    {/* Socials link pinned to the viewport's bottom-left corner, every size. */}
                    <Socials className="fixed bottom-5 left-5 z-[4] lg:left-[22px]" />

                    {/* Tablet and phone: stats under the tagline. */}
                    <Stats className="mt-6 flex flex-col items-center gap-4 text-center lg:hidden" />                </motion.div>
            </section>
        </MotionConfig>
    );
};

export default Banner;
