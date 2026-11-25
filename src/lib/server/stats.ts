import 'server-only';
import { prisma } from '@/lib/server/db';

/** Seen within this window = online now (the heartbeat runs every 20s). */
export const ONLINE_WINDOW_MS = 60_000;

export const onlineSince = () => new Date(Date.now() - ONLINE_WINDOW_MS);

export const countOnline = () =>
    prisma.presence.count({ where: { lastSeen: { gte: onlineSince() } } });

/**
 * Distinct people since `since` (all time by default). A person is their
 * network fingerprint when known, else their browser cookie (older visits
 * recorded before fingerprints existed). Reloads and revisits never add.
 */
export const countUniqueVisitors = async (since = new Date(0)) => {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT COALESCE("ipHash", "visitorId")) AS count
        FROM "Visit" WHERE "createdAt" >= ${since}`;
    return Number(rows[0]?.count ?? 0);
};

export const ratingSummary = async () => {
    const result = await prisma.rating.aggregate({
        _avg: { stars: true },
        _count: { _all: true },
    });
    return {
        average: result._avg.stars ? Math.round(result._avg.stars * 10) / 10 : 0,
        count: result._count._all,
    };
};
