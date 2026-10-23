export interface HeroStat {
    value: string;
    label: string;
    /** Phrase Onee uses when talking about this stat. */
    context: string;
}

export interface HeroContent {
    name: { roman: string; italic: string };
    tagline: { lead: string; accent: string; tail: string };
    portrait: { src: string; alt: string; width: number; height: number };
    credibility: { text: string; notice: string };
    stats: readonly HeroStat[];
    coffee: { label: string; href: string };
    socials: readonly { label: 'GitHub' | 'LinkedIn'; href: string }[];
    address: { text: string , location?: string };
}

export interface ApproachContent {
    bullets: readonly { lead: string; text: string }[];
    label: string;
    flow: string;
    principles: readonly { heading: string; description: string }[];
}

export const HERO: HeroContent = {
    name: { roman: 'Husnain', italic: 'Maroof' },
    tagline: {
        lead: 'I build fast, reliable web and mobile products, from first line of code to something ',
        accent: 'real users depend on',
        tail: '.',
    },
    address: {
        text: ' FullStack Developer based in ',
        location: 'Islamabad, Pakistan',
    },
    portrait: {
        src: '/hero/portrait.avif',
        alt: 'Halftone portrait of Husnain Maroof in a black hoodie, looking to the side',
        width: 960,
        height: 960,
    },
    credibility: {
        text: 'Top 5% of developers, recognized by Toptal',
        notice: 'Grinding toward that. The Top 5% badge is coming soon. 🚧',
    },
    stats: [
        { value: '2.5+', label: 'Years', context: 'experience' },
        { value: '22+', label: 'Apps Shipped', context: 'applications' },
    ],
    socials: [
        { label: 'GitHub', href: 'https://github.com/HusnainMaroof' },
        {
            label: 'LinkedIn',
            href: 'https://www.linkedin.com/in/husnain-maroof-aa80212b5/',
        },
    ],
    coffee: {
        label: 'Buy me a coffee',
        href: 'https://www.chailink.co/husnainmaroof',
    },
};

export const APPROACH: ApproachContent = {
    bullets: [
        {
            lead: 'What I build',
            text: 'E-commerce and ordering systems, business dashboards and SaaS tools with subscriptions, marketing sites, and developer tooling, shipped end to end.',
        },
        {
            lead: 'Beyond the build',
            text: 'I plan for scalability so your stack holds up as usage grows.',
        },
        {
            lead: 'Built to grow',
            text: 'Products shaped to attract users and keep them coming back.',
        },
    ],
    label: 'How I Work',
    flow: 'Idea → Build → Ship',
    principles: [
        {
            heading: 'Understand the real problem',
            description:
                'I focus on user needs, business goals, and technical constraints to find the right solution.',
        },
        {
            heading: 'Build with scalability in mind',
            description:
                'Clean architecture, modern tech stack, and best practices so your product grows without limits.',
        },
        {
            heading: 'Ship polished and keep improving',
            description:
                'Attention to detail, performance, and continuous feedback to make products people love to use.',
        },
    ],
};
