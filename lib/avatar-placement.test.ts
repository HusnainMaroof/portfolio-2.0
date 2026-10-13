import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    overlapArea,
    placeAvatar,
    type Box,
    type PlacementInput,
    type Side,
} from './avatar-placement.ts';

const VIEWPORT = { width: 1280, height: 800 };
const PREFERRED: Side[] = ['right', 'left', 'below', 'above'];

const target = (left: number, top: number, width = 300, height = 60): Box => ({
    left,
    top,
    right: left + width,
    bottom: top + height,
});

const input = (box: Box, overrides: Partial<PlacementInput> = {}) => ({
    target: box,
    avatarSize: 112,
    overlay: { width: 200, height: 72 },
    viewport: VIEWPORT,
    obstacles: [],
    preferred: PREFERRED,
    ...overrides,
});

describe('placeAvatar', () => {
    it('is deterministic for the same input', () => {
        const a = placeAvatar(input(target(400, 300)));
        const b = placeAvatar(input(target(400, 300)));

        assert.deepEqual(a.point, b.point);
        assert.equal(a.side, b.side);
        assert.equal(a.along, b.along);
    });

    it('never covers the target', () => {
        const box = target(100, 200);
        const plan = placeAvatar(input(box));
        const avatar: Box = {
            left: plan.point.x,
            top: plan.point.y,
            right: plan.point.x + 112,
            bottom: plan.point.y + 112,
        };

        assert.equal(overlapArea(avatar, box), 0);
    });

    it('keeps the avatar inside the viewport for targets at every edge', () => {
        const edges = [
            target(0, 0),
            target(VIEWPORT.width - 300, 0),
            target(0, VIEWPORT.height - 60),
            target(VIEWPORT.width - 300, VIEWPORT.height - 60),
        ];

        for (const box of edges) {
            const { point } = placeAvatar(input(box));

            assert.ok(point.x >= 0 && point.x + 112 <= VIEWPORT.width);
            assert.ok(point.y >= 0 && point.y + 112 <= VIEWPORT.height);
        }
    });

    it('keeps its previous choice for a small geometry change', () => {
        const first = placeAvatar(input(target(400, 300)));
        const nudged = placeAvatar(
            input(target(402, 301), {
                previous: { side: first.side, along: first.along },
            }),
        );

        assert.equal(nudged.side, first.side);
        assert.equal(nudged.along, first.along);
        // The avatar moves with the target by the same small offset.
        assert.ok(Math.abs(nudged.point.x - first.point.x - 2) <= 1);
        assert.ok(Math.abs(nudged.point.y - first.point.y - 1) <= 1);
    });
});
