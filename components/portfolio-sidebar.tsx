'use client';

import { useEffect, useState } from 'react';
import { useLenis } from 'lenis/react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
    CalendarDays,
    FileText,
    Layers3,
    LayoutGrid,
    UsersRound,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
    label: string;
    /** Section id on the home page to scroll to. */
    sectionId: string;
    icon: LucideIcon;
}

/**
 * The rail never navigates to other routes: each item scrolls to its section
 * on the page, like the original section pills. Ids are the real section ids
 * on the home page (`Banner`, `SelectedWork`, `Skills`, `Experiences`, `Footer`).
 */
const NAV_ITEMS: readonly NavItem[] = [
    { label: 'Intro', sectionId: 'banner', icon: LayoutGrid },
    { label: 'Projects', sectionId: 'my-projects', icon: FileText },
    { label: 'Stack', sectionId: 'my-stack', icon: Layers3 },
    { label: 'Experience', sectionId: 'my-experience', icon: CalendarDays },
    { label: 'Contact Me', sectionId: 'contact', icon: UsersRound },
];

/**
 * The desktop rail is transparent and always expanded; no background panel,
 * no border, no collapse. `pointer-events-none` on the shell keeps the
 * invisible 216px strip from blocking the page behind it; each link opts back
 * in so only the rows themselves are interactive.
 */
const SIDEBAR_BASE =
    'fixed z-[4] pointer-events-none text-foreground transition-colors duration-200 motion-reduce:transition-none';

const LINK_BASE =
    'group/nav relative flex h-12 w-full items-center overflow-hidden rounded-[12px] pointer-events-auto transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const LINK_STATE = (isActive: boolean) =>
    cn(
        isActive
            ? 'text-primary-foreground'
            : 'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground',
    );

const ICON_SIZE = 17;
const ICON_STROKE = 1.8;

/**
 * The sliding highlight behind the active item. Each nav (desktop rail and
 * mobile bar) has its own `layoutId`, so the pill glides between items within
 * that nav only. Reduced-motion users get an instant switch.
 */
const ActivePill = ({
    layoutId,
    radius,
}: {
    layoutId: string;
    radius: string;
}) => {
    const reduceMotion = useReducedMotion();

    return (
        <motion.span
            layoutId={layoutId}
            aria-hidden="true"
            className={cn(
                'absolute inset-0 bg-primary shadow-[0_0_24px_hsl(var(--primary)/0.16)]',
                radius,
            )}
            transition={
                reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 380, damping: 32 }
            }
        />
    );
};

/** Fixed 32px icon column, so the icon never shifts relative to the label. */
const IconCell = ({ icon: Icon }: { icon: LucideIcon }) => (
    <span className="relative flex w-[32px] shrink-0 items-center justify-center">
        <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
    </span>
);

const Label = ({ label }: { label: string }) => (
    <span
        aria-hidden="true"
        className="relative whitespace-nowrap pl-2 text-[12px] font-medium leading-none"
    >
        {label}
    </span>
);

