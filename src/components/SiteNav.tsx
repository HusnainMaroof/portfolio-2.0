'use client';

import { useEffect, useState } from 'react';
import { useLenis } from 'lenis/react';
import { usePathname, useRouter } from 'next/navigation';
import {
    CalendarDays,
    FileText,
    Layers3,
    LayoutGrid,
    UsersRound,
    type LucideIcon,
} from 'lucide-react';
import { ExpandTabs } from '@/components/ui/expand-tabs';

interface NavItem {
    label: string;
    /** Section id on the home page to scroll to. */
    sectionId: string;
    icon: LucideIcon;
}

/** The real section ids on the home page (Banner, SelectedWork, Skills, Experiences, Footer). */
const NAV_ITEMS: readonly NavItem[] = [
    { label: 'Intro', sectionId: 'banner', icon: LayoutGrid },
    { label: 'Projects', sectionId: 'my-projects', icon: FileText },
    { label: 'Stack', sectionId: 'my-stack', icon: Layers3 },
    { label: 'Experience', sectionId: 'my-experience', icon: CalendarDays },
    { label: 'Contact', sectionId: 'contact', icon: UsersRound },
];

/**
 * Top-centre navigation (ExpandTabs). Each tile scrolls to its section; the
 * section on screen has its tile filled green (aria-current). Tiles show an
 * icon and open to their label on hover; phones get them scaled to fit 375px.
 */
export default function SiteNav() {
    const lenis = useLenis();
    const pathname = usePathname();
    const router = useRouter();
    const [active, setActive] = useState(0);

    // The last section whose top has crossed the upper part of the viewport
    // owns the dot. This never skips a section, unlike an intersection band.
    useEffect(() => {
        let frame = 0;

        const update = () => {
            frame = 0;
            const present = NAV_ITEMS.map((item, i) => ({
                i,
                el: document.getElementById(item.sectionId),
            })).filter((s) => s.el);

            // Pages without the home sections (case studies) keep Intro.
            if (present.length === 0) return setActive(0);

            const line = window.innerHeight * 0.45;
            let current = present[0].i;
            for (const { i, el } of present) {
                if (el!.getBoundingClientRect().top <= line) current = i;
            }

            // At the very bottom, the last section (Contact) always wins.
            const atBottom =
                window.innerHeight + window.scrollY >=
                document.documentElement.scrollHeight - 4;
            if (atBottom) current = present[present.length - 1].i;

            setActive(current);
        };

        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };

        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [pathname]);

    // Lenis owns the page scroll; native scrollIntoView fights it.
    const scrollToSection = (sectionId: string) => {
        const el = document.getElementById(sectionId);

        // On a case study page the sections live on the home page.
        if (!el) {
            router.push(`/#${sectionId}`);
            return;
        }

        if (lenis) lenis.scrollTo(el, { duration: 1.4, offset: -24 });
        else el.scrollIntoView({ behavior: 'smooth' });
    };

    // Arriving on the home page with a section hash scrolls there once the
    // preloader has finished.
    useEffect(() => {
        const id = window.location.hash.slice(1);
        if (!id || !document.getElementById(id)) return;

        const timer = window.setTimeout(() => {
            const el = document.getElementById(id);
            if (!el) return;
            if (lenis) lenis.scrollTo(el, { duration: 1.4, offset: -24 });
            else el.scrollIntoView({ behavior: 'smooth' });
        }, 1500);

        return () => window.clearTimeout(timer);
    }, [pathname, lenis]);

    return (
        <div
            data-avatar-keepout=""
            className="pointer-events-none fixed inset-x-0 top-4 z-[50] flex justify-center"
        >
            <ExpandTabs
                label="Main navigation"
                color="hsl(var(--primary))"
                value={active}
                onValueChange={setActive}
                className="pointer-events-auto origin-top scale-[0.8] sm:scale-90 md:scale-100"
                classNames={{
                    // White text is unreadable on the green, so the open label is dark.
                    label: 'font-roboto-flex font-medium text-primary-foreground',
                    tab: 'backdrop-blur-md',
                }}
                items={NAV_ITEMS.map(({ label, sectionId, icon: Icon }) => ({
                    label,
                    icon: <Icon strokeWidth={1.8} />,
                    onSelect: () => scrollToSection(sectionId),
                }))}
            />
        </div>
    );
}
