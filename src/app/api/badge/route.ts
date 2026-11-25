import { NextResponse, type NextRequest } from 'next/server';
import { dbConfigured } from '@/lib/server/db';
import { countOnline, countUniqueVisitors } from '@/lib/server/stats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public badge data in shields.io's "endpoint" format, for READMEs:
 *   https://img.shields.io/endpoint?url=https://husnain.cc/api/badge
 *   https://img.shields.io/endpoint?url=https://husnain.cc/api/badge?metric=online
 * Only totals are exposed, never anything about a visitor.
 */
const COLOR = '00C853';
const formatter = new Intl.NumberFormat('en');

const badge = (label: string, message: string, color = COLOR) =>
    NextResponse.json(
        { schemaVersion: 1, label, message, color, cacheSeconds: 300 },
        { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } },
    );

export async function GET(req: NextRequest) {
    const metric = req.nextUrl.searchParams.get('metric');

    if (!dbConfigured()) return badge('portfolio', 'online', 'lightgrey');

    try {
        if (metric === 'online') {
            const online = await countOnline();
            return badge('online now', formatter.format(Math.max(online, 0)));
        }
        // Unique people, not page views: reloads and revisits don't add.
        const visitors = await countUniqueVisitors();
        return badge('portfolio visitors', formatter.format(visitors));
    } catch {
        return badge('portfolio', 'husnain.cc', 'lightgrey');
    }
}
