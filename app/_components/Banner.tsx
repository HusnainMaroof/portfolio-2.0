'use client';
import BoldHoverText from '@/components/HoverText';
import { GENERAL_INFO } from '@/lib/data';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';
import { useTheme } from '@/components/ThemeProvider';

gsap.registerPlugin(useGSAP);

// TODO: move to GENERAL_INFO / lib/data once real content is finalized.
const HERO_STATS = [
    { label: 'Years', value: '6+' },
    { label: 'Apps Shipped', value: '72+' },
];

const HERO_CREDIBILITY = {
    text: 'Top 5% of developers, recognized by Toptal',
    href: GENERAL_INFO.upworkProfile,
};

const HERO_BULLETS = [
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
    const { theme } = useTheme();
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
                        Full-Stack Developer · Based in Pakistan
                    </span>

                    <h1
                        className="hero-reveal leading-[.95] text-[clamp(2.5rem,9vw,48px)] uppercase"
                        style={{
                            fontFamily: "'Fraunces', serif",
                            fontWeight: 600,
                        }}
                    >
                        <BoldHoverText
                            text="Husnain Maroof"
                            className="inline-block"
                            fontFamily="'Fraunces', serif"
                            baseWeight={600}
                            hoverWeight={900}
                            color={heroTextColor}
                            hoverColor={heroAccentColor}
                        />
                        <span className="text-foreground">.</span>
                    </h1>

                    <p className="hero-reveal max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed">
                        I build fast, reliable web products — from first line of
                        code to something real users depend on.
                    </p>

                    <div className="hero-reveal flex flex-col gap-2 max-w-xl text-sm md:text-base text-muted-foreground">
                        {HERO_BULLETS.map((bullet) => (
                            <p key={bullet.lead}>
                                <span className="text-foreground font-semibold">
                                    {bullet.lead}
                                </span>{' '}
                                — {bullet.text}
                            </p>
                        ))}
                    </div>
                </div>

                {/* right: credibility + stats sidebar */}
                <div className="hero-reveal flex md:flex-col gap-6 md:gap-8 md:border-l md:border-border md:pl-8">
                    <a
                        href={HERO_CREDIBILITY.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors w-fit"
                    >
                        {HERO_CREDIBILITY.text}
                        <span aria-hidden>↗</span>
                    </a>

                    <div className="flex md:flex-col gap-6">
                        {HERO_STATS.map((stat) => (
                            <div key={stat.label}>
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
