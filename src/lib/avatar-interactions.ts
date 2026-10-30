import type { AnimationName } from '@/Onee_avatar/onee.index';
import type { Side } from '@/lib/avatar-placement';

/**
 * Interaction kinds. Real elements opt in with `data-avatar="<kind>"`, plus
 * optional `data-avatar-label` (real title/name) and `data-avatar-group`.
 */
export type AvatarTriggerKind =
    | 'name'
    | 'portrait'
    | 'bio'
    | 'project'
    | 'skill'
    | 'experience'
    | 'stat'
    | 'nav'
    | 'contact'
    | 'social'
    | 'action';

interface AvatarReaction {
    /** Animation names verified against the exported AnimationName type. */
    animations: readonly AnimationName[];
}

export const AVATAR_HOME_ANIMATION: AnimationName = 'idle';

export const AVATAR_REACTIONS: Record<AvatarTriggerKind, AvatarReaction> = {
    name: { animations: ['curious', 'playful'] },
    portrait: { animations: ['excited', 'curious'] },
    bio: { animations: ['curious'] },
    project: { animations: ['thinking', 'excited'] },
    skill: { animations: ['working'] },
    experience: { animations: ['thinking', 'playful'] },
    stat: { animations: ['thinking', 'curious'] },
    nav: { animations: ['listening'] },
    contact: { animations: ['happy'] },
    social: { animations: ['playful'] },
    action: { animations: ['surprised'] },
};

/**
 * Best-first sides for each kind. The scorer still rejects a side that covers
 * content; these only decide which of the acceptable placements to prefer.
 */
export const PREFERRED_SIDES: Record<AvatarTriggerKind, readonly Side[]> = {
    name: ['left', 'right', 'above', 'below'],
    portrait: ['right', 'left', 'above', 'below'],
    bio: ['right', 'left', 'above', 'below'],
    project: ['left', 'right', 'above', 'below'],
    skill: ['right', 'left', 'above', 'below'],
    experience: ['left', 'right', 'above', 'below'],
    stat: ['right', 'left', 'below', 'above'],
    nav: ['right', 'below', 'above', 'left'],
    contact: ['right', 'left', 'above', 'below'],
    social: ['right', 'left', 'below', 'above'],
    action: ['right', 'below', 'above', 'left'],
};

/**
 * Hover-message pools. Each pool is rotated with a shuffle bag, so a line is
 * not repeated until the rest of its pool has been used.
 */
export const AVATAR_MESSAGES: Record<AvatarTriggerKind, readonly string[]> = {
    name: [
        'Ah, yes. The person responsible for all these tabs.',
        'You found the human behind the pixels.',
        'I was told to act natural. How am I doing?',
        'Professional by day. Debugging by night.',
        'The face behind the commits. Well, not literally.',
        'Looking for the mastermind? That is a generous title.',
        'I built this page. My union says I deserve a break.',
        'Welcome to my corner of the internet. Mind the bugs.',
        'This is where the story starts. Dramatic enough?',
        'You could read the bio. I hear it is quite informative.',
    ],
    portrait: [
        'Yes, that is him. Made of tiny dots, like a newspaper legend.',
        'Halftone mode: one part portrait, one part printer nostalgia.',
        'He insisted on the side profile. Very mysterious.',
        'Every dot placed with care. Okay, a script placed them.',
        'Same face that reviews every pull request. Be nice.',
        'Looking thoughtful. Probably thinking about edge cases.',
    ],
    bio: [
        'A short version of the story. The projects are the long version.',
        'Here is the bio. Skim it, or trust me and keep scrolling.',
        'The paragraph version of me. Much less caffeine involved.',
        'Quick intro. No three-page résumé hiding in here.',
        'The short version. The projects tell the longer story.',
        'Reading about me? Bold choice. The portfolio gets better from here.',
    ],
    project: [
        'This one took some serious brainpower.',
        'One more project shipped. One more problem solved.',
        'Go on, take a closer look. The screenshots are less shy than I am.',
        'Case study first, or do you prefer to poke around?',
        'Proud of this one. Do not tell the other projects.',
        'Every project here started as a blank file and a bit of optimism.',
        'Click around. The links are real.',
        'Nice pick. This is one I would show a friend.',
    ],
    skill: [
        'A carefully curated collection of ways to break things.',
        'Yes, the stack is taller than it needs to be.',
    ],
    experience: [
        'Every role taught me something, usually before lunch.',
        'Each entry was a new codebase. Some were kinder than others.',
        'This is the part of the page where the timeline gets serious.',
        'Chronological order, with a little drama on the side.',
        'Experience is debugging with a calendar attached.',
    ],
    // Stats have no generic pool: an unknown stat context stays silent.
    stat: [],
    nav: [
        'Good call. Each section has its own surprises.',
        'Shortcut accepted. Smart move.',
        'Exploring by section. Good instinct.',
        'Nothing here is on a timer. Take your time.',
        'Pick a stop. I will be your unreliable tour guide.',
    ],
    contact: [
        'Have a project in mind? I promise to read the brief.',
        'This is where a good idea becomes a calendar invite.',
        'Business first. Coffee is optional.',
        'Say hello. The inbox is friendlier than it looks.',
        'Got a brief? Send it over. Deadlines are welcome too.',
    ],
    social: [
        'The code lives on GitHub. The commit history is less polished.',
        'Public repo. Fewer secrets than the browser history.',
    ],
    action: [
        'The full profile is one click away.',
        'The link is the rest of the story.',
        "Don't take my word for it. Click through.",
    ],
};

