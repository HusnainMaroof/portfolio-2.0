import { NextResponse, type NextRequest } from 'next/server';
import { dbConfigured, prisma } from '@/lib/server/db';
import { ratingSummary } from '@/lib/server/stats';
import {
    getOrCreateVisitorId,
    isBot,
    readVisitorId,
    setVisitorCookie,
} from '@/lib/server/visitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Average rating, number of ratings, and this visitor's own stars. */
export async function GET(req: NextRequest) {
    if (!dbConfigured()) return NextResponse.json({ ok: false }, { status: 503 });

    try {
        const visitorId = readVisitorId(req);
        const [summary, mine] = await Promise.all([
            ratingSummary(),
            visitorId
                ? prisma.rating.findUnique({
                      where: { visitorId },
                      select: { stars: true },
                  })
                : null,
        ]);
        return NextResponse.json(
            { ok: true, ...summary, mine: mine?.stars ?? 0 },
            { headers: { 'Cache-Control': 'no-store' } },
        );
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}

/** Rate the portfolio 1-5. One rating per visitor; rating again replaces it. */
export async function POST(req: NextRequest) {
    if (!dbConfigured()) return NextResponse.json({ ok: false }, { status: 503 });
    if (isBot(req.headers.get('user-agent') ?? '')) {
        return NextResponse.json({ ok: false }, { status: 403 });
    }

    let stars = 0;
    try {
        stars = Number((await req.json())?.stars);
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    const visitor = getOrCreateVisitorId(req);

    try {
        await prisma.rating.upsert({
            where: { visitorId: visitor.id },
            create: { visitorId: visitor.id, stars },
            update: { stars },
        });
        const res = NextResponse.json({
            ok: true,
            ...(await ratingSummary()),
            mine: stars,
        });
        if (visitor.isNew) setVisitorCookie(res, visitor.id);
        return res;
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
