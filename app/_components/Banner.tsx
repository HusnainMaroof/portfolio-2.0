'use client';
import BoldHoverText from '@/components/HoverText';
import { GENERAL_INFO } from '@/lib/data';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';

gsap.registerPlugin(useGSAP);

// TODO: move to GENERAL_INFO / lib/data once real content is finalized.
const HERO_STATS = [
    { label: 'Years', value: '2.5+', context: 'experience' },
    { label: 'Apps Shipped', value: '22+', context: 'applications' },
];

const HERO_CREDIBILITY = {
    text: 'Top 5% of developers, recognized by Toptal',
    href: GENERAL_INFO.upworkProfile,
};

const HERO_BULLETS = [
    {
        lead: 'What I build',
        text: 'E-commerce and ordering systems, business dashboards and SaaS tools with subscriptions, marketing sites, and developer tooling, shipped end to end.',
    },
    {
        lead: 'Beyond the build',
        text: 'I plan for scalability so your stack holds up as usage grows.',
    },
    {
        lead: 'Built to grow',
        text: 'Products shaped to attract users and keep them coming back.',
    },
];

const Banner = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [showTopNotice, setShowTopNotice] = useState(false);
    const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { theme } = useTheme();

    useEffect(() => {
        return () => {
            if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
        };
    }, []);

    const handleCredibilityClick = () => {
        setShowTopNotice(true);
        if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = setTimeout(() => {
            setShowTopNotice(false);
        }, 4000);
    };
    const heroAccentColor = theme === 'light' ? '#111111' : '#00F050';
    const heroTextColor = theme === 'light' ? '#111111' : '#DEDEDE';

    useGSAP(
        () => {
            const mediaQuery = window.matchMedia(
                '(prefers-reduced-motion: reduce)',
            );
            if (mediaQuery.matches) return;

            gsap.from('.hero-reveal', {
                opacity: 0,
                y: 12,
                duration: 0.5,
                stagger: 0.05,
                ease: 'power2.out',
            });
        },
        { scope: containerRef },
    );

    return (
        <section className="relative overflow-hidden" id="banner">
            <div
                className=" max-w-[80%] mx-auto relative min-h-[600px] grid grid-cols-1 md:grid-cols-[1fr_240px] gap-12 items-center py-24"
                ref={containerRef}
            >
                {/* left: name-led headline block */}
                <div className="flex flex-col gap-6">
                    <span className="hero-reveal text-sm uppercase tracking-wide text-muted-foreground">
                        Full-Stack Developer · Based in Islamabad,
                        <span className="group relative inline-block ml-1.5">
                            <span className="text-primary underline underline-offset-4">
                                Pakistan
                            </span>
                            <span
                                role="tooltip"
                                className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-green-600 px-3 py-1.5 text-xs normal-case tracking-normal text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100"
                            >
                                Yep, I live in Islamabad, Pakistan.
                            </span>
                        </span>
                    </span>

                    <h1
                        className="hero-reveal leading-[.95] text-[clamp(2.5rem,9vw,48px)] uppercase"
                        style={{
                            fontFamily: "'Fraunces', serif",
                            fontWeight: 600,
                        }}
                    >
                        <span data-avatar="name" className="inline-block">
                            <BoldHoverText
                                text="Husnain Maroof"
                                className="inline-block"
                                fontFamily="'Fraunces', serif"
                                baseWeight={600}
                                hoverWeight={900}
                                color={heroTextColor}
                                hoverColor={heroAccentColor}
                            />
                        </span>
                        <span className="text-foreground">.</span>
                    </h1>

                    <p
                        data-avatar="bio"
                        className="hero-reveal max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed"
                    >
                        I build fast, reliable web products, from first line of
                        code to something real users depend on.
                    </p>

                    <div className="hero-reveal flex flex-col gap-2 max-w-xl text-sm md:text-base text-muted-foreground">
                        {HERO_BULLETS.map((bullet) => (
                            <p key={bullet.lead}>
                                <span className="text-foreground font-semibold">
                                    {bullet.lead}
                                </span>{' '}
                                - {bullet.text}
                            </p>
                        ))}
                    </div>
                </div>

                {/* right: credibility + stats sidebar */}
                <div className="hero-reveal flex md:flex-col gap-6 md:gap-8 md:border-l md:border-border md:pl-8">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={handleCredibilityClick}
                            data-avatar="action"
                            className="inline-flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors w-fit text-left"
                        >
                            {HERO_CREDIBILITY.text}
                            <span aria-hidden>↗</span>
                        </button>

                        {showTopNotice && (
                            <div
                                role="status"
                                className="animate-in fade-in slide-in-from-bottom-2 duration-300 absolute top-full left-0 mt-3 w-max max-w-[260px] z-10 rounded-xl bg-green-600 text-white px-4 py-3 text-sm leading-relaxed shadow-lg"
                            >
                                Grinding toward that. The Top 5% badge is
                                coming soon. 🚧
                            </div>
                        )}
                    </div>

                    <div className="flex md:flex-col gap-6">
                        {HERO_STATS.map((stat) => (
                            <div
                                key={stat.label}
                                data-avatar="stat"
                                data-avatar-label={stat.label}
                                data-avatar-context={stat.context}
                            >
                                <div className="text-3xl font-semibold text-foreground">
                                    {stat.value}
                                </div>
                                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Banner;
