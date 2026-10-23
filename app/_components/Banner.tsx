'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { motion, MotionConfig, type Variants } from 'framer-motion';
import { ArrowUpRight, Github, Linkedin } from 'lucide-react';
import { HERO } from '@/content/hero';
import BoldHoverText from '@/components/HoverText';
import { useTheme } from '@/components/ThemeProvider';
import HeroCoffeeCard from './HeroCoffeeCard';

/** Entry choreography: portrait rises first, then the copy staggers in. */
const container: Variants = {
    hidden: {},
    shown: { transition: { delayChildren: 0.35, staggerChildren: 0.09 } },
};

const portrait: Variants = {
    hidden: { opacity: 0, y: 24 },
    shown: {
        opacity: 1,
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
                    className="animate-in fade-in slide-in-from-bottom-2 absolute left-0 top-full z-10 mt-3 w-max max-w-[260px] rounded-xl bg-green-600 px-4 py-3 text-left text-sm leading-relaxed text-white shadow-lg duration-300"
                >
                    {HERO.credibility.notice}
                </div>
            )}
        </div>
    );
};

const SOCIAL_ICONS = { GitHub: Github, LinkedIn: Linkedin } as const;

/** GitHub and LinkedIn, stacked in the bottom-left corner of the viewport. */
const Socials = ({ className }: { className: string }) => (
    <motion.ul variants={item} className={className}>
        {HERO.socials.map((social) => {
            const Icon = SOCIAL_ICONS[social.label];

            return (
                <li key={social.label}>
                    <a
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-avatar="social"
                        data-avatar-label={social.label}
                        className={`inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.16em] text-primary underline-offset-4 transition-colors hover:text-foreground hover:underline ${focusRing}`}
                    >
                        <Icon size={16} strokeWidth={1.75} aria-hidden />
                        {social.label}
                        <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
                    </a>
                </li>
            );
        })}
    </motion.ul>
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
    const nameColor = theme === 'light' ? '#111111' : '#DEDEDE';
    const nameHover = theme === 'light' ? '#111111' : '#00F050';
    const nameProps = {
        fontFamily: 'var(--font-fraunces), Georgia, serif',
        baseWeight: 400,
        hoverWeight: 800,
        color: nameColor,
        hoverColor: nameHover,
    } as const;

    return (
        <MotionConfig reducedMotion="user">
            <section
                id="banner"
                className="hero-surface relative isolate overflow-hidden lg:-ml-[156px] lg:pl-[156px]"
            >
                {/* Faint vertical grid, pure CSS. */}
                <div
                    aria-hidden
                    className="hero-grid pointer-events-none absolute inset-0 -z-10"
                />

                <HeroCoffeeCard />

                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="shown"
                    className="page-container relative flex min-h-[100svh] flex-col items-center justify-end pb-[88px] pt-16 lg:pb-10 lg:pt-12"
                >
                    {/* Desktop: stats sit top-left, clear of the portrait. */}
                    <Stats className="absolute -left-10 top-16 hidden max-w-[220px] flex-col gap-6 border-l border-border pl-6 lg:flex" />

                    <motion.div
                        variants={portrait}
                        data-avatar="portrait"
                        data-avatar-label={HERO.name.roman}
                        className="group relative w-[min(92vw,560px,calc(100svh-480px))] min-w-[220px] md:w-[min(600px,calc(100svh-500px))] lg:w-[min(48vw,850px,calc(100svh-270px))]"
                    >
                        <Image
                            src={HERO.portrait.src}
                            alt={HERO.portrait.alt}
                            width={HERO.portrait.width}
                            height={HERO.portrait.height}
                            priority
                            sizes="(min-width: 1024px) min(48vw, 850px), (min-width: 768px) 600px, min(92vw, 560px)"
                            className="hero-portrait h-auto w-full select-none"
                            style={{
                                maskImage:
                                    'linear-gradient(to bottom, black 60%, transparent)',
                                WebkitMaskImage:
                                    'linear-gradient(to bottom, black 60%, transparent)',
                            }}
                            draggable={false}
                        />
                    </motion.div>

         

                    <motion.h1
                        variants={item}
                        data-avatar="name"
                        className="font-display relative -mt-[clamp(2rem,min(7vw,9svh),6rem)] text-center text-[clamp(2.5rem,min(8.5vw,13svh),7.5rem)] font-normal leading-[0.9] tracking-[-0.02em] text-foreground"
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
                        className="font-display mt-4 max-w-[34rem] text-balance text-center text-base leading-snug text-foreground/75 sm:text-lg lg:mt-5 lg:text-[clamp(1.125rem,2.6svh,1.5rem)]"
                    >
                        {HERO.tagline.lead}
                        <em className="italic text-primary">
                            {HERO.tagline.accent}
                        </em>
                        {HERO.tagline.tail}
                    </motion.p>

                    {/* Desktop: socials pinned to the viewport's bottom-left corner. */}
                    <Socials className="fixed bottom-5 left-[22px] z-[4] hidden flex-col items-start gap-2.5 lg:flex" />

                    {/* Tablet and phone: stats under the tagline. */}
                    <Stats className="mt-6 flex flex-col items-center gap-4 text-center lg:hidden" />                </motion.div>
            </section>
        </MotionConfig>
    );
};

export default Banner;
