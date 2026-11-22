/**
 * When the hero sticks and the projects stack as sliding full-height panels.
 * Off for reduced motion and for screens too short to hold a pinned header
 * plus a project (a phone held sideways), where everything flows normally.
 *
 * KEEP IN SYNC with the matching @media block in src/app/globals.css.
 */
export const STACK_QUERY =
    '(prefers-reduced-motion: no-preference) and (min-height: 500px)';
