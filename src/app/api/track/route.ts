import { after, NextResponse, type NextRequest } from 'next/server';
import { clientIp, lookupOrg } from '@/lib/server/company';
import { dbConfigured, prisma } from '@/lib/server/db';
import {
    getOrCreateVisitorId,
    hashIp,
    isBot,
    parseUserAgent,
    readLocation,
    setVisitorCookie,
} from '@/lib/server/visitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The same person opening the same page again within this window (a reload,
 * a back-and-forth, a second tab) updates their existing view instead of
 * counting a new one.
 */
const DEDUPE_MS = 30 * 60 * 1000;

const clip = (value: unknown, max: number) =>
    typeof value === 'string' && value.length > 0 ? value.slice(0, max) : null;

/** Records one page view. Body: { path, referrer? }. Returns { visitId }. */
export async function POST(req: NextRequest) {
    if (!dbConfigured()) return NextResponse.json({ ok: false }, { status: 503 });

    const userAgent = req.headers.get('user-agent') ?? '';
    if (isBot(userAgent)) return NextResponse.json({ ok: false }, { status: 202 });

    let body: { path?: unknown; referrer?: unknown; source?: unknown } = {};
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    const path = clip(body.path, 300);
    if (!path || !path.startsWith('/') || path.startsWith('/admin')) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Only keep where the visitor came from when it is another site.
    let referrer = clip(body.referrer, 500);
    try {
        if (referrer && new URL(referrer).host === req.nextUrl.host) referrer = null;
    } catch {
        referrer = null;
    }

    // Tracking-link tag: letters, numbers, dashes, dots, underscores only.
    const source =
        clip(body.source, 60)
            ?.toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '') || null;

    const visitor = getOrCreateVisitorId(req);
    const ip = clientIp(req);
    const ipHash = hashIp(ip);

    try {
        // "Same person" = same browser cookie, or same network fingerprint
        // (a new browser, private window or cleared cookies on one device).
        const recent = await prisma.visit.findFirst({
            where: {
                path,
                createdAt: { gte: new Date(Date.now() - DEDUPE_MS) },
                OR: [
                    { visitorId: visitor.id },
                    ...(ipHash ? [{ ipHash }] : []),
                ],
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
        });

        const visit =
            recent ??
            (await prisma.visit.create({
                data: {
                    visitorId: visitor.id,
                    ipHash,
                    path,
                    referrer,
                    source,
                    ...readLocation(req),
                    ...parseUserAgent(userAgent),
                },
                select: { id: true },
            }));

        // Which company's network this came from. Runs after the response
        // is sent, so the visitor never waits on the lookup.
        if (ip && !recent) {
            after(async () => {
                try {
                    // Same visitor in the last 30 minutes: same network.
                    const earlier = await prisma.visit.findFirst({
                        where: {
                            visitorId: visitor.id,
                            org: { not: null },
                            createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
                        },
                        select: { org: true, orgType: true },
                    });
                    const org = earlier?.org
                        ? { name: earlier.org, type: earlier.orgType }
                        : await lookupOrg(ip);
                    if (org) {
                        await prisma.visit.update({
                            where: { id: visit.id },
                            data: { org: org.name, orgType: org.type },
                        });
                    }
                } catch {
                    // The visit is already recorded; the company is a bonus.
                }
            });
        }

        await prisma.presence.upsert({
            where: { visitorId: visitor.id },
            create: { visitorId: visitor.id, path },
            update: { path, lastSeen: new Date() },
        });

        const res = NextResponse.json({ ok: true, visitId: visit.id });
        if (visitor.isNew) setVisitorCookie(res, visitor.id);
        return res;
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
