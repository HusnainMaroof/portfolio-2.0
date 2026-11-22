import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Lock, LogOut, Star } from 'lucide-react';
import { adminConfigured, isAdmin } from '@/lib/server/admin-auth';
import { dbConfigured, prisma } from '@/lib/server/db';
import {
    countUniqueVisitors,
    onlineSince,
    ratingSummary,
} from '@/lib/server/stats';
import { login, logout } from './actions';
import AutoRefresh from './AutoRefresh';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Visitors',
    robots: { index: false, follow: false },
};

const TIME_ZONE = 'Asia/Karachi';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

const countryLabel = (code: string | null) => {
    if (!code || !/^[A-Z]{2}$/.test(code)) return 'Unknown';
    const flag = String.fromCodePoint(
        ...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
    );
    let name = code;
    try {
        name = regionNames.of(code) ?? code;
    } catch {
        // Keep the code.
    }
    return `${flag} ${name}`;
};

const ago = (date: Date) => {
    const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
};

const fullTime = (date: Date) =>
    date.toLocaleString('en-GB', {
        timeZone: TIME_ZONE,
        dateStyle: 'medium',
        timeStyle: 'short',
    });

const duration = (ms: number) => {
    if (ms <= 0) return '—';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

const host = (url: string | null) => {
    if (!url) return 'Direct';
    try {
        return new URL(url).host.replace(/^www\./, '');
    } catch {
        return url;
    }
};

/** Start of today in Pakistan time, as a UTC instant. */
const startOfToday = () => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
    return new Date(`${parts}T00:00:00+05:00`);
};

// ---------------------------------------------------------------------------

const Shell = ({ children }: { children: ReactNode }) => (
    <section className="page-container min-h-svh pb-20 pt-28">{children}</section>
);

const Card = ({
    label,
    value,
    hint,
    live,
}: {
    label: string;
    value: ReactNode;
    hint?: string;
    live?: boolean;
}) => (
    <div className="rounded-2xl border border-border/60 bg-background-light/60 p-5">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {live && (
                <span className="relative flex size-2" aria-hidden>
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
            )}
            {label}
        </p>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
);

const Panel = ({ title, children }: { title: string; children: ReactNode }) => (
    <div className="rounded-2xl border border-border/60 bg-background-light/60 p-5">
        <h2 className="mb-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {title}
        </h2>
        {children}
    </div>
);

