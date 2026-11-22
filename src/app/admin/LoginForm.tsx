'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { login, type LoginState } from './actions';

const INITIAL: LoginState = { error: null, attempt: 0 };

/**
 * Password gate for the visitor dashboard. The check runs on the server; this
 * form only shows progress: the button locks and spins while checking, a
 * wrong password comes back inline (the card shakes), and a right one moves
 * straight on to the dashboard's loading screen.
 */
export default function LoginForm() {
    const [state, action, pending] = useActionState(login, INITIAL);
    const [visible, setVisible] = useState(false);

    return (
        <div className="flex min-h-svh items-center justify-center px-5 py-24">
            <form
                action={action}
                // Re-mounting on each failed attempt replays the shake.
                key={state.attempt}
                className={cn(
                    'w-full max-w-sm rounded-3xl border border-border/60 bg-background-light/80 p-7 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)] backdrop-blur-md sm:p-8',
                    state.error && 'animate-shake',
                )}
            >
                <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
                    <Lock size={20} aria-hidden />
                </span>

                <h1 className="mt-6 font-anton text-3xl leading-none">
                    Visitor dashboard
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Private. Enter your password to continue.
                </p>

                <label
                    htmlFor="admin-password"
                    className="mt-7 block text-xs uppercase tracking-[0.16em] text-muted-foreground"
                >
                    Password
                </label>
                <div className="relative mt-2">
                    <input
                        id="admin-password"
                        type={visible ? 'text' : 'password'}
                        name="password"
                        required
                        autoFocus
                        autoComplete="current-password"
                        disabled={pending}
                        aria-invalid={Boolean(state.error)}
                        aria-describedby={state.error ? 'admin-error' : undefined}
                        // 16px text: phones don't zoom into the field.
                        className="h-12 w-full rounded-xl border border-border bg-background pl-4 pr-12 text-base text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60 aria-[invalid=true]:border-red-500/70"
                    />
                    <button
                        type="button"
                        onClick={() => setVisible((value) => !value)}
                        aria-label={visible ? 'Hide password' : 'Show password'}
                        className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                    </button>
                </div>

                <p
                    id="admin-error"
                    role="alert"
                    className="mt-2 min-h-5 text-sm text-red-500"
                >
                    {!pending && state.error}
                </p>

                <button
                    type="submit"
                    disabled={pending}
                    className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-[background-color,opacity] hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-80"
                >
                    {pending ? (
                        <>
                            <Loader2 size={18} className="animate-spin" aria-hidden />
                            Checking…
                        </>
                    ) : (
                        'Unlock'
                    )}
                </button>

                <Link
                    href="/"
                    className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft size={15} aria-hidden /> Back to the site
                </Link>
            </form>
        </div>
    );
}
