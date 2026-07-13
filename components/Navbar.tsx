'use client';
import { cn } from '@/lib/utils';
import { useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, MoonStar, SunMedium, X } from 'lucide-react';
import gsap from 'gsap';
import { GENERAL_INFO } from '@/lib/data';
import { useTheme } from '@/components/ThemeProvider';

const MENU_LINKS = [
    { name: 'About Me', url: '/#about-me' },
    { name: 'Services', url: '/#services' },
    { name: 'Projects', url: '/#selected-projects' },
    { name: 'Contact', url: '/#contact' },
];

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { theme, toggleTheme } = useTheme();
    const router = useRouter();

    const panelRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
    const tlRef = useRef<gsap.core.Timeline | null>(null);

    // Build the open/close timeline once, play it forward/backward on toggle.
    useLayoutEffect(() => {
        const panel = panelRef.current;
        const list = listRef.current;
        const items = itemRefs.current.filter(Boolean) as HTMLLIElement[];
        if (!panel || !list) return;

        const ctx = gsap.context(() => {
            gsap.set(items, { opacity: 0, y: 10 });
            gsap.set(list, { opacity: 0 });

            const tl = gsap.timeline({ paused: true });

            tl.to(panel, {
                height: 'auto',
                duration: 0.5,
                ease: 'power3.inOut',
            })
                .to(list, { opacity: 1, duration: 0.15 }, '-=0.2')
                .to(
                    items,
                    {
                        opacity: 1,
                        y: 0,
                        duration: 0.4,
                        stagger: 0.06,
                        ease: 'power3.out',
                    },
                    '-=0.25',
                );

            tlRef.current = tl;
        }, panel);

        return () => ctx.revert();
    }, []);

    useLayoutEffect(() => {
        const tl = tlRef.current;
        if (!tl) return;
        if (isOpen) {
            tl.timeScale(1).play();
        } else {
            tl.timeScale(1.4).reverse();
        }
    }, [isOpen]);

    const handleNavigate = (url: string) => {
        setIsOpen(false);
        router.push(url);
    };

    return (
        // Root sits at z-[4] — the same top-most layer your old sticky nav
        // wrapper used, so it stacks above any z-[2]/z-[3] overlays elsewhere
        // on the site without needing its own separate overlay/backdrop layers.
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[4]">
            <div
                ref={panelRef}
                className="w-[300px] rounded-[14px] bg-foreground text-background overflow-hidden shadow-xl"
                style={{ height: 64 }}
            >
                {/* Top row: name + toggle, height matches the collapsed pill (64px) */}
                <div className="h-16 flex items-center justify-between pl-6 pr-3">
                    <span className="font-semibold text-lg tracking-tight">
                        {GENERAL_INFO.Name}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            aria-label={`Switch to ${
                                theme === 'dark' ? 'light' : 'dark'
                            } theme`}
                            onClick={toggleTheme}
                            className="group size-10 shrink-0 rounded-2xl border border-border/60 bg-background/85 text-foreground flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:bg-foreground hover:text-background hover:border-foreground active:scale-90"
                        >
                            <span className="transition-transform duration-300 group-hover:rotate-12">
                                {theme === 'dark' ? (
                                    <SunMedium size={18} />
                                ) : (
                                    <MoonStar size={18} />
                                )}
                            </span>
                        </button>
                        <button
                            aria-label={isOpen ? 'Close menu' : 'Open menu'}
                            onClick={() => setIsOpen((prev) => !prev)}
                            className="group size-10 shrink-0 rounded-2xl bg-background text-foreground flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:bg-foreground hover:text-background active:scale-90"
                        >
                            <span className="transition-transform duration-300 group-hover:rotate-90">
                                {isOpen ? <X size={18} /> : <Menu size={18} />}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Links list, revealed as the panel grows */}
                <ul
                    ref={listRef}
                    className="flex flex-wrap gap-4 w-full px-6 pb-7 pt-1"
                >
                    {MENU_LINKS.map((link, idx) => (
                        <li
                            key={link.name}
                            ref={(el) => {
                                itemRefs.current[idx] = el;
                            }}
                        >
                            <button
                                onClick={() => handleNavigate(link.url)}
                                className={cn(
                                    'text-left rounded-xl bg-background text-foreground px-5 py-2.5 text-sm font-medium',
                                    'transition-all duration-300 ease-out',
                                    'hover:-translate-y-0.5 hover:shadow-md hover:pl-6 hover:bg-foreground hover:text-background',
                                )}
                            >
                                {link.name}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default Navbar;
