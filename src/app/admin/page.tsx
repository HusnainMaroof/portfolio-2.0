import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Building2, Star, Tag } from 'lucide-react';
import { adminConfigured, isAdmin } from '@/lib/server/admin-auth';
import { dbConfigured, prisma } from '@/lib/server/db';
import { onlineSince, ratingSummary } from '@/lib/server/stats';
import { logout } from './actions';
import { LinkBuilder, SignOutButton, Toolbar } from './DashboardControls';
import LoginForm from './LoginForm';
import { RANGES, type RangeValue } from './ranges';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Visitors',
    robots: { index: false, follow: false },
};

const TIME_ZONE = 'Asia/Karachi';
const DAY = 24 * 60 * 60 * 1000;

const RANGE_START: Record<RangeValue, () => Date> = {
    '24h': () => new Date(Date.now() - DAY),
    '7d': () => new Date(Date.now() - 7 * DAY),
    '30d': () => new Date(Date.now() - 30 * DAY),
    all: () => new Date(0),
};

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

const place = (country: string | null, city: string | null) =>
    `${countryLabel(country)}${city ? `, ${city}` : ''}`;

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
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
    return new Date(`${parts}T00:00:00+05:00`);
};

// ---------------------------------------------------------------------------

const Shell = ({ children }: { children: ReactNode }) => (
    <section className="page-container min-h-svh pb-24 pt-24 sm:pt-28">{children}</section>
);

const LiveDot = () => (
    <span className="relative flex size-2" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
    </span>
);

