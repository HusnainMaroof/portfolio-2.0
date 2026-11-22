import 'server-only';
import type { NextRequest } from 'next/server';

/**
 * Which organisation's network a visit came from, e.g. "Microsoft
 * Corporation" for someone browsing from Microsoft's office. The visitor's
 * IP is only used for this one lookup and is never stored.
 *
 * Uses ipinfo.io. It works without a key (with a modest monthly limit); set
 * IPINFO_TOKEN (free account) for more headroom.
 */
export type OrgType = 'company' | 'isp' | 'hosting';

export interface Org {
    name: string;
    type: OrgType;
}

/** The visitor's public IP, from Vercel's forwarding headers. */
export const clientIp = (req: NextRequest) => {
    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ip = forwarded || req.headers.get('x-real-ip')?.trim() || '';
    return isPublicIp(ip) ? ip : null;
};

const isPublicIp = (ip: string) => {
    if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('::ffff:127.')) return false;
    if (/^(10\.|192\.168\.|169\.254\.|fc|fd|fe80)/i.test(ip)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return false;
    return /^[\d.]+$|^[\da-f:]+$/i.test(ip);
};

/** Home and mobile internet providers: the "company" is just their ISP. */
const ISP =
    /telecom|telecommunication|communications?\b|broadband|internet|cable|wireless|mobile|cellular|fiber|fibre|net(work)?s?\b|isp\b|ptcl|jazz|mobilink|zong|telenor|ufone|nayatel|stormfiber|transworld|wateen|cybernet|comcast|verizon|at&t|t-mobile|charter|spectrum|cox\b|vodafone|airtel|jio|bsnl|etisalat|\bdu\b|stc\b|orange|bt\b|sky\b|virgin|deutsche telekom|telefonica|claro|vivo|movistar|rogers|bell canada|telus|optus|telstra|singtel|starhub/i;

/** Cloud, hosting and VPN networks: not a real visitor's workplace. */
const HOSTING =
    /amazon|aws|google cloud|digitalocean|linode|akamai|ovh|hetzner|vultr|contabo|cloudflare|fastly|oracle cloud|alibaba|tencent|choopa|leaseweb|m247|datacamp|hostinger|hosting|server|data ?cent(er|re)|vpn|proxy|colo/i;

export const classifyOrg = (name: string): OrgType =>
    HOSTING.test(name) ? 'hosting' : ISP.test(name) ? 'isp' : 'company';

/** "AS8075 Microsoft Corporation" → "Microsoft Corporation". */
const cleanName = (org: string) => org.replace(/^AS\d+\s+/i, '').trim();

/** Same IP within a day: answer from memory instead of asking again. */
const cache = new Map<string, { org: Org | null; at: number }>();
const CACHE_MS = 24 * 60 * 60 * 1000;

export const lookupOrg = async (ip: string): Promise<Org | null> => {
    const hit = cache.get(ip);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.org;

    const token = process.env.IPINFO_TOKEN?.trim();
    const url = `https://ipinfo.io/${encodeURIComponent(ip)}/json${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    try {
        const res = await fetch(url, {
            signal: AbortSignal.timeout(2500),
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { org?: string; bogon?: boolean };
        const name = data.org ? cleanName(data.org) : '';
        const org = name && !data.bogon ? { name: name.slice(0, 120), type: classifyOrg(name) } : null;

        if (cache.size > 2000) cache.clear();
        cache.set(ip, { org, at: Date.now() });
        return org;
    } catch {
        return null;
    }
};
