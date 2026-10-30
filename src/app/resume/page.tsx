import type { Metadata } from 'next';
import { GENERAL_INFO, MY_EXPERIENCE, MY_STACK, PROJECTS } from '@/lib/data';
import { HERO } from '@/content/hero';
import { getShortDescription } from '@/lib/projects';
import PrintButton from './PrintButton';

export const metadata: Metadata = {
    title: 'Resume',
    description:
        'Resume of Husnain Maroof, full-stack developer in Islamabad, Pakistan: experience, projects and tech stack.',
    alternates: { canonical: '/resume' },
};

/* Same wording as resume.md; every other line is read from lib/data.ts, so
 * the resume never drifts from the rest of the site. */
const ABOUT = [
    "I'm a full-stack developer focused on building fast, polished web experiences, from pixel-level scroll animation to production-grade data-driven apps.",
    'I build fast, reliable web and mobile products, from the first line of code to something real users depend on.',
];

const hrefFor = (label: 'GitHub' | 'LinkedIn') =>
    HERO.socials.find((social) => social.label === label)?.href ?? '';

const CONTACTS = [
    { label: GENERAL_INFO.email, href: `mailto:${GENERAL_INFO.email}` },
    { label: 'husnain.cc', href: 'https://husnain.cc' },
    { label: 'GitHub', href: hrefFor('GitHub') },
    { label: 'LinkedIn', href: hrefFor('LinkedIn') },
    { label: 'Upwork', href: GENERAL_INFO.upworkProfile },
];

const SectionHeading = ({ children }: { children: string }) => (
    <h2 className="mb-6 text-[11px] uppercase tracking-[0.2em] text-muted-foreground print:mb-3 print:text-neutral-500">
        {children}
    </h2>
);

const ResumePage = () => (
    <article className="page-container max-w-[860px] pb-24 pt-36 md:pt-44 print:max-w-none print:pt-0 print:text-black">
        <header className="flex flex-col gap-8 border-b border-border/50 pb-10 md:flex-row md:items-end md:justify-between print:border-neutral-300 print:pb-6">
            <div>
                <h1 className="font-name text-[clamp(3rem,7vw,5.5rem)] font-normal leading-[0.9] tracking-[-0.02em]">
                    Husnain <em className="italic">Maroof</em>
                </h1>
                <p className="mt-4 text-sm text-muted-foreground print:text-neutral-600">
                    Full-Stack Developer, Islamabad, Pakistan
                </p>
            </div>
            <PrintButton />
        </header>

        <ul className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border/50 py-6 text-sm print:border-neutral-300 print:py-3">
            {CONTACTS.map((contact) => (
                <li key={contact.label}>
                    <a
                        href={contact.href}
                        target={contact.href.startsWith('mailto:') ? undefined : '_blank'}
                        rel="noopener noreferrer"
                        className="text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline print:text-black"
                    >
                        {contact.label}
                    </a>
                </li>
            ))}
        </ul>

        <section className="py-10 print:py-5">
            <SectionHeading>About</SectionHeading>
            <div className="space-y-4 text-base leading-relaxed md:text-lg print:text-sm">
                {ABOUT.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                ))}
            </div>
        </section>

        <section className="border-t border-border/50 py-10 print:border-neutral-300 print:py-5">
            <SectionHeading>Experience</SectionHeading>
            <ul>
                {MY_EXPERIENCE.map((role) => (
                    <li
                        key={`${role.company}-${role.title}`}
                        className="grid gap-1 border-b border-border/30 py-4 last:border-b-0 md:grid-cols-[1fr_auto] md:gap-6 print:border-neutral-200 print:py-2"
                    >
                        <div>
                            <p className="font-anton text-2xl leading-tight md:text-3xl print:text-lg">
                                {role.title}
                            </p>
                            <p className="text-sm text-muted-foreground print:text-neutral-600">
                                {role.company}
                            </p>
                        </div>
                        <p className="text-sm tabular-nums text-muted-foreground md:text-right print:text-neutral-600">
                            {role.duration}
                        </p>
                    </li>
                ))}
            </ul>
        </section>

        <section className="border-t border-border/50 py-10 print:border-neutral-300 print:py-5">
            <SectionHeading>Projects</SectionHeading>
            <ul className="space-y-6 print:space-y-3">
                {PROJECTS.map((project) => (
                    <li key={project.slug} className="break-inside-avoid">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                            <p className="font-anton text-xl leading-tight md:text-2xl print:text-base">
                                {project.title}{' '}
                                <span className="font-roboto-flex text-sm font-normal text-muted-foreground print:text-neutral-600">
                                    {project.year}
                                </span>
                            </p>
                            {project.liveUrl && (
                                <a
                                    href={project.liveUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline print:text-black"
                                >
                                    {project.liveUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                </a>
                            )}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground print:text-neutral-700">
                            {getShortDescription(project, 200)}
                        </p>
                    </li>
                ))}
            </ul>
        </section>

        <section className="border-t border-border/50 py-10 print:border-neutral-300 print:py-5">
            <SectionHeading>Stack</SectionHeading>
            <dl className="space-y-3">
                {Object.entries(MY_STACK).map(([group, items]) => (
                    <div key={group} className="grid gap-1 md:grid-cols-[140px_1fr] md:gap-6">
                        <dt className="text-sm uppercase tracking-[0.12em] text-muted-foreground print:text-neutral-600">
                            {group}
                        </dt>
                        <dd className="text-sm md:text-base print:text-sm">
                            {items.map((item) => item.name).join(', ')}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    </article>
);

export default ResumePage;
