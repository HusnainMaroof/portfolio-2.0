'use client';

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useLenis } from 'lenis/react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import {
    Onee,
    type AnimationName,
    type AvatarHandle,
} from '@/Onee_avatar/onee.index';
import {
    AVATAR_GREETINGS,
    AVATAR_HOME_ANIMATION,
    AVATAR_SELF_MESSAGES,
    PREFERRED_SIDES,
    createMessageBags,
    drawMessage,
    findAvatarTrigger,
    messageFor,
    resolveReaction,
    triggerKey,
    type AvatarTrigger,
    type MessageBag,
} from '@/lib/avatar-interactions';
import {
    AVATAR_EDGE as EDGE,
    boxFromRect,
    clampPoint,
    clipToViewport,
    collectObstacles,
    placeAvatar,
    placeOverlay,
    type Box,
    type Choice,
    type Plan,
    type Point,
    type Size,
} from '@/lib/avatar-placement';

gsap.registerPlugin(SplitText);

const MESSAGE_W = 200;
const PANEL_W = 240;
/** Planning estimate for the first line; the real box is measured after render. */
const MESSAGE_ESTIMATE: Size = { width: MESSAGE_W, height: 72 };
const PANEL_ID = 'avatar-assistant-panel';
const AVATAR_DESKTOP = 112;
const AVATAR_MOBILE = 84;
const MOBILE_BREAKPOINT = 768;
const REACH_PX = 260;
/** Hover intent: the line appears only after the pointer has settled on a target. */
const DWELL_MS = 160;
const TYPING_MS = 450;
const CHAR_STAGGER = 0.018;
/** Minimum gap before the same target can speak again. */
const MESSAGE_COOLDOWN_MS = 1500;
/** Slow, eased travel: the avatar glides instead of snapping between targets. */
const TRAVEL_S = 1.15;
const FOLLOW_S = 0.35;
/**
 * A hop never starts until the previous one has landed and this beat has
 * passed, so retargeting mid-flight queues instead of fighting the tween.
 */
const ARRIVE_GAP_MS = 260;
const GREETING_DELAY_MS = 4000;
const GREETING_HOLD_MS = 7000;
/** Destinations closer than this are treated as unchanged: no new tween. */
const RETARGET_PX = 4;
const FADE_S = 0.28;
const PANEL_S = 0.2;
const OPEN_ANIMATION: AnimationName = 'happy';

/** Quick-action targets must be real section IDs. Actions whose target is missing are omitted. */
const QUICK_ACTIONS: readonly { label: string; targetId: string }[] = [
    { label: 'Show my projects', targetId: 'my-projects' },
    // No reviews section exists yet; this option appears automatically once one is added.
    { label: 'Show client reviews', targetId: 'client-reviews' },
    { label: 'Tell me about my experience', targetId: 'my-experience' },
    { label: 'Show my skills', targetId: 'my-stack' },
    { label: "Let's get in touch", targetId: 'contact' },
];

interface QuickAction {
    label: string;
    /** Section to scroll to. */
    targetId?: string;
    /** Real route to open instead of scrolling. */
    href?: string;
}

interface View {
    animation: AnimationName;
    label: string | null;
}

interface Layout {
    /** Rectangles the overlays must avoid: the target and nearby content. */
    avoid: Box[];
    choice: Choice | null;
}

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));

const avatarSize = () =>
    window.innerWidth < MOBILE_BREAKPOINT ? AVATAR_MOBILE : AVATAR_DESKTOP;

const viewportSize = (): Size => ({
    width: window.innerWidth,
    height: window.innerHeight,
});

const NAV_BAR_HEIGHT = 68;
const NAV_BAR_BREAKPOINT = 1024;

/** Home is the bottom-right corner of the viewport, clear of the centred navbar. */
const homeFor = (size: number): Point => ({
    x: window.innerWidth - size - EDGE,
    y:
        window.innerHeight -
        size -
        EDGE -
        (window.innerWidth < NAV_BAR_BREAKPOINT ? NAV_BAR_HEIGHT : 0),
});

