'use client';
import ScrollReveal from '@/components/Scrollreveal';
import Button from '@/components/Button';
import BoldHoverText from '@/components/HoverText';
import { useTheme } from '@/components/ThemeProvider';
import { GENERAL_INFO } from '@/lib/data';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import { useRef, useState, useEffect } from 'react';
import { GitFork, Star } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface RepoStats {
    stargazers_count: number;
    forks_count: number;
}

const Footer = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();
    const heroTextColor = theme === 'light' ? '#111111' : '#DEDEDE';
    const heroAccentColor = theme === 'light' ? '#111111' : '#00F050';

    const [stats, setStats] = useState<RepoStats | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch('https://api.github.com/repos/husnainmaroof/portfolio')
            .then((res) => res.json())
            .then((data: RepoStats) => {
                if (!cancelled) setStats(data);
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
            gsap.from('.footer-word', {
                yPercent: 210,
                stagger: 0.08,
                duration: 6,
                ease: 'power4.out',
                delay: 0.15,
                scrollTrigger: {
                    id: 'footer-in',
                    trigger: containerRef.current,
                    start: 'top 75%',
                    toggleActions: 'play none none reverse',
                },
            });

            return () => {
                ScrollTrigger.getById('footer-in')?.kill();
            };
        },
        { scope: containerRef },
    );

    return (
        <footer className="relative overflow-hidden" id="contact">
            <div
                className="max-w-[80%] mx-auto pb-section flex flex-col justify-center items-center text-center"
                ref={containerRef}
            >
                {/* nameplate pill, matches Banner's availability tag */}
                <div className="slide-up-and-fade mb-10 flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-primary" />
                    <span className="text-sm font-medium text-muted-foreground">
                        Available for new projects
                    </span>
                </div>

                {/* headline, word-by-word reveal, same treatment as Banner's h1 */}
                <a
                    href={`mailto:${GENERAL_INFO.email}`}
                    className="group block"
                    data-avatar="contact"
                >
                    <h2 className="leading-[.9] text-[clamp(2.5rem,12vw,120px)] font-anton pb-10">
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

                {/* scroll-scrubbed description, same pattern as AboutMe */}
                <div className="max-w-[600px] text-lg text-muted-foreground tracking-widest mb-10">
                    <ScrollReveal
                        id="footer-reveal"
                        baseOpacity={0}
                        enableBlur={false}
                        baseRotation={0}
                        blurStrength={10}
                        rotationEnd="top 70%"
                        wordAnimationEnd="top 55%"
                    >
                        Have a project in mind? Let&apos;s turn your vision into
                        reality. Reach out and let&apos;s build something great
                        together. Available for freelance and remote
                        projects worldwide, based in Islamabad, Pakistan.
                    </ScrollReveal>
                </div>

                {/* CTA button, same Button component as Banner */}
                <div className="slide-up-and-fade mb-16">
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

                {/* bottom row, credit + live GitHub stats */}
                <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-muted-foreground/20">
                    <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Husnain Maroof © {new Date().getFullYear()}
                    </span>

                    <a
                        href="https://github.com/husnainmaroof/portfolio" data-avatar="social"
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