/**
 * Onee's own lines: shown once shortly after the page loads, so the avatar
 * greets the visitor before anything is hovered.
 */
export const AVATAR_GREETINGS: readonly string[] = [
    'Hi! I am Onee. Hover around and I will narrate everything.',
    'Say hi to Onee 👋',
    'Welcome in. Hover on me and see what happens.',
    'Psst... hover on me. I do not bite.',
    'Fresh page, same me. Give me a hover for a good time.',
];

/**
 * Lines said when the pointer hovers the avatar itself. Drawn from a shuffle
 * bag, so every hover says something new until the pool has cycled.
 */
export const AVATAR_SELF_MESSAGES: readonly string[] = [
    'Hey! You found the loudest button on this page.',
    'Hover on me again. I have more where that came from.',
    'You can click me too. The panel has shortcuts.',
    'I follow your cursor. It is a full-time job.',
    'Still here. Still green. Still judging your scroll speed.',
    'Try hovering a project. I have opinions about those.',
    'Plot twist: I am the navigation now.',
    'This is me, working from the corner of your screen.',
];

/** Developer-humour lines per stack group. Unknown groups use `skill`. */
const SKILL_MESSAGES: Record<string, readonly string[]> = {
    frontend: [
        'Pixels first, then the parts nobody sees.',
        'Where the pixels get their attitude.',
        'It worked on my machine. Eventually.',
        'A button that behaves is a small miracle.',
    ],
    backend: [
        'The unseen part still has to hold up.',
        'Requests go in, answers come out, and I take the blame for the middle.',
        'Choosing the right tool is half the battle. Debugging it is the other half.',
        'Quiet work, loud when it breaks.',
    ],
    database: [
        'Structure now saves a migration later.',
        'Good data decisions stay quiet until they are not.',
        'Indexes: the closest thing I own to a superpower.',
        'Yes, that query is fine. Probably.',
    ],
    tools: [
        'Good tooling keeps the rest of the work honest.',
        'Automate it once and thank yourself later.',
        'Small workflow wins add up.',
        'A carefully curated collection of ways to break things.',
    ],
};

/**
 * Context-specific pools for stats. Each is eligible only for its own stat, so
 * a stat never receives a line written for something else.
 */
export const STAT_MESSAGES: Record<string, readonly string[]> = {
    applications: [
        "That's a lot of apps. Someone should probably count them twice.",
        'Apparently, shipping software became a habit.',
        'Each one started as an idea. Some probably started as a bug.',
        'Launches are just bugs that finally got a deadline.',
    ],
    experience: [
        'Experience is a long collection of lessons and debugging sessions.',
        'A few years of building things. Quite a few lessons learned.',
        'The years add up. So do the commit histories.',
    ],
};

/** Technology-specific lines. A tag with a pool here never falls back to its group. */
const TECH_MESSAGES: Record<string, readonly string[]> = {
    TypeScript: [
        'Types now, surprises later. Mostly fewer surprises.',
        'The part of the stack that argues with you before the browser does.',
    ],
    React: [
        'Components all the way down, which is how I like my problems.',
        'State is where the good bugs live.',
    ],
    Docker: [
        'It ran on my machine, and now it runs in a box. Progress.',
        'A container is a very organised excuse to be specific.',
    ],
    PostgreSQL: [
        'Relational, reliable, and very strict about your schema.',
        'Constraints feel rude until they save you.',
    ],
    GSAP: [
        'Timelines, tweens, and the occasional dramatic ease.',
        'Motion that helps, not motion for its own sake.',
    ],
};

/** Lines built from a project's real tech stack (passed in via data-avatar-detail). */
const projectDetailLines = (detail: string): string[] => [
    `Under the hood: ${detail}.`,
    `Stack check: ${detail}. Nothing exotic, just deliberate choices.`,
];

/** Lines that name the project itself, so they can only fit that project. */
const projectTitleLines = (title: string): string[] => [
    `${title}: this is where the idea met the implementation.`,
    `Before I spoil ${title}, take a look at the details.`,
];

/** Lines that name the real company, so they only fit that role. */
const experienceCompanyLines = (company: string): string[] => [
    `${company}: a chapter with its own deadlines and debugging.`,
    `Plenty of code at ${company}, and a few good stories.`,
];

export interface AvatarTrigger {
    kind: AvatarTriggerKind;
    label?: string;
    group?: string;
    /** Specific semantic context, e.g. which statistic this is. */
    context?: string;
    /** Real data for the target, e.g. a project's tech stack. */
    detail?: string;
    /** Real project route segment, used by the assistant to open its case study. */
    slug?: string;
}

const KINDS = Object.keys(AVATAR_REACTIONS) as AvatarTriggerKind[];

