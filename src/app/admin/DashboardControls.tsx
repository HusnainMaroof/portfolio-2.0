'use client';

import { useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, Copy, Link2, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

import { RANGES, type RangeValue } from './ranges';

/** How often the dashboard re-reads itself while the tab is visible. */
const AUTO_REFRESH_MS = 30_000;

/**
 * Range tabs plus refresh. Changes run in a transition: the current numbers
 * stay on screen (no blank flash) while the new ones load, and the control
 * that started it shows a spinner.
 */
export function Toolbar({
    range,
    generatedAt,
}: {
    range: RangeValue;
    generatedAt: number;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, startTransition] = useTransition();
    const [target, setTarget] = useState<RangeValue | 'refresh' | null>(null);
    const [now, setNow] = useState(generatedAt);

    // "Updated 12s ago" ticks on its own.
    useEffect(() => {
        setNow(Date.now());
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [generatedAt]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                startTransition(() => router.refresh());
            }
        }, AUTO_REFRESH_MS);
        return () => window.clearInterval(timer);
    }, [router]);

    const go = (value: RangeValue) => {
        if (value === range) return;
        setTarget(value);
        const params = new URLSearchParams(searchParams);
        params.set('range', value);
        startTransition(() => router.push(`${pathname}?${params}`, { scroll: false }));
    };

    const refresh = () => {
        setTarget('refresh');
        startTransition(() => router.refresh());
    };

    const seconds = Math.max(0, Math.round((now - generatedAt) / 1000));
    const busy = (key: RangeValue | 'refresh') => pending && target === key;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div
                role="tablist"
                aria-label="Time range"
                className="-mx-1 flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-foreground/[0.05] p-1"
            >
                {RANGES.map((option) => {
                    const active = option.value === range;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => go(option.value)}
                            className={cn(
                                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                active
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {busy(option.value) && (
                                <Loader2 size={14} className="animate-spin" aria-hidden />
                            )}
                            {option.label}
                        </button>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={refresh}
                disabled={pending}
                className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground disabled:cursor-wait"
            >
                <RefreshCw
                    size={14}
                    className={cn(pending && 'animate-spin')}
                    aria-hidden
                />
                <span aria-live="polite">
                    {pending
                        ? 'Updating…'
                        : seconds < 5
                          ? 'Updated just now'
                          : `Updated ${seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}m`} ago`}
                </span>
            </button>
        </div>
    );
}

/** Sign-out button that shows progress while the server clears the session. */
export function SignOutButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-foreground/[0.05] px-4 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.09] hover:text-foreground disabled:cursor-wait"
        >
            {pending ? (
                <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
                <LogOut size={16} aria-hidden />
            )}
            <span className="max-sm:sr-only">{pending ? 'Signing out…' : 'Sign out'}</span>
        </button>
    );
}

const slugify = (value: string) =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);

/**
 * Tracking links: type who you are sending the portfolio to and copy a link
 * tagged with it. When they open it, their visits show that tag here.
 */
export function LinkBuilder() {
    const [name, setName] = useState('');
    const [copied, setCopied] = useState(false);
    const [origin, setOrigin] = useState('');

    useEffect(() => setOrigin(window.location.origin), []);

    const tag = slugify(name);
    const link = tag ? `${origin}/?ref=${tag}` : '';

    const copy = async () => {
        if (!link) return;
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            // Clipboard blocked: the link is still selectable in the box.
        }
    };

    return (
        <div>
            <label
                htmlFor="ref-name"
                className="text-xs uppercase tracking-[0.16em] text-muted-foreground"
            >
                Who are you sending it to?
            </label>
            <div className="mt-2 flex gap-2">
                <div className="relative min-w-0 flex-1">
                    <Link2
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                    />
                    <input
                        id="ref-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="e.g. Acme recruiter"
                        className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-base text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 sm:text-sm"
                    />
                </div>
                <button
                    type="button"
                    onClick={copy}
                    disabled={!link}
                    className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
                >
                    {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <p className="mt-2 min-h-5 truncate text-xs text-muted-foreground" aria-live="polite">
                {link || 'Each person gets their own link; their visits show up tagged.'}
            </p>
        </div>
    );
}

/** Moderation button that shows progress while the server updates the note. */
export function ModerateButton({
    label,
    tone = 'neutral',
}: {
    label: string;
    tone?: 'primary' | 'neutral' | 'danger';
}) {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors disabled:cursor-wait disabled:opacity-60',
                tone === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
                tone === 'neutral' && 'bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1]',
                tone === 'danger' && 'text-red-500 hover:bg-red-500/10',
            )}
        >
            {pending && <Loader2 size={13} className="animate-spin" aria-hidden />}
            {label}
        </button>
    );
}