/** A ranked list with a bar per row. */
const Ranked = ({ rows }: { rows: { label: string; count: number }[] }) => {
    const max = Math.max(1, ...rows.map((row) => row.count));
    if (!rows.length) return <p className="text-sm text-muted-foreground">No data yet.</p>;
    return (
        <ul className="space-y-2.5">
            {rows.map((row) => (
                <li key={row.label} className="text-sm">
                    <div className="mb-1 flex justify-between gap-4">
                        <span className="truncate text-foreground">{row.label}</span>
                        <span className="tabular-nums text-muted-foreground">{row.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]">
                        <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(row.count / max) * 100}%` }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    );
};

// ---------------------------------------------------------------------------

const SetupNeeded = ({ missing }: { missing: string[] }) => (
    <Shell>
        <div className="mx-auto max-w-lg rounded-2xl border border-border/60 bg-background-light/60 p-8">
            <h1 className="font-anton text-4xl">Almost there</h1>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                The visitor dashboard needs these values in <code>.env</code>{' '}
                (and in Vercel&apos;s environment variables):
            </p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-foreground">
                {missing.map((name) => (
                    <li key={name}>
                        <code>{name}</code>
                    </li>
                ))}
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Then create the tables once with <code>pnpm db:push</code> and
                restart the dev server.
            </p>
        </div>
    </Shell>
);

const LoginForm = ({ error }: { error: boolean }) => (
    <Shell>
        <form
            action={login}
            className="mx-auto flex max-w-sm flex-col gap-4 rounded-2xl border border-border/60 bg-background-light/60 p-8"
        >
            <span className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Lock size={20} aria-hidden />
            </span>
            <h1 className="font-anton text-3xl">Private</h1>
            <label className="flex flex-col gap-2 text-sm text-muted-foreground">
                Password
                <input
                    type="password"
                    name="password"
                    required
                    autoFocus
                    autoComplete="current-password"
                    className="h-12 rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
            </label>
            {error && (
                <p role="alert" className="text-sm text-red-500">
                    That password is not right.
                </p>
            )}
            <button
                type="submit"
                className="h-12 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                Unlock
            </button>
        </form>
    </Shell>
);

const Dashboard = async () => {
    const since = onlineSince();
    const today = startOfToday();

    const [
        online,
        totalVisits,
        uniqueVisitors,
        todayVisits,
        avgDuration,
        recent,
        pages,
        countries,
        referrers,
        devices,
        rating,
        ratingGroups,
    ] = await Promise.all([
        prisma.presence.findMany({
            where: { lastSeen: { gte: since } },
            orderBy: { lastSeen: 'desc' },
            take: 50,
        }),
        prisma.visit.count(),
        countUniqueVisitors(),
        prisma.visit.count({ where: { createdAt: { gte: today } } }),
        prisma.visit.aggregate({
            _avg: { durationMs: true },
            where: { durationMs: { gt: 0 } },
        }),
        prisma.visit.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
        prisma.visit.groupBy({
            by: ['path'],
            _count: { _all: true },
            orderBy: { _count: { path: 'desc' } },
            take: 8,
        }),
        prisma.visit.groupBy({
            by: ['country'],
            _count: { _all: true },
            orderBy: { _count: { country: 'desc' } },
            take: 8,
        }),
        prisma.visit.groupBy({
            by: ['referrer'],
            _count: { _all: true },
            where: { referrer: { not: null } },
            orderBy: { _count: { referrer: 'desc' } },
            take: 8,
        }),
        prisma.visit.groupBy({
            by: ['device'],
            _count: { _all: true },
            orderBy: { _count: { device: 'desc' } },
        }),
        ratingSummary(),
        prisma.rating.groupBy({ by: ['stars'], _count: { _all: true } }),
    ]);

    // Visits with no country are local/dev traffic (no edge headers).
    const visitorLocation = new Map(
        recent.map((visit) => [visit.visitorId, visit]),
    );

    return (
        <Shell>
            <AutoRefresh />
            <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        Private dashboard
                    </p>
                    <h1 className="mt-2 font-anton text-5xl">Visitors</h1>
                </div>
                <form action={logout}>
                    <button
                        type="submit"
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-foreground/[0.05] px-4 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.09] hover:text-foreground"
                    >
                        <LogOut size={16} aria-hidden /> Sign out
                    </button>
                </form>
            </header>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <Card label="Online now" value={online.length} live />
                <Card label="Today" value={todayVisits} hint="page views" />
                <Card label="All time" value={totalVisits} hint="page views" />
                <Card label="Visitors" value={uniqueVisitors} hint="unique browsers" />
                <Card
                    label="Rating"
                    value={
                        rating.count ? (
                            <span className="inline-flex items-center gap-1.5">
                                {rating.average.toFixed(1)}
                                <Star size={20} className="fill-primary text-primary" aria-hidden />
                            </span>
                        ) : (
                            '—'
                        )
                    }
                    hint={`${rating.count} rating${rating.count === 1 ? '' : 's'} · avg time ${duration(avgDuration._avg.durationMs ?? 0)}`}
                />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <Panel title="On the site right now">
                    {online.length ? (
                        <ul className="space-y-3 text-sm">
                            {online.map((person) => {
                                const last = visitorLocation.get(person.visitorId);
                                return (
                                    <li key={person.visitorId} className="flex justify-between gap-4">
                                        <span className="truncate text-foreground">
                                            {countryLabel(last?.country ?? null)}
                                            {last?.city ? `, ${last.city}` : ''}
                                            <span className="block text-xs text-muted-foreground">
                                                {person.path} · {last?.device ?? '—'}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {ago(person.lastSeen)}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground">Nobody right now.</p>
                    )}
                </Panel>
                <Panel title="Top pages">
                    <Ranked rows={pages.map((row) => ({ label: row.path, count: row._count._all }))} />
                </Panel>
                <Panel title="Countries">
                    <Ranked
                        rows={countries.map((row) => ({
                            label: countryLabel(row.country),
                            count: row._count._all,
                        }))}
                    />
                </Panel>
                <Panel title="Came from">
                    <Ranked
                        rows={referrers.map((row) => ({ label: host(row.referrer), count: row._count._all }))}
                    />
                </Panel>
                <Panel title="Devices">
                    <Ranked
                        rows={devices.map((row) => ({ label: row.device ?? 'Unknown', count: row._count._all }))}
                    />
                </Panel>
                <Panel title="Ratings">
                    <Ranked
                        rows={[5, 4, 3, 2, 1].map((stars) => ({
                            label: '★'.repeat(stars),
                            count: ratingGroups.find((group) => group.stars === stars)?._count._all ?? 0,
                        }))}
                    />
                </Panel>
            </div>

            <div className="mt-4">
                <Panel title="Latest visits">
                    {recent.length ? (
                        <div className="-mx-5 overflow-x-auto px-5">
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                    <tr>
                                        <th className="pb-3 font-normal">When</th>
                                        <th className="pb-3 font-normal">Page</th>
                                        <th className="pb-3 font-normal">Where</th>
                                        <th className="pb-3 font-normal">Device</th>
                                        <th className="pb-3 font-normal">From</th>
                                        <th className="pb-3 text-right font-normal">Time on page</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {recent.map((visit) => (
                                        <tr key={visit.id}>
                                            <td className="py-2.5 pr-4 text-muted-foreground" title={fullTime(visit.createdAt)}>
                                                {ago(visit.createdAt)}
                                            </td>
                                            <td className="py-2.5 pr-4 text-foreground">{visit.path}</td>
                                            <td className="py-2.5 pr-4">
                                                {countryLabel(visit.country)}
                                                {visit.city ? `, ${visit.city}` : ''}
                                            </td>
                                            <td className="py-2.5 pr-4 text-muted-foreground">
                                                {[visit.device, visit.browser, visit.os].filter(Boolean).join(' · ')}
                                            </td>
                                            <td className="py-2.5 pr-4 text-muted-foreground">{host(visit.referrer)}</td>
                                            <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                                                {duration(visit.durationMs)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
                    )}
                </Panel>
            </div>
        </Shell>
    );
};

export default async function AdminPage({
    searchParams,
}: {
    searchParams: Promise<{ error?: string }>;
}) {
    const missing = [
        !dbConfigured() && 'DATABASE_URL',
        !dbConfigured() && 'DIRECT_URL',
        !adminConfigured() && 'ADMIN_PASSWORD',
        !adminConfigured() && 'ADMIN_SECRET (at least 32 characters)',
    ].filter(Boolean) as string[];

    if (missing.length) return <SetupNeeded missing={missing} />;

    if (!(await isAdmin())) {
        const { error } = await searchParams;
        return <LoginForm error={error === '1'} />;
    }

    try {
        // Neon's free tier sleeps when idle; the first queries after a pause
        // can fail while it wakes. One retry covers that.
        return await Dashboard().catch(() => Dashboard());
    } catch (error) {
        console.error('[admin] dashboard query failed:', error);
        return (
            <Shell>
                <p className="mx-auto max-w-lg text-sm text-muted-foreground">
                    Could not read the database. If this is a new database, create
                    the tables once with <code>pnpm db:push</code>.
                </p>
            </Shell>
        );
    }
}
