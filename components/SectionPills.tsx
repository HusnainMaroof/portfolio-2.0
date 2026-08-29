'use client';

import { useEffect, useState } from 'react';
import { useLenis } from 'lenis/react';
import { cn } from '@/lib/utils';

const SECTIONS = [
    { id: 'banner', label: 'Home' },
    { id: 'my-projects', label: 'Projects' },
    { id: 'my-stack', label: 'Skills' },
    { id: 'my-experience', label: 'Experience' },
    { id: 'contact', label: 'Contact' },
];

const SectionPills = () => {
    const [active, setActive] = useState<string>('banner');
    // Lenis owns the page scroll — native scrollIntoView fights it, so
    // navigation must go through lenis.scrollTo to land accurately.
    const lenis = useLenis();

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActive(entry.target.id);
                    }
                });
            },
            {
                // A narrow horizontal band around the viewport's upper-middle
                // area decides which section "owns" the screen right now.
                rootMargin: '-40% 0px -55% 0px',
                threshold: 0,
            },
        );

        SECTIONS.forEach(({ id }) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, []);

    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return;

        if (lenis) {
            lenis.scrollTo(el, {
                duration: 1.4,
                // let the section title breathe below the top edge
                offset: -24,
            });
        } else {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <nav
            aria-label="Section navigation"
            className="max-lg:hidden fixed left-4 top-1/2 -translate-y-1/2 z-[4] flex flex-col gap-2"
        >
            {SECTIONS.map(({ id, label }) => {
                const isActive = active === id;
                return (
                    <button
                        key={id}
                        onClick={() => scrollTo(id)}
                        aria-current={isActive ? 'true' : undefined}
                        className={cn(
                            'rounded-lg border px-3 py-1.5 text-xs font-medium tracking-wide',
                            'backdrop-blur-sm transition-all duration-300 ease-out text-left',
                            'hover:-translate-y-0.5 hover:shadow-md active:scale-95',
                            isActive
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                : 'bg-background-light/70 text-muted-foreground border-border/60 hover:text-foreground',
                        )}
                    >
                        {label}
                    </button>
                );
            })}
        </nav>
    );
};

export default SectionPills;
