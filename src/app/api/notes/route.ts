import { NextResponse, type NextRequest } from 'next/server';
import { clientIp } from '@/lib/server/company';
import { dbConfigured, prisma } from '@/lib/server/db';
import {
    getOrCreateVisitorId,
    hashIp,
    isBot,
    readVisitorId,
    setVisitorCookie,
} from '@/lib/server/visitor';
import {
    isNoteColor,
    NOTE_MESSAGE_MAX,
    NOTE_MESSAGE_MIN,
    NOTE_MIN_FILL_MS,
    NOTE_NAME_MAX,
    type PublicNote,
} from '@/lib/notes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Notes per person (cookie or network) in a short window, and per day. */
const BURST_LIMIT = 3;
const BURST_WINDOW_MS = 10 * 60 * 1000;
const DAILY_LIMIT = 10;
const WALL_SIZE = 40;

const LINK = /https?:\/\/|www\.|\.(com|net|org|io|xyz|ru|cn|top|click)\b/i;

const clean = (value: unknown, max: number) =>
    typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim().slice(0, max)
        : '';

const toPublic = (note: {
    id: string;
    name: string | null;
    message: string;
    color: string;
    createdAt: Date;
    status?: string;
}): PublicNote => ({
    id: note.id,
    name: note.name || 'Anonymous',
    message: note.message,
    color: isNoteColor(note.color) ? note.color : 'lime',
    createdAt: note.createdAt.toISOString(),
    ...(note.status === 'pending' ? { pending: true } : {}),
});

/** The wall: approved notes, plus the visitor's own notes still waiting. */
export async function GET(req: NextRequest) {
    if (!dbConfigured()) return NextResponse.json({ ok: false }, { status: 503 });

    try {
        const visitorId = readVisitorId(req);
        const [approved, mine] = await Promise.all([
            prisma.note.findMany({
                where: { status: 'approved' },
                orderBy: { createdAt: 'desc' },
                take: WALL_SIZE,
            }),
            visitorId
                ? prisma.note.findMany({
                      where: { visitorId, status: 'pending' },
                      orderBy: { createdAt: 'desc' },
                      take: 5,
                  })
                : [],
        ]);
        return NextResponse.json(
            { ok: true, notes: [...mine, ...approved].map(toPublic) },
            { headers: { 'Cache-Control': 'no-store' } },
        );
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}

/**
 * Leave a note. Every note waits for approval in /admin before it shows on
 * the wall, so spam that gets past the checks below still never goes live.
 */
export async function POST(req: NextRequest) {
    if (!dbConfigured()) return NextResponse.json({ ok: false }, { status: 503 });

    let body: Record<string, unknown> = {};
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
    }

    const name = clean(body.name, NOTE_NAME_MAX);
    const message = clean(body.message, NOTE_MESSAGE_MAX);
    const color = isNoteColor(body.color) ? body.color : 'lime';
    const startedAt = Number(body.startedAt);

    // Bots: the hidden "website" field filled in, an instant submission, or
    // a bot user agent. They get a believable success and nothing is saved,
    // so whoever runs the bot learns nothing to work around.
    const tooFast = !Number.isFinite(startedAt) || Date.now() - startedAt < NOTE_MIN_FILL_MS;
    if (body.website || tooFast || isBot(req.headers.get('user-agent') ?? '')) {
        return NextResponse.json({
            ok: true,
            note: { id: 'pending', name: name || 'Anonymous', message, color, createdAt: new Date().toISOString(), pending: true },
        });
    }

    if (message.length < NOTE_MESSAGE_MIN) {
        return NextResponse.json({ ok: false, error: 'Write a little more.' }, { status: 400 });
    }

    const visitor = getOrCreateVisitorId(req);
    const ipHash = hashIp(clientIp(req));
    const samePerson = {
        OR: [{ visitorId: visitor.id }, ...(ipHash ? [{ ipHash }] : [])],
    };

    try {
        const [burst, today] = await Promise.all([
            prisma.note.count({
                where: { ...samePerson, createdAt: { gte: new Date(Date.now() - BURST_WINDOW_MS) } },
            }),
            prisma.note.count({
                where: { ...samePerson, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
            }),
        ]);
        if (burst >= BURST_LIMIT || today >= DAILY_LIMIT) {
            return NextResponse.json(
                { ok: false, error: 'That is a lot of notes! Try again a bit later.' },
                { status: 429 },
            );
        }

        const note = await prisma.note.create({
            data: {
                name: name || null,
                message,
                color,
                visitorId: visitor.id,
                ipHash,
                flag: LINK.test(`${name} ${message}`) ? 'contains a link' : null,
            },
        });

        const res = NextResponse.json({ ok: true, note: toPublic(note) });
        if (visitor.isNew) setVisitorCookie(res, visitor.id);
        return res;
    } catch {
        return NextResponse.json({ ok: false, error: 'Could not save. Try again.' }, { status: 500 });
    }
}
