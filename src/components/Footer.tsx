'use client';
import Button from '@/components/Button';
import LiveCounter from '@/components/analytics/LiveCounter';
import RatingStars from '@/components/analytics/RatingStars';
import NotesWall from '@/components/notes/NotesWall';
import { EASE, MOTION_OK, revealOnEnter } from '@/lib/motion';
import BoldHoverText from '@/components/HoverText';
import { useTheme } from '@/components/ThemeProvider';
import { GENERAL_INFO } from '@/lib/data';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import { useRef, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { GitFork, Star } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface RepoStats {
    stargazers_count: number;
    forks_count: number;
}

const Footer = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();
    // The private visitor dashboard gets no contact footer.
    const hidden = usePathname().startsWith('/admin');
    const heroTextColor = theme === 'light' ? '#111111' : '#DEDEDE';
    const heroAccentColor = theme === 'light' ? '#0E8147' : '#00F050';

    const [stats, setStats] = useState<RepoStats | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch('https://api.github.com/repos/HusnainMaroof/portfolio-2.0')
            // A 404 or rate-limit reply is JSON too; only real stats are shown.
            .then((res) => (res.ok ? res.json() : null))
            .then((data: RepoStats | null) => {
                if (!cancelled && typeof data?.stargazers_count === 'number')
                    setStats(data);
            })
            .catch(() => {
                // Stats are decorative, fail silently
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useGSAP(
        () => {
            const root = containerRef.current;
            if (!root) return;

            // The headline rises out of its masks once. It used to take six
            // seconds, so it was still half-hidden when visitors read it.
            if (window.matchMedia(MOTION_OK).matches) {
                const words = gsap.utils.toArray<HTMLElement>(
                    '.footer-word',
                    root,
                );
                gsap.set(words, { yPercent: 110 });
                ScrollTrigger.create({
                    trigger: root,
                    start: 'top 80%',
                    once: true,
                    onEnter: () =>
                        gsap.to(words, {
                            yPercent: 0,
                            duration: 1.1,
                            ease: EASE.punch,
                            stagger: 0.1,
                        }),
                });
            }

            revealOnEnter(
                gsap.utils.toArray<HTMLElement>('[data-footer-reveal]', root),
                { start: 'top 95%' },
            );
        },
        { scope: containerRef },
    );

    if (hidden) return null;

    return (
        <footer className="relative overflow-hidden" id="contact">
            {/* Guestbook: visitors' notes drift across, anyone can pin one. */}
            <NotesWall />

            {/* Phones: extra bottom room so the fixed Socials link and Onee
                (both in the bottom corners) never cover the credit line. */}
            <div
                className="page-container pb-28 md:pb-10 flex flex-col justify-center items-center text-center"
                ref={containerRef}
            >
                {/* headline, word-by-word reveal, same treatment as Banner's h1 */}
                <a
                    href={`mailto:${GENERAL_INFO.email}`}
                    className="group block"
                    data-avatar="contact"
                >
                    <h2 className="leading-[.9] text-[clamp(2rem,10vw,120px)] font-anton pb-6 md:pb-10">
                        <span className="flex flex-wrap justify-center gap-x-4 md:gap-x-6">
                            <span className="overflow-hidden inline-block -mb-2">
                                <BoldHoverText
                                    text="Let's"
                                    className="footer-word inline-block uppercase"
                                    fontFamily="'Fraunces', serif"
                                    baseWeight={300}
                                    hoverWeight={900}
                                    color={heroTextColor}
                                    hoverColor={heroAccentColor}
                                />
                            </span>
                            <span className="overflow-hidden inline-block pb-2 -mb-2">
                                <BoldHoverText
                                    text="Talk"
                                    className="footer-word inline-block uppercase"
                                    fontFamily="'Fraunces', serif"
                                    baseWeight={300}
                                    hoverWeight={900}
                                    color={heroTextColor}
                                    hoverColor={heroAccentColor}
                                />
                            </span>
                        </span>
                    </h2>
                </a>

                {/* Revealed whole as it enters. It used to brighten word by
                    word with scroll, but the page ends before the scroll
                    reaches the end point on most screens, so the last words
                    ("based in Islamabad, Pakistan") stayed faded for good. */}
                <p
                    data-footer-reveal=""
                    className="max-w-[600px] text-base leading-relaxed text-muted-foreground tracking-wide mb-8 md:text-lg md:tracking-widest md:mb-10"
                >
                    Have a project in mind? Let&apos;s turn your vision into
                    reality. Reach out and let&apos;s build something great
                    together. Available for freelance and remote projects
                    worldwide, based in Islamabad, Pakistan.
                </p>

                {/* CTA button, same Button component as Banner */}
                <div data-footer-reveal="" className="mb-12">
                    <Button
                        as="link"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={GENERAL_INFO.upworkProfile}
                        data-avatar="contact"
                        variant="primary"
                    >
                        Let&apos;s Talk
                    </Button>
                </div>

                {/* Rate the portfolio (hidden until analytics is set up). */}
                <div data-footer-reveal="" className="mb-10">
                    <RatingStars />
                </div>

                {/* bottom row, credit + live counter + live GitHub stats */}
                <div
                    data-footer-reveal=""
                    className="w-full flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-muted-foreground/20"
                >
                    <div className="flex flex-col items-center gap-2 md:items-start">
                        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                            Husnain Maroof © {new Date().getFullYear()}
                        </span>
                        <LiveCounter />
                    </div>

                    <a
                        href="https://github.com/HusnainMaroof/portfolio-2.0" data-avatar="social"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col items-center md:items-end gap-1"
                    >
                        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground group-hover:text-primary transition-colors duration-300">
                            Design &amp; built by Husnain Maroof
                        </span>

                        {stats && (
                            <div className="flex items-center gap-5 text-muted-foreground group-hover:text-primary transition-colors duration-300">
                                <span className="flex items-center gap-1.5 text-xs">
                                    <Star size={12} /> {stats.stargazers_count}
                                </span>
                                <span className="flex items-center gap-1.5 text-xs">
                                    <GitFork size={12} /> {stats.forks_count}
                                </span>
                            </div>
                        )}
                    </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
