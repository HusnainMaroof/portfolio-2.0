/**
 * Target-aware placement for the Onee avatar.
 *
 * Geometry only: callers pass measured rectangles, so the scoring stays
 * deterministic and free of DOM reads except in `collectObstacles`.
 */

export interface Box {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface Point {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

export type Side = 'right' | 'left' | 'below' | 'above';

export interface Obstacle {
    box: Box;
    /** Higher weights are more costly to cover. */
    weight: number;
}

export interface Plan {
    point: Point;
    side: Side;
    along: number;
    /** Rectangles the overlays should steer clear of (target and obstacles). */
    avoid: Box[];
}

export interface OverlayPlacement {
    /** Offsets relative to the avatar's top-left corner. */
    left: number;
    top: number;
    width: number;
    height: number;
    above: boolean;
}

/** One scored candidate: a side plus where along that edge the avatar sits. */
export interface Choice {
    side: Side;
    along: number;
}

export const AVATAR_EDGE = 16;
export const AVATAR_GAP = 12;
export const OVERLAY_GAP = 10;

const HARD_BLOCK = 1e6;
/** A previous side is kept unless a different side is better by more than this. */
const HYSTERESIS = 24;
const OUT_OF_VIEW = 1e5;
const OVERLAP_UNIT = 100;
const TARGET_TEXT_PENALTY = 1000;
const SIDES: readonly Side[] = ['right', 'left', 'below', 'above'];
/** Where along the target edge the avatar sits: centre, start, end. */
const ALONG: readonly number[] = [0.5, 0, 1];

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

export const boxAt = (x: number, y: number, width: number, height: number): Box => ({
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
});

export const boxFromRect = (rect: Box): Box => ({
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
});

const area = (box: Box) =>
    Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top);

export const overlapArea = (a: Box, b: Box) =>
    area({
        left: Math.max(a.left, b.left),
        top: Math.max(a.top, b.top),
        right: Math.min(a.right, b.right),
        bottom: Math.min(a.bottom, b.bottom),
    });

/** The visible part of a box, or null when nothing of it is inside the viewport. */
export const clipToViewport = (box: Box, viewport: Size): Box | null => {
    const clipped = {
        left: Math.max(box.left, 0),
        top: Math.max(box.top, 0),
        right: Math.min(box.right, viewport.width),
        bottom: Math.min(box.bottom, viewport.height),
    };

    return area(clipped) > 0 ? clipped : null;
};

/** Keeps the whole avatar, including its rendered size, inside the viewport. */
export const clampPoint = (
    point: Point,
    avatarSize: number,
    viewport: Size,
): Point => ({
    x: clamp(point.x, AVATAR_EDGE, viewport.width - AVATAR_EDGE - avatarSize),
    y: clamp(point.y, AVATAR_EDGE, viewport.height - AVATAR_EDGE - avatarSize),
});

/**
 * Places a message or panel beside the avatar. It goes above when that fits
 * and does not cover more than the below option; the horizontal position is
 * centred on the avatar and clamped inside the viewport.
 */
export const placeOverlay = (
    point: Point,
    avatarSize: number,
    overlay: Size,
    viewport: Size,
    avoid: readonly Box[],
): OverlayPlacement => {
    const width = Math.max(
        0,
        Math.min(overlay.width, viewport.width - AVATAR_EDGE * 2),
    );
    const height = overlay.height;
    const x = clamp(
        point.x + avatarSize / 2 - width / 2,
        AVATAR_EDGE,
        viewport.width - AVATAR_EDGE - width,
    );
    const options = [
        { above: true, y: point.y - OVERLAY_GAP - height },
        { above: false, y: point.y + avatarSize + OVERLAY_GAP },
    ].map((option) => {
        const fits =
            option.y >= AVATAR_EDGE &&
            option.y + height <= viewport.height - AVATAR_EDGE;
        const box = boxAt(x, option.y, width, height);
        const cost =
            (fits ? 0 : OUT_OF_VIEW) +
            avoid.reduce((sum, other) => sum + overlapArea(box, other), 0);

        return {
            above: option.above,
            cost,
            y: clamp(
                option.y,
                AVATAR_EDGE,
                viewport.height - AVATAR_EDGE - height,
            ),
        };
    });
    const best = options[0].cost <= options[1].cost ? options[0] : options[1];

    return {
        left: x - point.x,
        top: best.y - point.y,
        width,
        height,
        above: best.above,
    };
};

const candidateFor = (
    side: Side,
    along: number,
    target: Box,
    size: number,
): Point => {
    switch (side) {
        case 'right':
            return {
                x: target.right + AVATAR_GAP,
                y: lerp(target.top, target.bottom - size, along),
            };
        case 'left':
            return {
                x: target.left - AVATAR_GAP - size,
                y: lerp(target.top, target.bottom - size, along),
            };
        case 'below':
            return {
                x: lerp(target.left, target.right - size, along),
                y: target.bottom + AVATAR_GAP,
            };
        case 'above':
            return {
                x: lerp(target.left, target.right - size, along),
                y: target.top - AVATAR_GAP - size,
            };
    }
};

const gapBetween = (a: Box, b: Box) =>
    Math.hypot(
        Math.max(0, b.left - a.right, a.left - b.right),
        Math.max(0, b.top - a.bottom, a.top - b.bottom),
    );

export interface PlacementInput {
    /** Visible part of the target, already clipped to the viewport. */
    target: Box;
    avatarSize: number;
    /** Expected message or panel size; {0,0} when no overlay is shown. */
    overlay: Size;
    viewport: Size;
    obstacles: readonly Obstacle[];
    /** Best-first sides for this kind of target. */
    preferred: readonly Side[];
    /** Candidate chosen last time; kept unless a rival is clearly better. */
    previous?: Choice | null;
}

/**
 * Scores every side/alignment candidate and returns the least costly one.
 * Covering the target is effectively forbidden; covering other content is
 * weighted by how important that content is; distance, viewport clamping,
 * and the kind's side preference break the remaining ties.
 */
export const placeAvatar = (input: PlacementInput): Plan => {
    const { target, avatarSize: size, viewport, obstacles, preferred } = input;
    const avoid = [target, ...obstacles.map((obstacle) => obstacle.box)];
    let best: { plan: Plan; score: number } | null = null;
    let bestPrevious: { plan: Plan; score: number } | null = null;

    for (const side of SIDES) {
        for (const along of ALONG) {
            const raw = candidateFor(side, along, target, size);
            const point = clampPoint(raw, size, viewport);
            const box = boxAt(point.x, point.y, size, size);
            const overlay = placeOverlay(
                point,
                size,
                input.overlay,
                viewport,
                avoid,
            );
            const overlayBox = boxAt(
                point.x + overlay.left,
                point.y + overlay.top,
                overlay.width,
                overlay.height,
            );
            let score = 0;

            if (overlapArea(box, target) > 0) score += HARD_BLOCK;

            const overlayArea = overlay.width * overlay.height;

            if (overlayArea > 0) {
                score +=
                    (overlapArea(overlayBox, target) / overlayArea) *
                    TARGET_TEXT_PENALTY;
            }

            for (const obstacle of obstacles) {
                score +=
                    ((overlapArea(box, obstacle.box) +
                        overlapArea(overlayBox, obstacle.box)) /
                        OVERLAP_UNIT) *
                    obstacle.weight;
            }

            // Moving the avatar to stay on-screen costs something, so the
            // unclamped side wins when both are otherwise equal.
            score +=
                (Math.abs(raw.x - point.x) + Math.abs(raw.y - point.y)) * 0.5;
            score += gapBetween(box, target) * 0.3;

            const rank = preferred.indexOf(side);

            score += (rank < 0 ? preferred.length : rank) * 20;

            const candidate = {
                score,
                plan: { point, side, along, avoid },
            };

            if (!best || score < best.score) best = candidate;
            if (
                input.previous &&
                input.previous.side === side &&
                input.previous.along === along
            ) {
                bestPrevious = candidate;
            }
        }
    }

    // Hysteresis: keep the current side unless a new one is clearly better,
    // so small measurement changes during scroll do not flip the avatar.
    if (bestPrevious && bestPrevious.score <= best!.score + HYSTERESIS) {
        return bestPrevious.plan;
    }

    return best!.plan;
};

/** Text, interactive, and structural elements the avatar should not cover. */
const OBSTACLE_SELECTOR =
    '[data-avatar], [data-avatar-keepout], header, [role="tooltip"], a[href], button, h1, h2, h3, p';

const weightFor = (element: Element): number => {
    if (element.matches('[data-avatar-keepout], header')) return 4;
    if (element.matches('[role="tooltip"]')) return 3;
    if (element.matches('[data-avatar]')) return 2;

    return 1;
};

/**
 * Measures every on-screen element worth protecting, except the avatar itself,
 * the target, and any ancestor of the target (which contains it, not competes).
 */
export const collectObstacles = (
    target: HTMLElement,
    root: HTMLElement,
    viewport: Size,
): Obstacle[] => {
    const obstacles: Obstacle[] = [];

    document
        .querySelectorAll<HTMLElement>(OBSTACLE_SELECTOR)
        .forEach((element) => {
            if (root.contains(element) || target.contains(element)) {
                return;
            }

            // Ancestors of the target normally do not compete with it, but a
            // keepout is absolute: the sidebar rail stays clear even when the
            // hovered link lives inside it, so the avatar parks beside the
            // rail instead of on top of its own triggers.
            if (element.contains(target) && !element.matches('[data-avatar-keepout]')) {
                return;
            }

            // Hidden tooltips still exist in the DOM, but they are not on screen.
            if (
                element.matches('[role="tooltip"]') &&
                getComputedStyle(element).opacity === '0'
            ) {
                return;
            }

            const box = boxFromRect(element.getBoundingClientRect());

            if (!clipToViewport(box, viewport)) return;

            obstacles.push({ box, weight: weightFor(element) });
        });

    return obstacles;
};
