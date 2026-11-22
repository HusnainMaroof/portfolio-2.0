'use client';
import SectionTitle from '@/components/SectionTitle';
import { MY_EXPERIENCE, OPEN_SOURCE } from '@/lib/data';
import { revealOnEnter } from '@/lib/motion';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowUpRight } from 'lucide-react';
import { useRef } from 'react';

gsap.registerPlugin(useGSAP);

const Experiences = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Each role rises in once as it enters and then stays readable. The old
    // version scrubbed the roles against the section's scroll, so a role in
    // the middle of the screen could still be half-faded, and the whole
    // section faded out while its last entries were being read.
    useGSAP(
        () => {
            const root = containerRef.current;
            if (!root) return;

            revealOnEnter(
                gsap.utils.toArray<HTMLElement>('[data-reveal]', root),
            );
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
                            <p
                                data-reveal=""
                                className="text-xl text-muted-foreground"
                            >
                                {item.company}
                            </p>
                            <p
                                data-reveal=""
                                className="text-3xl font-anton leading-none mt-3.5 mb-2.5 sm:text-4xl md:text-5xl"
                            >
                                {item.title}
                            </p>
                            <p
                                data-reveal=""
                                className="text-lg text-muted-foreground"
                            >
                                {item.duration}
                            </p>
                            <ul className="mt-4 max-w-3xl list-disc space-y-1.5 pl-5 text-base text-muted-foreground">
                                {item.highlights.map((line) => (
                                    <li data-reveal="" key={line}>
                                        {line}
                                    </li>
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
                        <p
                            data-reveal=""
                            className="text-xl text-muted-foreground"
                        >
                            Contributions
                        </p>
                        <p
                            data-reveal=""
                            className="text-3xl font-anton leading-none mt-3.5 mb-2.5 sm:text-4xl md:text-5xl"
                        >
                            Open Source
                        </p>
                        {/* Each entry reads as a link: a card-like hover
                            surface and an arrow that nudges toward the repo. */}
                        <ul className="mt-4 grid max-w-3xl gap-2">
                            {OPEN_SOURCE.map((item) => (
                                <li data-reveal="" key={item.project}>
                                    <a
                                        href={item.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group -mx-3 block rounded-xl px-3 py-2.5 transition-colors duration-300 hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <p className="flex flex-wrap items-baseline gap-x-2 text-lg text-foreground">
                                            <span className="transition-colors duration-300 group-hover:text-primary">
                                                {item.project}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                {item.repo} · {item.status}
                                            </span>
                                            <ArrowUpRight
                                                aria-hidden
                                                size={14}
                                                className="self-center text-muted-foreground transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
                                            />
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
