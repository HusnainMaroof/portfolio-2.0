'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { PROJECTS } from '@/lib/data';
import { cn } from '@/lib/utils';
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
        className="inline-flex shrink-0 items-center gap-1 self-start rounded-md border border-border/60 bg-background-light/50 p-1"
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
                        'rounded border px-3.5 py-2.5 text-[11px] uppercase tracking-[0.14em] transition-colors duration-200 lg:py-1.5',
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                        isActive
                            ? 'border-primary/70 text-foreground'
                            : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                >
                    {option.label}
                </button>
            );
        })}
    </div>
);

const SelectedWork = () => {
    const [view, setView] = useState<ProjectView>('carousel');

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
