import { NextResponse, type NextRequest } from 'next/server';
import { dbConfigured, prisma } from '@/lib/server/db';
import { readVisitorId } from '@/lib/server/visitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A page view can't plausibly last longer than this; caps a forgotten tab. */
const MAX_DURATION_MS = 60 * 60 * 1000;

/**
 * "Still here": keeps the visitor in the live count and updates how long
 * the current page has been open. Body: { visitId, path }.
 * Also accepts navigator.sendBeacon (text/plain body) when the tab closes.
 */
export async function POST(req: NextRequest) {
    if (!dbConfigured()) return new NextResponse(null, { status: 503 });

    const visitorId = readVisitorId(req);
    if (!visitorId) return new NextResponse(null, { status: 204 });

    let body: { visitId?: unknown; path?: unknown } = {};
    try {
        body = JSON.parse(await req.text());
    } catch {
        return new NextResponse(null, { status: 400 });
    }

    const visitId = typeof body.visitId === 'string' ? body.visitId : null;
    const path =
        typeof body.path === 'string' && body.path.startsWith('/')
            ? body.path.slice(0, 300)
            : '/';

    try {
        await prisma.presence.upsert({
            where: { visitorId },
            create: { visitorId, path },
            update: { path, lastSeen: new Date() },
        });

        if (visitId) {
            // Only the visitor's own view can be updated.
            const visit = await prisma.visit.findFirst({
                where: { id: visitId, visitorId },
                select: { createdAt: true },
            });
            if (visit) {
                const durationMs = Math.min(
                    Date.now() - visit.createdAt.getTime(),
                    MAX_DURATION_MS,
                );
                await prisma.visit.update({
                    where: { id: visitId },
                    data: { durationMs },
                });
            }
        }
        return new NextResponse(null, { status: 204 });
    } catch {
        return new NextResponse(null, { status: 500 });
    }
}
