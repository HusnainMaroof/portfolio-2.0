import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import TransitionLink from '@/components/TransitionLink';
import { HERO } from '@/content/hero';
import { padIndex } from '@/lib/projects';

export const metadata: Metadata = {
    title: 'Socials',
    description:
        'Husnain Maroof on LinkedIn and GitHub, and his resume: experience, projects and stack.',
    alternates: { canonical: '/socials' },
};

const hrefFor = (label: 'GitHub' | 'LinkedIn') =>
    HERO.socials.find((social) => social.label === label)?.href ?? '/';

interface SocialLink {
    label: string;
    detail: string;
    href: string;
    external: boolean;
}

const LINKS: readonly SocialLink[] = [
    {
        label: 'LinkedIn',
        detail: 'husnain-maroof',
        href: hrefFor('LinkedIn'),
        external: true,
    },
    {
        label: 'GitHub',
        detail: '@HusnainMaroof',
        href: hrefFor('GitHub'),
        external: true,
    },
    {
        label: 'Resume',
        detail: 'Experience, projects, stack',
        href: '/resume',
        external: false,
    },
];

const ROW =
    'group grid grid-cols-[auto_1fr_auto] items-baseline gap-4 border-b border-border/50 py-8 outline-none transition-colors md:gap-8 md:py-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background';

const Row = ({ link, index }: { link: SocialLink; index: number }) => {
    const content = (
        <>
            <span className="text-xs tabular-nums tracking-[0.16em] text-muted-foreground">
                {padIndex(index + 1)}
            </span>
            <span className="font-name text-5xl leading-none text-foreground transition-[color,transform] duration-300 group-hover:translate-x-2 group-hover:text-primary sm:text-6xl md:text-8xl">
                {link.label}
            </span>
            <span className="flex items-center gap-2 text-right text-xs uppercase tracking-[0.16em] text-muted-foreground transition-colors group-hover:text-foreground md:text-sm">
                <span className="hidden sm:inline">{link.detail}</span>
                <ArrowUpRight
                    size={18}
                    strokeWidth={1.75}
                    aria-hidden
                    className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
            </span>
        </>
    );

    return link.external ? (
        <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            data-avatar="social"
            data-avatar-label={link.label}
            className={ROW}
        >
            {content}
        </a>
    ) : (
        <TransitionLink
            href={link.href}
            data-avatar="social"
            data-avatar-label={link.label}
            className={ROW}
        >
            {content}
        </TransitionLink>
    );
};

const SocialsPage = () => (
    <section className="page-container min-h-[100svh] pb-24 pt-36 md:pt-44">
        <h1 className="font-name text-[clamp(3.5rem,9vw,8rem)] font-normal leading-[0.9] tracking-[-0.025em] text-foreground">
            <em className="italic">Socials</em>
        </h1>

        <ul className="mt-14 border-t border-border/50 md:mt-20">
            {LINKS.map((link, index) => (
                <li key={link.label}>
                    <Row link={link} index={index} />
                </li>
            ))}
        </ul>
    </section>
);

export default SocialsPage;
