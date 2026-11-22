import type Lenis from 'lenis';

/**
 * Scrolls to a home-page section the same way from everywhere (top nav,
 * Onee's shortcuts, deep links), landing exactly on the section's top edge.
 * Sections carry their own top padding, and the projects stack starts its
 * pinned screen at that edge, so an extra offset would stop short of it.
 *
 * Returns false when the section is not on this page.
 */
export const scrollToSection = (
    lenis: Lenis | undefined,
    id: string,
    { duration = 1.4 }: { duration?: number } = {},
): boolean => {
    const el = document.getElementById(id);
    if (!el) return false;

    const top = el.getBoundingClientRect().top + window.scrollY;

    if (lenis) {
        lenis.scrollTo(top, {
            duration,
            easing: (t) => 1 - Math.pow(1 - t, 4),
        });
    } else {
        window.scrollTo({ top, behavior: 'smooth' });
    }

    return true;
};
