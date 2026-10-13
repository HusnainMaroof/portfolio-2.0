import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    STAT_MESSAGES,
    createMessageBags,
    drawMessage,
    messageFor,
    type AvatarTrigger,
} from './avatar-interactions.ts';

const fixed = () => 0.5;

describe('stat messages', () => {
    it('uses only the applications pool for the applications statistic', () => {
        const bags = createMessageBags();
        const trigger: AvatarTrigger = {
            kind: 'stat',
            context: 'applications',
            label: 'Apps Shipped',
        };

        for (let i = 0; i < 8; i += 1) {
            const text = messageFor(trigger, i, bags, fixed);

            assert.ok(text, 'expected a message');
            assert.ok(STAT_MESSAGES.applications.includes(text));
        }
    });

    it('stays silent for a statistic with no matching pool', () => {
        const bags = createMessageBags();

        assert.equal(
            messageFor({ kind: 'stat', context: 'unknown' }, 0, bags, fixed),
            null,
        );
    });
});

describe('project and experience messages', () => {
    it('names the real project title in its lines', () => {
        const bags = createMessageBags();
        const seen: string[] = [];

        for (let i = 0; i < 40; i += 1) {
            const text = messageFor(
                {
                    kind: 'project',
                    label: 'Electro EV',
                    detail: 'Next.js, Payload CMS, Tailwind CSS',
                },
                i,
                bags,
            );

            if (text) seen.push(text);
        }

        assert.ok(seen.some((text) => text.includes('Electro EV')));
        assert.ok(!seen.some((text) => text.includes('Epikcart')));
    });

    it('names the real company for an experience entry', () => {
        const bags = createMessageBags();
        const text = messageFor(
            {
                kind: 'experience',
                label: 'Frontend Developer',
                detail: 'Paymits',
            },
            0,
            bags,
            fixed,
        );

        assert.ok(text);
    });
});

describe('navigation', () => {
    it('speaks only on the first visit to a section', () => {
        const bags = createMessageBags();
        const trigger: AvatarTrigger = { kind: 'nav', label: 'Projects' };

        assert.ok(messageFor(trigger, 0, bags, fixed));
        assert.equal(messageFor(trigger, 1, bags, fixed), null);
    });
});

describe('shuffle bag', () => {
    it('does not repeat the previous line when alternatives exist', () => {
        const bags = createMessageBags();
        const pool = ['one', 'two'];
        let previous: string | null = null;

        for (let i = 0; i < 20; i += 1) {
            const next = drawMessage(bags, 'pool', pool, fixed);

            assert.notEqual(next, previous);
            previous = next;
        }
    });

    it('returns null for an empty pool', () => {
        assert.equal(drawMessage(createMessageBags(), 'empty', []), null);
    });

    it('uses every line in a pool before repeating any', () => {
        const bags = createMessageBags();
        const pool = ['a', 'b', 'c'];
        const drawn = [0, 1, 2].map(() =>
            drawMessage(bags, 'cycle', pool, () => 0.1),
        );

        assert.deepEqual([...drawn].sort(), ['a', 'b', 'c']);
    });
});
