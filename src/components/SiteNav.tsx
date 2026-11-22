'use client';

import { useEffect, useState } from 'react';
import { useLenis } from 'lenis/react';
import { usePathname, useRouter } from 'next/navigation';
import {
    BriefcaseBusiness,
    House,
    Layers3,
    LayoutGrid,
    Mail,
    type LucideIcon,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import StarsButton from '@/components/analytics/StarsButton';
import { ExpandTabs } from '@/components/ui/expand-tabs';
import { afterPreloader } from '@/lib/preloader';
import { scrollToSection } from '@/lib/scroll';

interface NavItem {
    label: string;
    /** Section id on the home page to scroll to. */
    sectionId: string;
    icon: LucideIcon;
}

/** The real section ids on the home page (Banner, SelectedWork, Skills, Experiences, Footer). */
const NAV_ITEMS: readonly NavItem[] = [
    { label: 'Intro', sectionId: 'banner', icon: House },
    { label: 'Projects', sectionId: 'my-projects', icon: LayoutGrid },
    { label: 'Stack', sectionId: 'my-stack', icon: Layers3 },
    { label: 'Experience', sectionId: 'my-experience', icon: BriefcaseBusiness },
    { label: 'Contact', sectionId: 'contact', icon: Mail },
];

/** From this width the current section's tile stays open on its label. */
const LABEL_QUERY = '(min-width: 640px)';

/**
 * Top-centre navigation (ExpandTabs). Each tile scrolls to its section; the
 * section on screen has its tile filled green (aria-current) and, from tablet
 * width up, open on its label, so the bar always says where you are. Phones
 * keep the compact icon row (five 56px tiles fit a 375px screen).
 */
export default function SiteNav() {
    const lenis = useLenis();
    const pathname = usePathname();
    const router = useRouter();
    // Only the home page has sections to mark. Starting at "Intro" on every
    // page flashed that tile green on case studies until the first update.
    const [active, setActive] = useState<number | null>(
        pathname === '/' ? 0 : null,
    );
    const [showLabel, setShowLabel] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const query = window.matchMedia(LABEL_QUERY);
        const sync = () => setShowLabel(query.matches);
        sync();
        query.addEventListener('change', sync);
        return () => query.removeEventListener('change', sync);
    }, []);

    // The last section whose top has crossed the upper part of the viewport
    // owns the tile. This never skips a section, unlike an intersection band.
    useEffect(() => {
        let frame = 0;

        const update = () => {
            frame = 0;
            setScrolled(window.scrollY > 24);

            // Only the home page (it has the hero) tracks sections. Other pages
            // (case studies, socials, resume) fill no tile; the footer's
            // #contact is on every page, so it can't decide this.
            if (!document.getElementById('banner')) return setActive(null);

            const present = NAV_ITEMS.map((item, i) => ({
                i,
                el: document.getElementById(item.sectionId),
            })).filter((s) => s.el);

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

    const goTo = (sectionId: string) => {
        // On a case study page the sections live on the home page.
        if (!scrollToSection(lenis, sectionId)) router.push(`/#${sectionId}`);
    };

    // Arriving with a section hash (/#my-projects) scrolls there once the
    // preloader has lifted, instead of after a guessed fixed delay.
    useEffect(() => {
        const id = window.location.hash.slice(1);
        if (!id || !document.getElementById(id)) return;

        let timer = 0;
        const stop = afterPreloader(() => {
            timer = window.setTimeout(() => scrollToSection(lenis, id), 250);
        });

        return () => {
            stop();
            window.clearTimeout(timer);
        };
    }, [pathname, lenis]);

    return (
        <>
            {/* A soft fade behind the bar once the page has scrolled, so text
                never runs straight under the tiles. */}
            <div
                aria-hidden
                className="pointer-events-none fixed inset-x-0 top-0 z-[49] h-24 bg-gradient-to-b from-background via-background/75 to-transparent transition-opacity duration-500 motion-reduce:transition-none"
                style={{ opacity: scrolled ? 1 : 0 }}
            />
            {/* Tablet and up: the theme switch has the top-right corner, with
                the star rating beside it from md (there is no room beside the
                centred bar below that; phones rate from the footer). */}
            <ThemeToggle className="fixed right-4 top-4 z-[51] hidden sm:grid md:right-6" />
            <StarsButton className="fixed right-[88px] top-4 z-[51] hidden md:block" />

            <div
                data-avatar-keepout=""
                className="pointer-events-none fixed inset-x-0 top-4 z-[50] flex items-center justify-center gap-1.5"
            >
                <ExpandTabs
                    label="Main navigation"
                    color="hsl(var(--primary))"
                    value={active}
                    onValueChange={setActive}
                    expandSelected={showLabel}
                    // Phones: a slightly smaller tile, so the theme switch
                    // fits in the same row (a corner tile would hit the bar).
                    tile={showLabel ? 56 : 48}
                    className="pointer-events-auto"
                    classNames={{
                        // White text is unreadable on the green, so the open label is dark.
                        label: 'font-roboto-flex font-medium text-primary-foreground',
                        tab: 'backdrop-blur-md',
                    }}
                    items={NAV_ITEMS.map(({ label, sectionId, icon: Icon }) => ({
                        label,
                        icon: <Icon strokeWidth={1.8} />,
                        onSelect: () => goTo(sectionId),
                    }))}
                />
                <ThemeToggle
                    size={48}
                    className="pointer-events-auto sm:hidden"
                />
            </div>
        </>
    );
}
