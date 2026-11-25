import { NextResponse } from 'next/server';
import { dbConfigured } from '@/lib/server/db';
import { countOnline, countUniqueVisitors } from '@/lib/server/stats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public live counter: people on the site right now, and unique visitors. */
export async function GET() {
    if (!dbConfigured()) return NextResponse.json({ ok: false }, { status: 503 });

    try {
        const [online, visits] = await Promise.all([
            countOnline(),
            countUniqueVisitors(),
        ]);
        return NextResponse.json(
            { ok: true, online: Math.max(online, 1), visits },
            { headers: { 'Cache-Control': 'no-store' } },
        );
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
