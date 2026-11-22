'use client';

import { useRef } from 'react';
import { flushSync } from 'react-dom';
import gsap from 'gsap';
import { Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '@/components/ThemeProvider';
import { SPRING_UI } from '@/lib/motion';
import { cn } from '@/lib/utils';

type ViewTransition = { ready: Promise<void>; finished: Promise<void> };
type DocumentWithTransitions = Document & {
    startViewTransition?: (update: () => void) => ViewTransition;
};

/** The new theme spreads from the button as a growing circle. */
const REVEAL_MS = 760;
const REVEAL_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';

const ICON =
    'absolute size-[18px] transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none';

interface Props {
    className?: string;
    /** Tile side in px; matches the nav tiles beside it. */
    size?: number;
}

/**
 * Light / dark switch, styled as one of the nav tiles.
 *
 * Switching uses the View Transitions API: the browser freezes the old page
 * as a picture, the theme flips underneath, and the new theme is revealed as
 * a circle growing out of the button until it covers the screen. Browsers
 * without the API, and visitors who prefer reduced motion, switch at once.
 */
export default function ThemeToggle({ className, size = 56 }: Props) {
    const { theme, setTheme } = useTheme();
    const ref = useRef<HTMLButtonElement>(null);
    const toLight = theme === 'dark';

    const press = (down: boolean) => {
        const button = ref.current;
        if (
            !button ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            return;
        }
        gsap.to(button, {
            scale: down ? 0.9 : 1,
            duration: down ? 0.09 : SPRING_UI.duration,
            ease: down ? 'none' : SPRING_UI.ease,
            overwrite: 'auto',
        });
    };

    const toggle = () => {
        const next: Theme = toLight ? 'light' : 'dark';
        const doc = document as DocumentWithTransitions;
        const button = ref.current;
        const still = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;

        if (!doc.startViewTransition || still || !button) {
            setTheme(next);
            return;
        }

        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        // Far enough to cover the farthest corner of the screen.
        const radius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y),
        );

        const transition = doc.startViewTransition(() => {
            // Commit the new theme synchronously so the browser captures the
            // finished page (React also runs the recolour effects of a sync
            // render before returning).
            flushSync(() => setTheme(next));
        });

        transition.ready
            .then(() => {
                document.documentElement.animate(
                    {
                        clipPath: [
                            `circle(0px at ${x}px ${y}px)`,
                            `circle(${radius}px at ${x}px ${y}px)`,
                        ],
                    },
                    {
                        duration: REVEAL_MS,
                        easing: REVEAL_EASE,
                        pseudoElement: '::view-transition-new(root)',
                    },
                );
            })
            // A skipped transition (e.g. the tab went to the background)
            // still applied the theme; nothing to animate.
            .catch(() => {});
    };

    return (
        <button
            ref={ref}
            type="button"
            onClick={toggle}
            onPointerDown={() => press(true)}
            onPointerUp={() => press(false)}
            onPointerLeave={() => press(false)}
            onPointerCancel={() => press(false)}
            aria-label={toLight ? 'Switch to light theme' : 'Switch to dark theme'}
            title={toLight ? 'Light theme' : 'Dark theme'}
            data-avatar="theme"
            data-avatar-label={toLight ? 'Light theme' : 'Dark theme'}
            style={{ width: size, height: size }}
            className={cn(
                'relative grid place-items-center rounded-[10px] bg-[color-mix(in_oklab,hsl(var(--foreground))_8%,hsl(var(--background)))] text-foreground backdrop-blur-md transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                className,
            )}
        >
            {/* The icon shows where the switch goes: a sun in the dark, a
                moon in the light. They turn past each other as they swap. */}
            <Sun
                aria-hidden
                strokeWidth={1.8}
                className={cn(
                    ICON,
                    toLight
                        ? 'rotate-0 scale-100 opacity-100'
                        : '-rotate-90 scale-50 opacity-0',
                )}
            />
            <Moon
                aria-hidden
                strokeWidth={1.8}
                className={cn(
                    ICON,
                    toLight
                        ? 'rotate-90 scale-50 opacity-0'
                        : 'rotate-0 scale-100 opacity-100',
                )}
            />
        </button>
    );
}
