import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            // Search engines
            { userAgent: 'Googlebot', allow: '/' },
            { userAgent: 'Bingbot', allow: '/' },
            // AI answer / search crawlers (explicitly allowed for ChatGPT
            // Search visibility; nothing on this site is blocked)
            { userAgent: 'OAI-SearchBot', allow: '/' },
            { userAgent: 'ChatGPT-User', allow: '/' },
            { userAgent: 'GPTBot', allow: '/' },
            { userAgent: 'ClaudeBot', allow: '/' },
            { userAgent: 'PerplexityBot', allow: '/' },
            { userAgent: '*', allow: '/' },
        ],
        sitemap: 'https://husnain.cc/sitemap.xml',
    };
}