/** Stable key for one target; used for visit counts and message cooldowns. */
export const triggerKey = (trigger: AvatarTrigger): string =>
    `${trigger.kind}:${trigger.label ?? ''}`;

const readTrigger = (element: HTMLElement): AvatarTrigger | null => {
    const kind = element.dataset.avatar;

    if (!kind || !(KINDS as string[]).includes(kind)) return null;

    return {
        kind: kind as AvatarTriggerKind,
        label: element.dataset.avatarLabel,
        group: element.dataset.avatarGroup,
        context: element.dataset.avatarContext,
        detail: element.dataset.avatarDetail,
        slug: element.dataset.avatarSlug,
    };
};

/** Nearest opted-in ancestor for an event target, or null for plain page areas. */
export const findAvatarTrigger = (
    target: EventTarget | null,
): { element: HTMLElement; trigger: AvatarTrigger } | null => {
    if (!(target instanceof Element)) return null;

    const element = target.closest<HTMLElement>('[data-avatar]');

    if (!element) return null;

    const trigger = readTrigger(element);

    return trigger ? { element, trigger } : null;
};

const hash = (text: string): number => {
    let value = 0;

    for (const char of text) {
        value = (value * 31 + char.charCodeAt(0)) >>> 0;
    }

    return value;
};

export interface AvatarReactionResult {
    animation: AnimationName;
    label: string | null;
}

/**
 * Animation and caption for a trigger. `visit` is how many times this target
 * has been activated, so repeat visits vary the animation deterministically.
 */
export const resolveReaction = (
    trigger: AvatarTrigger,
    visit: number,
): AvatarReactionResult => {
    const { animations } = AVATAR_REACTIONS[trigger.kind];
    const seed = hash(triggerKey(trigger)) + visit;

    return {
        animation: animations[seed % animations.length],
        label:
            trigger.kind === 'project' ||
            trigger.kind === 'skill' ||
            trigger.kind === 'experience' ||
            trigger.kind === 'stat' ||
            trigger.kind === 'nav'
                ? (trigger.label ?? null)
                : null,
    };
};

/** Shuffle-bag state for one pool. Survives re-renders when kept in a ref. */
export interface MessageBag {
    items: string[];
    last: string | null;
}

export const createMessageBags = (): Map<string, MessageBag> => new Map();

const shuffle = (items: readonly string[], random: () => number): string[] => {
    const result = [...items];

    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));

        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
};

/**
 * Draws the next line from a pool. Each pool is consumed as a shuffled bag, so
 * every line appears once before any repeats, and the first line of a new bag
 * is never the line just shown. A one-line pool has no alternative, so it repeats.
 */
export const drawMessage = (
    bags: Map<string, MessageBag>,
    poolKey: string,
    pool: readonly string[],
    random: () => number = Math.random,
): string | null => {
    if (!pool.length) return null;

    let bag = bags.get(poolKey);

    if (!bag || bag.items.length === 0) {
        const items = shuffle(pool, random);
        const last = bag?.last ?? null;

        if (last !== null && items.length > 1 && items[0] === last) {
            [items[0], items[1]] = [items[1], items[0]];
        }

        bag = { items, last };
        bags.set(poolKey, bag);
    }

    const message = bag.items.shift() ?? null;

    bag.last = message;

    return message;
};

/**
 * The hover line for a trigger, or null when this activation should be silent.
 * Navigation speaks only on its first visit so it never comments on every move.
 */
export const messageFor = (
    trigger: AvatarTrigger,
    visit: number,
    bags: Map<string, MessageBag>,
    random?: () => number,
): string | null => {
    if (trigger.kind === 'nav' && visit > 0) return null;

    // Resolution order: most specific context first, generic kind pool last.
    if (trigger.kind === 'stat') {
        const context = trigger.context ?? '';

        return drawMessage(bags, `stat:${context}`, STAT_MESSAGES[context] ?? [], random);
    }

    if (trigger.kind === 'skill') {
        const tech = trigger.label ?? '';

        if (TECH_MESSAGES[tech]) {
            return drawMessage(bags, `tech:${tech}`, TECH_MESSAGES[tech], random);
        }

        const group = trigger.group ?? '';

        return drawMessage(
            bags,
            `skill:${group}`,
            SKILL_MESSAGES[group] ?? AVATAR_MESSAGES.skill,
            random,
        );
    }

    if (trigger.kind === 'project') {
        const title = trigger.label ?? '';
        const detail = trigger.detail ?? '';
        const lines = [
            ...AVATAR_MESSAGES.project,
            ...(title ? projectTitleLines(title) : []),
            ...(detail ? projectDetailLines(detail) : []),
        ];

        return drawMessage(bags, `project:${title}`, lines, random);
    }

    if (trigger.kind === 'experience' && trigger.detail) {
        const company = trigger.detail;

        return drawMessage(
            bags,
            `experience:${company}`,
            [
                ...AVATAR_MESSAGES.experience,
                ...experienceCompanyLines(company),
            ],
            random,
        );
    }

    return drawMessage(bags, trigger.kind, AVATAR_MESSAGES[trigger.kind], random);
};