export default function PortfolioSidebar() {
    const lenis = useLenis();
    const pathname = usePathname();
    const router = useRouter();
    // Intro is the default active item until the scroll position says otherwise.
    const [activeId, setActiveId] = useState<string>(NAV_ITEMS[0].sectionId);

    // Active section is derived from the real scroll position: the last
    // section whose top has crossed the upper part of the viewport owns the
    // highlight. This never skips a section, unlike an intersection band.
    useEffect(() => {
        let frame = 0;

        const update = () => {
            frame = 0;

            const sections = NAV_ITEMS.filter(
                ({ sectionId }) => document.getElementById(sectionId) !== null,
            );

            // On pages without the home sections (case studies), keep Intro.
            if (sections.length === 0) {
                setActiveId(NAV_ITEMS[0].sectionId);
                return;
            }

            const line = window.innerHeight * 0.45;
            let current = sections[0].sectionId;

            for (const { sectionId } of sections) {
                const el = document.getElementById(sectionId);
                if (el && el.getBoundingClientRect().top <= line) {
                    current = sectionId;
                }
            }

            // At the very bottom, the last section (Contact) always wins.
            const atBottom =
                window.innerHeight + window.scrollY >=
                document.documentElement.scrollHeight - 4;
            if (atBottom) {
                current = sections[sections.length - 1].sectionId;
            }

            setActiveId(current);
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

    // Lenis owns the page scroll; native scrollIntoView fights it, so
    // navigation must go through lenis.scrollTo to land accurately.
    const scrollToSection = (sectionId: string) => {
        const el = document.getElementById(sectionId);

        // On a case study page the sections live on the home page, so go there
        // with the section as the hash; the hash effect below scrolls to it.
        if (!el) {
            router.push(`/#${sectionId}`);
            return;
        }

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

    // Arriving on the home page with a section hash (from a case study page)
    // scrolls to that section once the preloader has finished.
    useEffect(() => {
        const id = window.location.hash.slice(1);
        if (!id || !document.getElementById(id)) return;

        const timer = window.setTimeout(() => {
            const el = document.getElementById(id);
            if (!el) return;
            if (lenis) {
                lenis.scrollTo(el, { duration: 1.4, offset: -24 });
            } else {
                el.scrollIntoView({ behavior: 'smooth' });
            }
        }, 1500);

        return () => window.clearTimeout(timer);
    }, [pathname, lenis]);

    return (
        <>
            {/* Desktop / tablet: fixed left rail, always expanded, vertically centred. */}
            <nav
                aria-label="Main navigation"
                data-avatar-keepout=""
                className={cn(
                    SIDEBAR_BASE,
                    'group/sidebar hidden top-0 left-0 h-dvh w-[148px] flex-col justify-center px-2 lg:flex',
                )}
            >
                <ul className="flex w-full flex-col gap-1.5">
                    {NAV_ITEMS.map(({ label, sectionId, icon }) => {
                        const isActive = activeId === sectionId;

                        return (
                            <li key={label} className="w-full">
                                <button
                                    type="button"
                                    onClick={() => scrollToSection(sectionId)}
                                    aria-label={label}
                                    aria-current={isActive ? 'page' : undefined}
                                    data-avatar="nav"
                                    data-avatar-label={label}
                                    className={cn(LINK_BASE, LINK_STATE(isActive))}
                                >
                                    {isActive && (
                                        <ActivePill
                                            layoutId="nav-pill-desktop"
                                            radius="rounded-[12px]"
                                        />
                                    )}
                                    <IconCell icon={icon} />
                                    <Label label={label} />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Mobile: compact bottom bar. Same icons, labels, colors and active state. */}
            <nav
                aria-label="Main navigation"
                data-avatar-keepout=""
                className={cn(
                    'fixed z-[4] bg-sidebar text-foreground',
                    'inset-x-0 bottom-0 flex h-[68px] w-full items-stretch',
                    'border-t border-white/[0.18] px-1.5 lg:hidden',
                )}
            >
                <ul className="flex w-full items-stretch justify-between gap-0.5">
                    {NAV_ITEMS.map(({ label, sectionId, icon: Icon }) => {
                        const isActive = activeId === sectionId;

                        return (
                            <li key={label} className="flex-1">
                                <button
                                    type="button"
                                    onClick={() => scrollToSection(sectionId)}
                                    aria-label={label}
                                    aria-current={isActive ? 'page' : undefined}
                                    data-avatar="nav"
                                    data-avatar-label={label}
                                    className={cn(
                                        'relative flex h-full min-h-[56px] w-full flex-col items-center justify-center gap-1.5 rounded-[14px] px-1',
                                        'transition-colors duration-200 motion-reduce:transition-none',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
                                        LINK_STATE(isActive),
                                    )}
                                >
                                    {isActive && (
                                        <ActivePill
                                            layoutId="nav-pill-mobile"
                                            radius="rounded-[14px]"
                                        />
                                    )}
                                    <Icon
                                        size={18}
                                        strokeWidth={ICON_STROKE}
                                        aria-hidden="true"
                                        className="relative"
                                    />
                                    <span
                                        aria-hidden="true"
                                        className="relative w-full truncate text-center text-[10px] font-medium leading-none"
                                    >
                                        {label}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </nav>
        </>
    );
}
