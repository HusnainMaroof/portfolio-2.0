'use client';
import parse from 'html-react-parser';
import ArrowAnimation from '@/components/ArrowAnimation';
import TransitionLink from '@/components/TransitionLink';
import { DUR, EASE } from '@/lib/motion';
import { IProject } from '@/types';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import { ArrowLeft, ExternalLink, Github } from 'lucide-react';
import Image from 'next/image';
import { useRef } from 'react';

interface Props {
    project: IProject;
}

gsap.registerPlugin(useGSAP, ScrollTrigger);

const ProjectDetails = ({ project }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useGSAP(
        () => {
            if (!containerRef.current) return;

            gsap.set('.fade-in-later', {
                autoAlpha: 0,
                y: 30,
            });
            const tl = gsap.timeline({
                delay: 0.5,
            });

            tl.to('.fade-in-later', {
                autoAlpha: 1,
                y: 0,
                duration: DUR.slow,
                ease: EASE.enter,
                stagger: 0.08,
            });
        },
        { scope: containerRef },
    );

    // The details pin while the screenshots slide up over them, then sink
    // back. They used to start fading (and blurring) the moment they pinned,
    // so the last lines dimmed while still being read. Now the first 40% of
    // the overlap keeps them fully readable, and there is no blur: a full-
    // screen blur filter is expensive to repaint on every scroll frame.
    useGSAP(
        () => {
            if (window.innerWidth < 992) return;

            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: '#info',
                    start: 'bottom bottom',
                    end: 'bottom top',
                    pin: true,
                    pinSpacing: false,
                    scrub: true,
                },
            });

            tl.to({}, { duration: 0.4 }).to('#info', {
                opacity: 0.12,
                scale: 0.94,
                duration: 0.6,
                ease: 'none',
            });
        },
        { scope: containerRef },
    );

    // parallax effect on images (real <img> elements so crawlers can index
    // them; the scroll shift moves object-position instead of background-position)
    useGSAP(() => {
        gsap.utils
            .toArray<HTMLDivElement>('#images > div')
            .forEach((imageDiv, i) => {
                const img = imageDiv.querySelector('img');
                if (!img) return;

                gsap.fromTo(
                    img,
                    { objectPosition: 'center 50%' },
                    {
                        objectPosition: 'center 0%',
                        ease: 'none',
                        scrollTrigger: {
                            trigger: imageDiv,
                            start: () => (i ? 'top bottom' : 'top 50%'),
                            end: 'bottom top',
                            scrub: true,
                            // invalidateOnRefresh: true, // to make it responsive
                        },
                    },
                );
            });
    }, { scope: containerRef });

    return (
        <section className="pt-24 pb-14">
            <div className="max-w-[80%] mx-auto" ref={containerRef}>
                {/* Same height, radius and surface as the nav tiles, on the
                    same top line, above the nav's scroll fade. */}
                <TransitionLink
                    back
                    href="/"
                    className="fixed left-4 top-4 z-[51] inline-flex h-14 items-center gap-2 rounded-[10px] bg-[color-mix(in_oklab,hsl(var(--foreground))_8%,hsl(var(--background)))] px-4 text-sm backdrop-blur-md transition-colors duration-200 group hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:left-6"
                >
                    <ArrowLeft
                        size={18}
                        className="transition-transform duration-300 group-hover:-translate-x-1 motion-reduce:transition-none"
                    />
                    <span className="max-sm:sr-only">Back</span>
                </TransitionLink>

                <div
                    className="top-0 min-h-[calc(100svh-100px)] flex"
                    id="info"
                >
                    <div className="relative w-full">
                        <div className="flex items-start gap-6 mx-auto mb-10 max-w-[635px]">
                            <h1 className="fade-in-later opacity-0 text-4xl md:text-[60px] leading-none font-anton overflow-hidden">
                                <span className="inline-block">
                                    {project.title}
                                </span>
                            </h1>

                            <div className="fade-in-later opacity-0 flex gap-2">
                                {project.sourceCode && (
                                    <a
                                        href={project.sourceCode}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="hover:text-primary"
                                    >
                                        <Github size={30} />
                                    </a>
                                )}
                                {project.liveUrl && (
                                    <a
                                        href={project.liveUrl}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="hover:text-primary"
                                    >
                                        <ExternalLink size={30} />
                                    </a>
                                )}
                            </div>
                        </div>

                        <div className="max-w-[635px] space-y-7 pb-20 mx-auto">
                            <div className="fade-in-later">
                                <p className="text-muted-foreground font-anton mb-3">
                                    Year
                                </p>

                                <div className="text-lg">{project.year}</div>
                            </div>
                            <div className="fade-in-later">
                                <p className="text-muted-foreground font-anton mb-3">
                                    Tech & Technique
                                </p>

                                <div className="text-lg">
                                    {project.techStack.join(', ')}
                                </div>
                            </div>
                            <div className="fade-in-later">
                                <p className="text-muted-foreground font-anton mb-3">
                                    Description
                                </p>

                                <div className="text-lg prose-xl markdown-text">
                                    {parse(project.description)}
                                </div>
                            </div>
                            {project.role && (
                                <div className="fade-in-later">
                                    <p className="text-muted-foreground font-anton mb-3">
                                        My Role
                                    </p>

                                    <div className="text-lg">
                                        {parse(project.role)}
                                    </div>
                                </div>
                            )}
                        </div>

                        <ArrowAnimation />
                    </div>
                </div>

                <div
                    className="fade-in-later relative flex flex-col gap-2 max-w-[800px] mx-auto"
                    id="images"
                >
                    {project.images.map((image, index) => (
                        <div
                            key={image}
                            className="group relative w-full aspect-[750/400] overflow-hidden bg-background-light"
                        >
                            <Image
                                src={image}
                                alt={`${project.title} project screenshot ${index + 1}`}
                                fill
                                sizes="(min-width: 1024px) 800px, 90vw"
                                className="object-cover"
                                style={{ objectPosition: 'center 50%' }}
                            />
                            <a
                                href={image}
                                target="_blank"
                                aria-label={`Open ${project.title} screenshot ${index + 1} full size`}
                                className="absolute top-4 right-4 z-[1] bg-background/70 text-foreground size-12 inline-flex justify-center items-center rounded-[10px] transition-all opacity-0 hover:bg-primary hover:text-primary-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:opacity-100"
                            >
                                <ExternalLink />
                            </a>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ProjectDetails;
