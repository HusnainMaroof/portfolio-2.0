'use client';

import {
    useEffect,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction,
} from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLenis } from 'lenis/react';
import { PROJECTS } from '@/lib/data';
import { cn } from '@/lib/utils';
import { PILL_ACTIVE, PILL_BASE } from '@/lib/pill';
import SelectedWorkCarousel from './SelectedWorkCarousel';
import SelectedWorkList from './SelectedWorkList';

type ProjectView = 'carousel' | 'list';

const VIEW_OPTIONS: { value: ProjectView; label: string }[] = [
    { value: 'carousel', label: 'Carousel' },
    { value: 'list', label: 'List' },
];

// Intro copy reuses the site's own wording; it stays because the header needs
// a supporting line under the heading.
const INTRO_COPY =
    "I'm a full-stack developer focused on building fast, polished web experiences, from pixel-level scroll animation to production-grade data-driven apps.";

interface ViewSwitcherProps {
    value: ProjectView;
    onChange: Dispatch<SetStateAction<ProjectView>>;
}

export const ViewSwitcher = ({ value, onChange }: ViewSwitcherProps) => (
    <div
        role="group"
        aria-label="Project view"
        className="inline-flex shrink-0 items-center gap-1 self-start rounded-[14px] bg-white/[0.04] p-1"
    >
        {VIEW_OPTIONS.map((option) => {
            const isActive = option.value === value;

            return (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        PILL_BASE,
                        'h-10 px-4 text-[11px] uppercase tracking-[0.14em] lg:h-9',
                        // Same states as the sidebar rail: no wash until hovered.
                        isActive
                            ? PILL_ACTIVE
                            : 'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground',
                    )}
                >
                    {option.label}
                </button>
            );
        })}
    </div>
);

gsap.registerPlugin(ScrollTrigger);

const SelectedWork = () => {
    const [view, setView] = useState<ProjectView>('carousel');
    const lenis = useLenis();
    const firstRender = useRef(true);

    // Switching views changes the page height by thousands of pixels. The
    // scroll-triggered reveals further down keep their old start points and
    // stay hidden, which shows up as an empty gap, so re-measure after layout.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }

        const frame = requestAnimationFrame(() => {
            lenis?.resize();
            ScrollTrigger.refresh();
        });

        return () => cancelAnimationFrame(frame);
    }, [view, lenis]);

    return (
        <section id="my-projects" className="pt-20 md:pt-28">
            <div className="page-container">
                <header className="mb-12 flex flex-col gap-7 md:mb-16 md:flex-row md:items-start md:justify-between md:gap-10">
                    <div>
                        <h2 className="font-anton text-3xl leading-none text-foreground sm:text-4xl md:text-6xl">
                            Projects
                        </h2>

                        <p className="mt-4 max-w-[560px] text-sm leading-relaxed text-muted-foreground/70">
                            {INTRO_COPY}
                        </p>
                    </div>

                    <ViewSwitcher value={view} onChange={setView} />
                </header>

                {view === 'carousel' ? (
                    <SelectedWorkCarousel projects={PROJECTS} />
                ) : (
                    <SelectedWorkList projects={PROJECTS} />
                )}
            </div>
        </section>
    );
};

export default SelectedWork;
