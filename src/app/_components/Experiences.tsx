'use client';
import SectionTitle from '@/components/SectionTitle';
import { MY_EXPERIENCE, OPEN_SOURCE } from '@/lib/data';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import { useRef } from 'react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const Experiences = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    useGSAP(
        () => {
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: 'top 60%',
                    end: 'bottom 50%',
                    toggleActions: 'restart none none reverse',
                    scrub: 1,
                },
            });

            tl.from('.experience-item', {
                y: 50,
                opacity: 0,
                stagger: 0.3,
            });
        },
        { scope: containerRef },
    );

    useGSAP(
        () => {
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: 'bottom 50%',
                    end: 'bottom 20%',
                    scrub: 1,
                },
            });

            tl.to(containerRef.current, {
                y: -150,
                opacity: 0,
            });
        },
        { scope: containerRef },
    );

    return (
        <section className="py-section" id="my-experience">
            <div className="page-container" ref={containerRef}>
                <SectionTitle title="My Experience" />

                <div className="grid gap-10 md:gap-14">
                    {MY_EXPERIENCE.map((item) => (
                        <div
                            key={item.title}
                            className="experience-item"
                            data-avatar="experience"
                            data-avatar-label={item.title}
                            data-avatar-detail={item.company}
                        >
                            <p className="text-xl text-muted-foreground">
                                {item.company}
                            </p>
                            <p className="text-3xl font-anton leading-none mt-3.5 mb-2.5 sm:text-4xl md:text-5xl">
                                {item.title}
                            </p>
                            <p className="text-lg text-muted-foreground">
                                {item.duration}
                            </p>
                            <ul className="mt-4 max-w-3xl list-disc space-y-1.5 pl-5 text-base text-muted-foreground">
                                {item.highlights.map((line) => (
                                    <li key={line}>{line}</li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    <div
                        className="experience-item"
                        data-avatar="experience"
                        data-avatar-label="Open Source"
                        data-avatar-detail="Cezar, Paperclip, Quran.com"
                    >
                        <p className="text-xl text-muted-foreground">
                            Contributions
                        </p>
                        <p className="text-3xl font-anton leading-none mt-3.5 mb-2.5 sm:text-4xl md:text-5xl">
                            Open Source
                        </p>
                        <ul className="mt-4 grid max-w-3xl gap-4">
                            {OPEN_SOURCE.map((item) => (
                                <li key={item.project}>
                                    <a
                                        href={item.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group block"
                                    >
                                        <p className="text-lg text-foreground group-hover:underline">
                                            {item.project}{' '}
                                            <span className="text-sm text-muted-foreground">
                                                {item.repo} · {item.status}
                                            </span>
                                        </p>
                                        <p className="text-base text-muted-foreground">
                                            {item.summary}
                                        </p>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Experiences;
