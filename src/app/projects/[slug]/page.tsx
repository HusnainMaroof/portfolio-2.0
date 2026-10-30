import { notFound } from 'next/navigation';
import ProjectDetails from './_components/ProjectDetails';
import { PROJECTS } from '@/lib/data';
import { Metadata } from 'next';

export const generateStaticParams = async () => {
    return PROJECTS.map((project) => ({ slug: project.slug }));
};

/* The project description is stored as HTML for the case-study page; meta
 * tags need plain text, so strip tags and clamp to a sane length. */
const toPlainText = (html: string, maxLength = 160) => {
    const plain = html
        .replace(/<br\s*\/?>(\n)?/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();

    return plain.length > maxLength
        ? `${plain.slice(0, maxLength - 1).trimEnd()}…`
        : plain;
};

export const generateMetadata = async ({
    params,
}: {
    params: Promise<{ slug: string }>;
}) => {
    const { slug } = await params;
    const project = PROJECTS.find((project) => project.slug === slug);

    if (!project) {
        return {} as Metadata;
    }

    const description = toPlainText(project.description);
    const canonicalPath = `/projects/${project.slug}`;

    return {
        title: `${project.title} — ${
            project.metaTitle ??
            `${project.techStack.slice(0, 2).join(' & ')} Project`
        }`,
        description,
        alternates: {
            canonical: canonicalPath,
        },
        openGraph: {
            type: 'article',
            url: canonicalPath,
            siteName: 'Husnain Maroof Portfolio',
            title: `${project.title} — Husnain Maroof`,
            description,
            // The site-wide JPEG card (AVIF screenshots are not rendered by
            // Facebook/Twitter/X or most AI crawlers).
            images: [
                {
                    url: '/opengraph-image.jpg',
                    alt: `${project.title} case study preview`,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: `${project.title} — Husnain Maroof`,
            description,
            images: ['/opengraph-image.jpg'],
        },
    } as Metadata;
};

const Page = async ({ params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;

    const project = PROJECTS.find((project) => project.slug === slug);

    if (!project) {
        return notFound();
    }

    /* Structured data: a factual CreativeWork for the project plus a
     * breadcrumb. Only claims present in the visible case study are used. */
    const projectJsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'CreativeWork',
                name: project.title,
                description: toPlainText(project.description, 300),
                url: `https://husnain.cc/projects/${project.slug}`,
                keywords: project.techStack.join(', '),
                image: project.images.map((image) =>
                    image.startsWith('http')
                        ? image
                        : `https://husnain.cc${image}`,
                ),
                author: {
                    '@type': 'Person',
                    name: 'Husnain Maroof',
                    url: 'https://husnain.cc/',
                },
                creator: {
                    '@type': 'Person',
                    '@id': 'https://husnain.cc/#husnain-maroof',
                },
            },
            {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    {
                        '@type': 'ListItem',
                        position: 1,
                        name: 'Home',
                        item: 'https://husnain.cc/',
                    },
                    {
                        '@type': 'ListItem',
                        position: 2,
                        name: project.title,
                        item: `https://husnain.cc/projects/${project.slug}`,
                    },
                ],
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(projectJsonLd).replace(
                        /</g,
                        '\\u003c',
                    ),
                }}
            />
            <ProjectDetails project={project} />
        </>
    );
};

export default Page;
