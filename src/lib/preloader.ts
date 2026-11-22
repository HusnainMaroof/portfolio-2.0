/**
 * The preloader's moments, in order:
 * - `hold`:   the name has landed; the curtain stays closed for a second.
 *             Quiet time to set up heavy things (WebGL) out of sight.
 * - `reveal`: the curtain starts lifting. Entrances should start here, so
 *             they play while the page is being uncovered, not after.
 * - `done`:   the curtain is gone and scrolling is unlocked.
 *
 * Preloader.tsx records the current stage on <html data-preloader-stage>
 * and fires `preloader:<stage>` events; `done` also sets data-preloaded.
 */
export type PreloaderStage = 'hold' | 'reveal' | 'done';

const ORDER: Record<PreloaderStage, number> = { hold: 0, reveal: 1, done: 2 };
const EVENTS = ['preloader:hold', 'preloader:reveal', 'preloader:done'];

/** Run anyway if the preloader never reports (it unmounted early, a hidden tab). */
const FALLBACK_MS: Record<PreloaderStage, number> = {
    hold: 2500,
    reveal: 4000,
    done: 6000,
};

const currentStage = (): number => {
    const root = document.documentElement;
    if (root.dataset.preloaded === 'true') return ORDER.done;
    const stage = root.dataset.preloaderStage as PreloaderStage | undefined;
    return stage ? ORDER[stage] : -1;
};

/**
 * Runs `run` once the preloader has reached `stage`, or at once if it already
 * has (client navigations, a remount). Returns a cancel function.
 */
export const afterPreloaderStage = (
    stage: PreloaderStage,
    run: () => void,
): (() => void) => {
    if (currentStage() >= ORDER[stage]) {
        run();
        return () => {};
    }

    let settled = false;
    const cleanup = () => {
        EVENTS.forEach((name) => window.removeEventListener(name, onStage));
        window.clearTimeout(fallback);
    };
    const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        run();
    };
    function onStage() {
        if (currentStage() >= ORDER[stage]) finish();
    }

    EVENTS.forEach((name) => window.addEventListener(name, onStage));
    const fallback = window.setTimeout(finish, FALLBACK_MS[stage]);

    return () => {
        settled = true;
        cleanup();
    };
};

/** Runs `run` once the preloader has fully finished (scroll unlocked). */
export const afterPreloader = (run: () => void) =>
    afterPreloaderStage('done', run);
