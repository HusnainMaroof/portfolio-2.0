'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import TransitionLink from '@/components/TransitionLink';
import { IProject } from '@/types';
import {
    formatSlideCounter,
    getProjectActions,
    getShortDescription,
    padIndex,
} from '@/lib/projects';
import { cn } from '@/lib/utils';
import { pill } from '@/lib/pill';

// Card widths resolve to ~31vw / ~48vw / ~66vw of the section container.
const CARD_SIZES = '(min-width: 1024px) 25vw, (min-width: 640px) 38vw, 66vw';

const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface ScreenshotCarouselProps {
    images: string[];
    title: string;
}

const ScreenshotCarousel = ({ images, title }: ScreenshotCarouselProps) => {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [canScroll, setCanScroll] = useState(false);
    const [atStart, setAtStart] = useState(true);
    const [atEnd, setAtEnd] = useState(false);

    const syncControls = useCallback(() => {
        const el = scrollerRef.current;
        if (!el) return;

        const maxScroll = el.scrollWidth - el.clientWidth;

        setCanScroll(maxScroll > 2);
        setAtStart(el.scrollLeft <= 2);
        setAtEnd(el.scrollLeft >= maxScroll - 2);
    }, []);

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;

        syncControls();
        el.addEventListener('scroll', syncControls, { passive: true });
        window.addEventListener('resize', syncControls);

        const observer = new ResizeObserver(syncControls);
        observer.observe(el);

        return () => {
            el.removeEventListener('scroll', syncControls);
            window.removeEventListener('resize', syncControls);
            observer.disconnect();
        };
    }, [syncControls]);

    const scrollByCard = (direction: -1 | 1) => {
        const el = scrollerRef.current;
        if (!el) return;

        const slides = Array.from(
            el.querySelectorAll<HTMLElement>('[data-slide]'),
        );
        const step =
            slides.length > 1
                ? slides[1].offsetLeft - slides[0].offsetLeft
                : el.clientWidth;

        el.scrollBy({
            left: direction * step,
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            scrollByCard(-1);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            scrollByCard(1);
        }
    };

    return (
        <div className="rounded-2xl border border-border/50 bg-background-light/40 p-2.5 sm:p-3">
            <div
                ref={scrollerRef}
                role="region"
                aria-roledescription="carousel"
                aria-label={`${title} screenshots`}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
                {images.map((image, index) => (
                    <div
                        key={image}
                        data-slide
                        className="group w-[82%] shrink-0 snap-start sm:w-[48%] lg:w-[31%]"
                    >
                        <div className="relative aspect-[1000/873] w-full overflow-hidden rounded-xl">
                                <Image
                                    src={image}
                                    alt={`${title} screenshot ${index + 1}`}
                                    fill
                                    sizes={CARD_SIZES}
                                    className="object-contain"
                                />
                                <span className="absolute bottom-2 left-2 rounded-sm bg-background/85 px-1.5 py-0.5 text-[10px] tracking-[0.14em] text-muted-foreground">
                                    {formatSlideCounter(
                                        index + 1,
                                        images.length,
                                    )}
                                </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Reserved space keeps the layout stable once measurements land. */}
            <div
                className={cn(
                    'mt-3 flex justify-end gap-2',
                    !canScroll && 'invisible',
                )}
            >
                <button
                    type="button"
                    onClick={() => scrollByCard(-1)}
                    disabled={atStart}
                    aria-label={`Scroll ${title} screenshots backwards`}
                    className={pill(false, 'size-11 lg:size-9')}
                >
                    <ChevronLeft size={16} aria-hidden="true" />
                </button>

                <button
                    type="button"
                    onClick={() => scrollByCard(1)}
                    disabled={atEnd}
                    aria-label={`Scroll ${title} screenshots forwards`}
                    className={pill(false, 'size-11 lg:size-9')}
                >
                    <ChevronRight size={16} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
};

interface ProjectShowcaseProps {
    project: IProject;
    index: number;
}

export const ProjectShowcase = ({ project, index }: ProjectShowcaseProps) => {
    const actions = getProjectActions(project);
    const description = getShortDescription(project);
    const images = project.images ?? [];

    return (
        <article
            data-avatar="project"
            data-avatar-label={project.title}
            data-avatar-detail={project.techStack.slice(0, 3).join(', ')}
            data-avatar-slug={project.slug}
        >
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-10">
                <div className="min-w-0 max-w-2xl">
                    <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em]">
                        <span className="text-primary">
                            {padIndex(index + 1)}
                        </span>
                        <span aria-hidden className="h-px w-8 bg-border/70" />
                        <span className="text-muted-foreground">
                            {project.year}
                        </span>
                    </div>

                    <h3 className="mt-4 font-anton text-3xl leading-none text-foreground md:text-5xl">
                        {project.title}
                    </h3>

                    {description && (
                        <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
                            {description}
                        </p>
                    )}
                </div>

                {actions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 md:shrink-0">
                        {actions.map((action) => {
                            const className =
                                pill(false, 'h-10 px-4 text-xs');

                            return action.external ? (
                                <a
                                    key={action.label}
                                    href={action.href}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className={className}
                                >
                                    {action.label}
                                </a>
                            ) : (
                                <TransitionLink
                                    key={action.label}
                                    href={action.href}
                                    className={className}
                                >
                                    {action.label}
                                </TransitionLink>
                            );
                        })}
                    </div>
                )}
            </div>

            {images.length > 0 && (
                <div className="mt-8 md:mt-10">
                    <ScreenshotCarousel
                        images={images}
                        title={project.title}
                    />
                </div>
            )}
        </article>
    );
};

interface Props {
    projects: IProject[];
}

const SelectedWorkCarousel = ({ projects }: Props) => (
    <div className="space-y-20 md:space-y-28">
        {projects.map((project, index) => (
            <ProjectShowcase
                key={project.slug}
                project={project}
                index={index}
            />
        ))}
    </div>
);

export default SelectedWorkCarousel;