/**
 * Plans where the avatar should sit for one target. Uses the target's visible
 * box, the measured neighbours, and the overlay's real size, and returns null
 * when the target is entirely outside the viewport.
 */
const planFor = (
    element: HTMLElement,
    root: HTMLElement,
    trigger: AvatarTrigger,
    overlay: Size,
    previous: Choice | null,
): Plan | null => {
    const viewport = viewportSize();
    const target = clipToViewport(
        boxFromRect(element.getBoundingClientRect()),
        viewport,
    );

    if (!target) return null;

    return placeAvatar({
        target,
        avatarSize: avatarSize(),
        overlay,
        viewport,
        obstacles: collectObstacles(element, root, viewport),
        preferred: PREFERRED_SIDES[trigger.kind],
        previous,
    });
};

const AvatarInteractions = () => {
    const rootRef = useRef<HTMLDivElement>(null);
    const avatarBoxRef = useRef<HTMLButtonElement>(null);
    const avatarRef = useRef<AvatarHandle>(null);
    const messageRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLParagraphElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const lenis = useLenis();
    const router = useRouter();

    // Logic state lives in refs so pointer and scroll handling never re-renders.
    // activeRef is the last target the avatar moved to; it stays set after the
    // pointer leaves, so the avatar keeps its destination until an explicit reset.
    const activeRef = useRef<{
        element: HTMLElement;
        key: string;
        trigger: AvatarTrigger;
    } | null>(null);
    const homeRef = useRef<Point>({ x: 0, y: 0 });
    const destRef = useRef<Point>({ x: 0, y: 0 });
    const layoutRef = useRef<Layout>({ avoid: [], choice: null });
    const reducedRef = useRef(false);
    const panelOpenRef = useRef(false);
    const restingRef = useRef<AnimationName>(AVATAR_HOME_ANIMATION);
    /** Caption the avatar should restore once it stops talking about itself. */
    const restingLabelRef = useRef<string | null>(null);
    /** When the current hop lands (`performance.now()`); 0 means standing still. */
    const landingAtRef = useRef(0);
    const moveTimerRef = useRef<number | null>(null);
    const selfHoverRef = useRef(false);
    const visitsRef = useRef(new Map<string, number>());
    const lastMessageAtRef = useRef(new Map<string, number>());
    // Shuffle bags per message pool. Kept in a ref so they survive re-renders.
    const messageBagsRef = useRef<Map<string, MessageBag>>(createMessageBags());
    // Hover-message state. Independent of the panel; only the visibility gate reads panelOpenRef.
    const tokenRef = useRef(0);
    const splitRef = useRef<SplitText | null>(null);
    const messageTimerRef = useRef<number | null>(null);
    const messageActiveRef = useRef(false);

    const [reduced, setReduced] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const [actions, setActions] = useState<QuickAction[]>([]);
    const [typing, setTyping] = useState(false);
    const [view, setView] = useState<View>({
        animation: AVATAR_HOME_ANIMATION,
        label: null,
    });

    /**
     * Keeps the message and the panel beside the avatar, inside the viewport.
     * Each overlay is measured after its content changes and placed to avoid
     * the active target and its neighbours.
     */
    const placeOverlays = useCallback(() => {
        const dest = destRef.current;
        const size = avatarSize();
        const viewport = viewportSize();
        const { avoid } = layoutRef.current;
        const place = (box: HTMLElement | null, width: number) => {
            if (!box) return;

            const placed = placeOverlay(
                dest,
                size,
                { width, height: box.offsetHeight },
                viewport,
                avoid,
            );

            box.style.width = `${placed.width}px`;
            box.style.left = `${placed.left}px`;
            box.style.top = `${placed.top}px`;
        };

        place(messageRef.current, MESSAGE_W);
        place(panelRef.current, PANEL_W);
    }, []);

    /**
     * Moves the single avatar from wherever it currently is to a new point.
     * A hop in flight is never interrupted: a new destination waits for the
     * current one to land plus a short beat of stillness, which keeps the
     * motion free of mid-tween jumps.
     */
    const moveTo = useCallback(
        (dest: Point, duration: number) => {
            const root = rootRef.current;

            if (!root) return;

            // The destination is recorded at once, so re-planning compares
            // against the intent instead of the position still being left behind.
            destRef.current = dest;

            const start = () => {
                if (moveTimerRef.current !== null) {
                    window.clearTimeout(moveTimerRef.current);
                    moveTimerRef.current = null;
                }

                destRef.current = dest;
                const ms = reducedRef.current ? 0 : duration;

                landingAtRef.current = performance.now() + ms;
                // overwrite:true retargets from the live position, so redirects never snap.
                gsap.to(root, {
                    x: dest.x,
                    y: dest.y,
                    duration: ms,
                    ease: 'power2.inOut',
                    overwrite: true,
                    onComplete: () => {
                        landingAtRef.current = performance.now();
                        // The overlays belong to the destination, so they settle with it.
                        placeOverlays();
                    },
                });
                placeOverlays();
            };

            const readyAt = Math.max(
                landingAtRef.current + ARRIVE_GAP_MS,
                performance.now(),
            );

            if (reducedRef.current || readyAt <= performance.now()) {
                start();
            } else {
                if (moveTimerRef.current !== null) {
                    window.clearTimeout(moveTimerRef.current);
                }

                moveTimerRef.current = window.setTimeout(start, readyAt - performance.now());
            }
        },
        [placeOverlays],
    );

    /** Fades the hover message in or out. Hidden whenever the panel is open. */
    const showMessage = useCallback((visible: boolean) => {
        const box = messageRef.current;

        if (!box) return;

        const shown =
            visible && messageActiveRef.current && !panelOpenRef.current;

        gsap.to(box, {
            opacity: shown ? 1 : 0,
            scale: shown ? 1 : 0.96,
            duration: reducedRef.current ? 0 : FADE_S,
            ease: 'power2.out',
            overwrite: true,
        });
    }, []);

    /** Replaces the message text and resets any previous character reveal. */
    const setMessageText = useCallback(
        (text: string) => {
            const el = textRef.current;

            if (!el) return;

            if (splitRef.current) {
                gsap.killTweensOf(splitRef.current.chars);
                splitRef.current.revert();
                splitRef.current = null;
            }

            el.textContent = text;
            el.style.opacity = '0';
            placeOverlays();
        },
        [placeOverlays],
    );

    /** Character-by-character reveal, reusing the SplitText technique from HoverText. */
    const revealMessage = useCallback(() => {
        const el = textRef.current;

        if (!el) return;

        el.style.opacity = '1';

        // Words stay unbroken; characters reveal inside them.
        const split = SplitText.create(el, {
            type: 'words,chars',
            wordsClass: 'avatar-word',
            charsClass: 'avatar-char',
        });

        split.words.forEach((word) => {
            const wordEl = word as HTMLElement;

            wordEl.style.display = 'inline-block';
            wordEl.style.whiteSpace = 'nowrap';
        });
        split.chars.forEach((char) => {
            (char as HTMLElement).style.display = 'inline-block';
        });

        splitRef.current = split;
        gsap.fromTo(
            split.chars,
            { opacity: 0 },
            {
                opacity: 1,
                duration: reducedRef.current ? 0 : 0.12,
                stagger: reducedRef.current ? 0 : CHAR_STAGGER,
                ease: 'none',
                overwrite: true,
            },
        );
    }, []);

    const clearMessageTimer = useCallback(() => {
        if (messageTimerRef.current !== null) {
            window.clearTimeout(messageTimerRef.current);
            messageTimerRef.current = null;
        }
    }, []);

    /**
     * Shows `text` and reveals it. Only called from a dwell timer, so the
     * message appears once the pointer has settled and is never stale.
     */
    const showText = useCallback(
        (text: string, token: number) => {
            // A pending reveal from another trigger must not fire under this line.
            clearMessageTimer();
            messageActiveRef.current = true;
            setMessageText(text);
            setTyping(true);
            showMessage(true);
            messageTimerRef.current = window.setTimeout(
                () => {
                    messageTimerRef.current = null;
                    // A newer activation has already replaced this message.
                    if (token !== tokenRef.current) return;
                    setTyping(false);
                    revealMessage();
                },
                reducedRef.current ? 0 : TYPING_MS,
            );
        },
        [clearMessageTimer, revealMessage, setMessageText, showMessage],
    );

    /**
     * Hides the previous line at once, then picks the next line for this target
     * after the dwell delay. Moving through neighbours never shows a line, and
     * a line never appears before the avatar has finished its hop.
     */
    const scheduleMessage = useCallback(
        (trigger: AvatarTrigger, visit: number, token: number) => {
            clearMessageTimer();
            messageActiveRef.current = false;
            setTyping(false);
            showMessage(false);

            // Wait out the pointer settling *and* the avatar landing, so the
            // bubble never pops in while the avatar is still travelling.
            const wait = reducedRef.current
                ? 0
                : Math.max(
                      DWELL_MS,
                      landingAtRef.current + ARRIVE_GAP_MS - performance.now(),
                  );

            messageTimerRef.current = window.setTimeout(
                () => {
                    messageTimerRef.current = null;
                    if (token !== tokenRef.current) return;

                    const key = triggerKey(trigger);
                    const now = performance.now();
                    const cooledDown =
                        now - (lastMessageAtRef.current.get(key) ?? -Infinity) >=
                        MESSAGE_COOLDOWN_MS;

                    if (!cooledDown) return;

                    const text = messageFor(
                        trigger,
                        visit,
                        messageBagsRef.current,
                    );

                    if (!text) return;

                    lastMessageAtRef.current.set(key, now);
                    showText(text, token);
                },
                wait,
            );
        },
        [clearMessageTimer, showMessage, showText],
    );

    /** One line from Onee itself, guarded by the same reveal token as the rest. */
    const speak = useCallback(
        (text: string) => {
            const token = ++tokenRef.current;

            showText(text, token);

            return token;
        },
        [showText],
    );

    /**
     * Hovering Onee itself: a fresh line every time (shuffle bag, no repeats
     * until the pool cycled) and a livelier pose while the pointer stays.
     */
    const onSelfHover = useCallback(() => {
        if (selfHoverRef.current || panelOpenRef.current) return;

        selfHoverRef.current = true;

        const line = drawMessage(
            messageBagsRef.current,
            'onee:self',
            AVATAR_SELF_MESSAGES,
        );

        if (!line) return;

        setView({ animation: 'playful', label: null });
        speak(line);
    }, [speak]);

    /** Leaves Onee back to whatever it was doing before the hover. */
    const onSelfLeave = useCallback(() => {
        selfHoverRef.current = false;

        if (panelOpenRef.current) return;

        setView({
            animation: restingRef.current,
            label: restingLabelRef.current,
        });
    }, []);

    /** Opens or closes the quick-action panel. Never moves the avatar. */
    const setPanel = useCallback(
        (open: boolean) => {
            const panel = panelRef.current;

            if (!panel || panelOpenRef.current === open) return;

            panelOpenRef.current = open;
            setPanelOpen(open);
            gsap.killTweensOf(panel);

            const instant = reducedRef.current;

            if (open) {
                // The active project, if any, gives the assistant a real case study to open.
                const slug = activeRef.current?.trigger.slug;
                const caseStudy: QuickAction[] = slug
                    ? [{ label: 'Open case study', href: `/projects/${slug}` }]
                    : [];

                setActions([
                    ...caseStudy,
                    ...QUICK_ACTIONS.filter((action) =>
                        document.getElementById(action.targetId),
                    ),
                ]);
                setView((prev) => ({ ...prev, animation: OPEN_ANIMATION }));
                gsap.set(panel, { visibility: 'visible' });
                gsap.fromTo(
                    panel,
                    { opacity: 0, y: 6, scale: 0.98 },
                    {
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        duration: instant ? 0 : PANEL_S,
                        ease: 'power2.out',
                    },
                );
                // The message and panel share the same spot, so the message yields.
                showMessage(false);
            } else {
                setView((prev) => ({ ...prev, animation: restingRef.current }));
                gsap.to(panel, {
                    opacity: 0,
                    y: 6,
                    scale: 0.98,
                    duration: instant ? 0 : PANEL_S,
                    ease: 'power2.in',
                    onComplete: () => {
                        gsap.set(panel, { visibility: 'hidden' });
                    },
                });
                // Hover messages resume on their own once the panel closes.
                showMessage(true);
            }
        },
        [showMessage],
    );

    /** Switches the same avatar to a new registered target. Hover within a target is a no-op. */
    const activate = useCallback(
        (element: HTMLElement, trigger: AvatarTrigger) => {
            const root = rootRef.current;

            if (!root || activeRef.current?.element === element) return;

            const key = triggerKey(trigger);
            const visit = visitsRef.current.get(key) ?? 0;
            const plan = planFor(
                element,
                root,
                trigger,
                MESSAGE_ESTIMATE,
                layoutRef.current.choice,
            );

            if (!plan) return;

            visitsRef.current.set(key, visit + 1);

            const reaction = resolveReaction(trigger, visit);

            activeRef.current = { element, key, trigger };
            restingRef.current = reaction.animation;
            restingLabelRef.current = reaction.label;
            layoutRef.current = {
                avoid: plan.avoid,
                choice: { side: plan.side, along: plan.along },
            };

            const token = ++tokenRef.current;

            setView((prev) => ({
                // The panel keeps its own animation, and so does a hover on Onee itself.
                animation:
                    panelOpenRef.current || selfHoverRef.current
                        ? prev.animation
                        : reaction.animation,
                label: selfHoverRef.current ? null : reaction.label,
            }));
            moveTo(plan.point, TRAVEL_S);
            scheduleMessage(trigger, visit, token);
        },
        [moveTo, scheduleMessage],
    );

    /** Explicit reset only (Escape). Leaving a target never calls this. */
    const reset = useCallback(() => {
        if (!activeRef.current) return;

        activeRef.current = null;
        tokenRef.current++;
        clearMessageTimer();
        messageActiveRef.current = false;
        restingRef.current = AVATAR_HOME_ANIMATION;
        restingLabelRef.current = null;
        layoutRef.current = { avoid: [], choice: null };
        setTyping(false);
        showMessage(false);
        setView({ animation: AVATAR_HOME_ANIMATION, label: null });
        moveTo(homeRef.current, TRAVEL_S);
    }, [clearMessageTimer, moveTo, showMessage]);

    /** Re-plans the active target after scroll, resize, or layout changes. Holds position if the target is off-screen. */
    const follow = useCallback(() => {
        const active = activeRef.current;
        const root = rootRef.current;

        if (!active || !root) return;

        // Always plan with the fixed estimate. A live overlay height would move the
        // avatar every time a line appears, hides, or changes length.
        const plan = planFor(
            active.element,
            root,
            active.trigger,
            MESSAGE_ESTIMATE,
            layoutRef.current.choice,
        );

        if (plan) {
            layoutRef.current = {
                avoid: plan.avoid,
                choice: { side: plan.side, along: plan.along },
            };
            const dest = destRef.current;

            // Same destination: no new tween, only re-measure the overlays.
            if (
                Math.abs(plan.point.x - dest.x) < RETARGET_PX &&
                Math.abs(plan.point.y - dest.y) < RETARGET_PX
            ) {
                placeOverlays();
            } else {
                moveTo(plan.point, FOLLOW_S);
            }
        } else {
            moveTo(
                clampPoint(destRef.current, avatarSize(), viewportSize()),
                FOLLOW_S,
            );
        }
    }, [moveTo, placeOverlays]);

    const runAction = (action: QuickAction) => {
        setPanel(false);

        if (action.href) {
            router.push(action.href);
            return;
        }

        const el = document.getElementById(action.targetId ?? '');

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

    // Overlay layout is recalculated whenever their contents change.
    useLayoutEffect(() => {
        placeOverlays();
    }, [view, typing, actions, placeOverlays]);

    /**
     * One cute line shortly after a reload, so Onee greets the visitor before
     * anything is hovered. It steps down on its own, or sooner if the visitor
     * starts interacting with the avatar.
     */
    useEffect(() => {
        let holdTimer: number | null = null;

        const greetTimer = window.setTimeout(() => {
            // Skip when the visitor is already busy with the avatar.
            if (
                activeRef.current ||
                panelOpenRef.current ||
                messageActiveRef.current
            ) {
                return;
            }

            const line =
                AVATAR_GREETINGS[
                    Math.floor(Math.random() * AVATAR_GREETINGS.length)
                ];

            if (!line) return;

            const token = speak(line);

            holdTimer = window.setTimeout(() => {
                if (token !== tokenRef.current) return;

                messageActiveRef.current = false;
                setTyping(false);
                showMessage(false);
            }, GREETING_HOLD_MS);
        }, GREETING_DELAY_MS);

        return () => {
            window.clearTimeout(greetTimer);
            if (holdTimer !== null) window.clearTimeout(holdTimer);
        };
    }, [showMessage, speak]);

    useEffect(() => {
        const root = rootRef.current;

        if (!root) return;

        const reduceQuery = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        );
        const syncReduced = () => {
            reducedRef.current = reduceQuery.matches;
            setReduced(reduceQuery.matches);
        };

        syncReduced();
        reduceQuery.addEventListener('change', syncReduced);

        const applySize = () => {
            const size = avatarSize();

            root.style.width = `${size}px`;
            root.style.height = `${size}px`;

            if (avatarBoxRef.current) {
                avatarBoxRef.current.style.width = `${size}px`;
                avatarBoxRef.current.style.height = `${size}px`;
            }
        };

        applySize();
        homeRef.current = homeFor(avatarSize());
        moveTo(homeRef.current, 0);

        // Mouse drives the gaze and hover activation. Touch and pen get tap activation below.
        const onPointerOver = (event: PointerEvent) => {
            if (event.pointerType !== 'mouse') return;

            const found = findAvatarTrigger(event.target);

            if (found) activate(found.element, found.trigger);
        };

        const onPointerMove = (event: PointerEvent) => {
            if (event.pointerType !== 'mouse' || reducedRef.current) return;

            const size = avatarSize();
            const cx = Number(gsap.getProperty(root, 'x')) + size / 2;
            const cy = Number(gsap.getProperty(root, 'y')) + size / 2;

            avatarRef.current?.look(
                clamp((event.clientX - cx) / REACH_PX, -1, 1),
                clamp((event.clientY - cy) / REACH_PX, -1, 1),
            );
        };

        const onPointerDown = (event: PointerEvent) => {
            // Clicking outside the panel closes it; clicks inside (including actions) are left alone.
            const inside =
                event.target instanceof Node && root.contains(event.target);

            if (panelOpenRef.current && !inside) setPanel(false);

            if (event.pointerType === 'mouse') return;

            const found = findAvatarTrigger(event.target);

            if (found) activate(found.element, found.trigger);
        };

        const onFocusIn = (event: FocusEvent) => {
            const found = findAvatarTrigger(event.target);

            if (found) activate(found.element, found.trigger);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;

            if (panelOpenRef.current) setPanel(false);
            else reset();
        };

        // Scroll, resize, and layout shifts all funnel through one frame-throttled re-plan.
        let frame = 0;
        const scheduleFollow = () => {
            if (frame) return;

            frame = requestAnimationFrame(() => {
                frame = 0;
                follow();
            });
        };

        const onResize = () => {
            applySize();

            if (activeRef.current) {
                scheduleFollow();
            } else {
                // Still at home: keep it in the corner for the new viewport size.
                homeRef.current = homeFor(avatarSize());
                layoutRef.current = { avoid: [], choice: null };
                moveTo(homeRef.current, 0);
            }
        };

        const layoutObserver =
            typeof ResizeObserver === 'undefined'
                ? null
                : new ResizeObserver(scheduleFollow);

        layoutObserver?.observe(document.body);

        document.addEventListener('pointerover', onPointerOver);
        document.addEventListener('pointermove', onPointerMove, {
            passive: true,
        });
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('scroll', scheduleFollow, { passive: true });
        window.addEventListener('resize', onResize);

        return () => {
            reduceQuery.removeEventListener('change', syncReduced);
            document.removeEventListener('pointerover', onPointerOver);
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('focusin', onFocusIn);
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('scroll', scheduleFollow);
            window.removeEventListener('resize', onResize);
            layoutObserver?.disconnect();

            if (frame) cancelAnimationFrame(frame);
            clearMessageTimer();
            if (moveTimerRef.current !== null) {
                window.clearTimeout(moveTimerRef.current);
                moveTimerRef.current = null;
            }

            tokenRef.current++;
            if (splitRef.current) {
                gsap.killTweensOf(splitRef.current.chars);
                splitRef.current.revert();
                splitRef.current = null;
            }
            gsap.killTweensOf(
                [root, messageRef.current, panelRef.current].filter(Boolean),
            );
        };
    }, [activate, clearMessageTimer, follow, moveTo, reset, setPanel]);

    const togglePanel = () => setPanel(!panelOpenRef.current);

    const dotClass =
        'size-1.5 rounded-full bg-muted-foreground animate-pulse motion-reduce:animate-none';

    return (
        <div
            ref={rootRef}
            className="pointer-events-none fixed left-0 top-0 z-[60]"
            style={{
                width: AVATAR_DESKTOP,
                height: AVATAR_DESKTOP,
                willChange: 'transform',
            }}
        >
            <button
                ref={avatarBoxRef}
                type="button"
                aria-label="Open portfolio assistant"
                aria-expanded={panelOpen}
                aria-controls={PANEL_ID}
                onClick={togglePanel}
                onPointerEnter={(event) => {
                    if (event.pointerType === 'mouse') onSelfHover();
                }}
                onPointerLeave={onSelfLeave}
                className="pointer-events-auto absolute inset-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                <Onee
                    ref={avatarRef}
                    animation={view.animation}
                    playing={!reduced}
                    size="100%"
                />
            </button>

            {/* Hover text: plain compact box, no container shape. Never interactive. */}
            <div
                ref={messageRef}
                data-avatar-message=""
                className="pointer-events-none absolute left-0 top-0 rounded-lg border border-border/60 bg-background-light px-3 py-2 text-sm leading-snug text-foreground opacity-0"
                style={{ width: MESSAGE_W, maxWidth: 'calc(100vw - 2rem)' }}
            >
                {view.label && (
                    <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {view.label}
                    </p>
                )}

                <div className="relative min-h-[1.25em]">
                    <p ref={textRef} className="opacity-0" />
                    <span
                        className={`absolute inset-0 items-center justify-center gap-1 ${typing ? 'flex' : 'hidden'}`}
                    >
                        <span className={dotClass} />
                        <span className={`${dotClass} [animation-delay:150ms]`} />
                        <span className={`${dotClass} [animation-delay:300ms]`} />
                    </span>
                </div>
            </div>

            <div
                ref={panelRef}
                id={PANEL_ID}
                role="dialog"
                aria-label="Portfolio assistant"
                className="pointer-events-auto invisible absolute left-0 top-0 rounded-2xl border border-border/60 bg-background-light p-4 text-foreground opacity-0"
                style={{ width: PANEL_W }}
            >
                <div className="mb-3 flex items-start justify-between gap-3">
                    <p className="text-sm leading-snug">
                        Hey! What would you like to explore?
                    </p>
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={() => setPanel(false)}
                        className="-mr-1 -mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <X size={14} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                </div>

                <ul className="flex flex-col gap-1.5">
                    {actions.map((action) => (
                        <li key={action.label}>
                            <button
                                type="button"
                                onClick={() => runAction(action)}
                                className="w-full rounded-lg border border-border/60 px-3 py-2 text-left text-sm text-muted-foreground transition-colors duration-150 hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {action.label}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default AvatarInteractions;
