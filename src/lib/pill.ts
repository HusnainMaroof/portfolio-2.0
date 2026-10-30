import { cn } from '@/lib/utils';

/**
 * Shared pill button styles:
 * 12px radius, muted text that lifts on a faint white wash, and a solid
 * primary fill for the active/primary state.
 */
export const PILL_BASE =
    'inline-flex items-center justify-center gap-2 rounded-[12px] text-sm transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40';

/** Resting pill: faint wash so it reads as a button outside the rail. */
export const PILL_IDLE =
    'bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground';

/** Active or primary pill: the sidebar's selected state. */
export const PILL_ACTIVE =
    'bg-primary text-primary-foreground hover:bg-primary/90';

export const pill = (active = false, className?: string) =>
    cn(PILL_BASE, active ? PILL_ACTIVE : PILL_IDLE, className);