const Card = ({
    label,
    value,
    hint,
    live,
    className,
}: {
    label: string;
    value: ReactNode;
    hint?: string;
    live?: boolean;
    className?: string;
}) => (
    <div
        className={`rounded-2xl border border-border/60 bg-background-light/70 p-4 sm:p-5 ${className ?? ''}`}
    >
        <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:text-[11px]">
            {live && <LiveDot />}
            {label}
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
            {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
);

const Panel = ({
    title,
    children,
    className,
}: {
    title: string;
    children: ReactNode;
    className?: string;
}) => (
    <div
        className={`rounded-2xl border border-border/60 bg-background-light/70 p-4 sm:p-5 ${className ?? ''}`}
    >
        <h2 className="mb-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {title}
        </h2>
        {children}
    </div>
);

/** A ranked list with a bar per row. */
const Ranked = ({ rows }: { rows: { label: string; count: number }[] }) => {
    const max = Math.max(1, ...rows.map((row) => row.count));
    if (!rows.length || rows.every((row) => row.count === 0)) {
        return <p className="text-sm text-muted-foreground">Nothing yet.</p>;
    }
    return (
        <ul className="space-y-3">
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

/** "From Microsoft Corporation" for companies; ISPs and cloud stay muted. */
const OrgNote = ({ org, type }: { org: string | null; type: string | null }) => {
    if (!org) return null;
    if (type === 'company') {
        return (
            <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-primary">
                <Building2 size={12} aria-hidden />
                <span className="truncate">From {org}</span>
            </span>
        );
    }
    return (
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            via {org}
            {type === 'hosting' && ' (cloud/VPN)'}
        </span>
    );
};

const SourceBadge = ({ source }: { source: string }) => (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
        <Tag size={11} aria-hidden />
        {source}
    </span>
);

// ---------------------------------------------------------------------------

const SetupNeeded = ({ missing }: { missing: string[] }) => (
    <Shell>
        <div className="mx-auto mt-10 max-w-lg rounded-3xl border border-border/60 bg-background-light/70 p-7 sm:p-8">
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

const Dashboard = async (range: RangeValue) => {
    const since = RANGE_START[range]();
    const inRange = { createdAt: { gte: since } };
    const rangeLabel = RANGES.find((option) => option.value === range)!.label;

    const [
        online,
        rangeVisits,
        totalVisits,
        uniqueRows,
        todayVisits,
        avgDuration,
        recent,
        pages,
        countries,
        referrers,
        sources,
        devices,
        rating,
        ratingGroups,
        companies,
        orgTypes,
    ] = await Promise.all([
        prisma.presence.findMany({
            where: { lastSeen: { gte: onlineSince() } },
            orderBy: { lastSeen: 'desc' },
            take: 50,
        }),
        prisma.visit.count({ where: inRange }),
        prisma.visit.count(),
        prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(DISTINCT "visitorId") AS count FROM "Visit"
            WHERE "createdAt" >= ${since}`,
        prisma.visit.count({ where: { createdAt: { gte: startOfToday() } } }),
        prisma.visit.aggregate({
            _avg: { durationMs: true },
            where: { ...inRange, durationMs: { gt: 0 } },
        }),
        prisma.visit.findMany({
            where: inRange,
            orderBy: { createdAt: 'desc' },
            take: 100,
        }),
        prisma.visit.groupBy({
            by: ['path'],
            _count: { _all: true },
            where: inRange,
            orderBy: { _count: { path: 'desc' } },
            take: 8,
        }),
        prisma.visit.groupBy({
            by: ['country'],
            _count: { _all: true },
            where: inRange,
            orderBy: { _count: { country: 'desc' } },
            take: 8,
        }),
        prisma.visit.groupBy({
            by: ['referrer'],
            _count: { _all: true },
            where: { ...inRange, referrer: { not: null } },
            orderBy: { _count: { referrer: 'desc' } },
            take: 8,
        }),
        prisma.visit.groupBy({
            by: ['source'],
            _count: { _all: true },
            _max: { createdAt: true },
            where: { ...inRange, source: { not: null } },
            orderBy: { _count: { source: 'desc' } },
            take: 12,
        }),
        prisma.visit.groupBy({
            by: ['device'],
            _count: { _all: true },
            where: inRange,
            orderBy: { _count: { device: 'desc' } },
        }),
        ratingSummary(),
        prisma.rating.groupBy({ by: ['stars'], _count: { _all: true } }),
        // Companies whose network visits came from (ISPs and cloud left out).
        prisma.visit.groupBy({
            by: ['org'],
            _count: { _all: true },
            _sum: { durationMs: true },
            _max: { createdAt: true },
            where: { ...inRange, orgType: 'company', org: { not: null } },
            orderBy: { _count: { org: 'desc' } },
            take: 15,
        }),
        prisma.visit.groupBy({
            by: ['orgType'],
            _count: { _all: true },
            where: { ...inRange, orgType: { not: null } },
        }),
    ]);

    const orgCount = (type: string) =>
        orgTypes.find((row) => row.orgType === type)?._count._all ?? 0;
    // Pages each company looked at, from the visits on screen.
    const companyPages = new Map<string, Set<string>>();
    for (const visit of recent) {
        if (visit.orgType !== 'company' || !visit.org) continue;
        const pages = companyPages.get(visit.org) ?? new Set<string>();
        pages.add(visit.path);
        companyPages.set(visit.org, pages);
    }

    const uniqueVisitors = Number(uniqueRows[0]?.count ?? 0);
    // Where each live visitor is, from their latest visit.
    const latestByVisitor = new Map<string, (typeof recent)[number]>();
    for (const visit of recent) {
        if (!latestByVisitor.has(visit.visitorId)) latestByVisitor.set(visit.visitorId, visit);
    }

    return (
        <Shell>
            <header className="mb-6 flex items-start justify-between gap-4 sm:mb-8">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        Private dashboard
                    </p>
                    <h1 className="mt-2 font-anton text-4xl leading-none sm:text-5xl">
                        Visitors
                    </h1>
                </div>
                <form action={logout}>
                    <SignOutButton />
                </form>
            </header>

            <Toolbar range={range} generatedAt={Date.now()} />

            <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
                <Card label="Online now" value={online.length} live />
                <Card label="Today" value={todayVisits} hint="page views" />
                <Card label={rangeLabel} value={rangeVisits} hint={`page views · ${totalVisits} all time`} />
                <Card label="Visitors" value={uniqueVisitors} hint={`unique · ${rangeLabel.toLowerCase()}`} />
                <Card
                    className="col-span-2 lg:col-span-1"
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
                    hint={`${rating.count} rating${rating.count === 1 ? '' : 's'} · avg ${duration(avgDuration._avg.durationMs ?? 0)} on a page`}
                />
            </div>

            <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-3">
                <Panel title="On the site right now">
                    {online.length ? (
                        <ul className="space-y-3 text-sm">
                            {online.map((person) => {
                                const last = latestByVisitor.get(person.visitorId);
                                return (
                                    <li key={person.visitorId} className="flex items-start justify-between gap-4">
                                        <span className="min-w-0">
                                            <span className="block truncate text-foreground">
                                                {place(last?.country ?? null, last?.city ?? null)}
                                            </span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {person.path} · {last?.device ?? '—'}
                                            </span>
                                            <OrgNote org={last?.org ?? null} type={last?.orgType ?? null} />
                                            {last?.source && (
                                                <span className="mt-1 block">
                                                    <SourceBadge source={last.source} />
                                                </span>
                                            )}
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

                <Panel title="Tracking links" className="lg:col-span-2">
                    <LinkBuilder />
                    {sources.length > 0 && (
                        <ul className="mt-5 divide-y divide-border/50 border-t border-border/50 text-sm">
                            {sources.map((row) => (
                                <li key={row.source} className="flex items-center justify-between gap-3 py-2.5">
                                    <SourceBadge source={row.source ?? ''} />
                                    <span className="text-xs text-muted-foreground">
                                        {row._count._all} view{row._count._all === 1 ? '' : 's'}
                                        {row._max.createdAt && ` · last ${ago(row._max.createdAt)}`}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                <Panel title="Companies" className="lg:col-span-3">
                    {companies.length ? (
                        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {companies.map((row) => {
                                const pages = [...(companyPages.get(row.org ?? '') ?? [])];
                                return (
                                    <li
                                        key={row.org}
                                        className="flex items-start gap-3 rounded-xl bg-foreground/[0.03] p-3"
                                    >
                                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                                            <Building2 size={17} aria-hidden />
                                        </span>
                                        <span className="min-w-0 text-sm">
                                            <span className="block truncate font-medium text-foreground">{row.org}</span>
                                            <span className="block text-xs text-muted-foreground">
                                                {row._count._all} view{row._count._all === 1 ? '' : 's'}
                                                {' · '}
                                                {duration(row._sum.durationMs ?? 0)}
                                                {row._max.createdAt && ` · ${ago(row._max.createdAt)}`}
                                            </span>
                                            {pages.length > 0 && (
                                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                    {pages.join(', ')}
                                                </span>
                                            )}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No company networks yet. Visits from offices show up here by name.
                        </p>
                    )}
                    {(orgCount('isp') > 0 || orgCount('hosting') > 0) && (
                        <p className="mt-3 text-xs text-muted-foreground">
                            Not listed: {orgCount('isp')} view{orgCount('isp') === 1 ? '' : 's'} from home or mobile internet
                            {orgCount('hosting') > 0 && `, ${orgCount('hosting')} from cloud or VPN networks`}.
                        </p>
                    )}
                </Panel>

                <Panel title="Top pages">
                    <Ranked rows={pages.map((row) => ({ label: row.path, count: row._count._all }))} />
                </Panel>
                <Panel title="Countries">
                    <Ranked
                        rows={countries.map((row) => ({ label: countryLabel(row.country), count: row._count._all }))}
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
                <Panel title="Ratings · all time" className="lg:col-span-2">
                    <Ranked
                        rows={[5, 4, 3, 2, 1].map((stars) => ({
                            label: '★'.repeat(stars),
                            count: ratingGroups.find((group) => group.stars === stars)?._count._all ?? 0,
                        }))}
                    />
                </Panel>
            </div>

            <Panel title={`Latest visits · ${rangeLabel.toLowerCase()}`} className="mt-3 sm:mt-4">
                {recent.length ? (
                    <>
                        {/* Phones: one card per visit (a wide table only scrolled sideways). */}
                        <ul className="divide-y divide-border/50 md:hidden">
                            {recent.map((visit) => (
                                <li key={visit.id} className="py-3 text-sm first:pt-0">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="truncate font-medium text-foreground">{visit.path}</span>
                                        <span className="shrink-0 text-xs text-muted-foreground" title={fullTime(visit.createdAt)}>
                                            {ago(visit.createdAt)}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-muted-foreground">{place(visit.country, visit.city)}</p>
                                    <OrgNote org={visit.org} type={visit.orgType} />
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        {[visit.device, visit.browser, visit.os].filter(Boolean).join(' · ')}
                                        {' · from '}
                                        {host(visit.referrer)}
                                        {' · '}
                                        {duration(visit.durationMs)}
                                    </p>
                                    {visit.source && (
                                        <span className="mt-1.5 block">
                                            <SourceBadge source={visit.source} />
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>

                        <div className="hidden md:block">
                            <table className="w-full text-left text-sm">
                                <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                    <tr>
                                        <th className="pb-3 font-normal">When</th>
                                        <th className="pb-3 font-normal">Page</th>
                                        <th className="pb-3 font-normal">Where</th>
                                        <th className="pb-3 font-normal">Device</th>
                                        <th className="pb-3 font-normal">From</th>
                                        <th className="pb-3 text-right font-normal">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {recent.map((visit) => (
                                        <tr key={visit.id} className="transition-colors hover:bg-foreground/[0.03]">
                                            <td className="py-2.5 pr-4 text-muted-foreground" title={fullTime(visit.createdAt)}>
                                                {ago(visit.createdAt)}
                                            </td>
                                            <td className="py-2.5 pr-4 text-foreground">{visit.path}</td>
                                            <td className="py-2.5 pr-4">
                                                {place(visit.country, visit.city)}
                                                <OrgNote org={visit.org} type={visit.orgType} />
                                            </td>
                                            <td className="py-2.5 pr-4 text-muted-foreground">
                                                {[visit.device, visit.browser, visit.os].filter(Boolean).join(' · ')}
                                            </td>
                                            <td className="py-2.5 pr-4 text-muted-foreground">
                                                <span className="flex flex-wrap items-center gap-1.5">
                                                    {host(visit.referrer)}
                                                    {visit.source && <SourceBadge source={visit.source} />}
                                                </span>
                                            </td>
                                            <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                                                {duration(visit.durationMs)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">No visits in this range.</p>
                )}
            </Panel>
        </Shell>
    );
};

export default async function AdminPage({
    searchParams,
}: {
    searchParams: Promise<{ range?: string }>;
}) {
    const missing = [
        !dbConfigured() && 'DATABASE_URL',
        !dbConfigured() && 'DIRECT_URL',
        !adminConfigured() && 'ADMIN_PASSWORD',
        !adminConfigured() && 'ADMIN_SECRET (at least 32 characters)',
    ].filter(Boolean) as string[];

    if (missing.length) return <SetupNeeded missing={missing} />;

    if (!(await isAdmin())) return <LoginForm />;

    const { range: rawRange } = await searchParams;
    const range: RangeValue = RANGES.some((option) => option.value === rawRange)
        ? (rawRange as RangeValue)
        : '7d';

    try {
        // Neon's free tier sleeps when idle; the first queries after a pause
        // can fail while it wakes. One retry covers that.
        return await Dashboard(range).catch(() => Dashboard(range));
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
