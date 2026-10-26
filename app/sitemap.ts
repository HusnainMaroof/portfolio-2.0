import type { MetadataRoute } from 'next';
import { PROJECTS } from '@/lib/data';

const SITE_URL = 'https://husnain.cc';

export default function sitemap(): MetadataRoute.Sitemap {
    // Bump when content actually changes; new Date() changed on every deploy,
    // which teaches Google to ignore lastmod.
    const lastModified = new Date('2026-10-26');

    return [
        {
            url: SITE_URL,
            lastModified,
            changeFrequency: 'monthly',
            priority: 1,
        },
        ...PROJECTS.map((project) => ({
            url: `${SITE_URL}/projects/${project.slug}`,
            lastModified,
            changeFrequency: 'yearly' as const,
            priority: 0.7,
        })),
    ];
}
