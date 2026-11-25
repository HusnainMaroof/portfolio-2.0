'use client';

import {
    useCallback,
    useEffect,
    useId,
    useRef,
    useState,
    type CSSProperties,
    type FormEvent,
} from 'react';
import { useLenis } from 'lenis/react';
import { Loader2, PenLine, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    NOTE_COLORS,
    NOTE_MESSAGE_MAX,
    NOTE_NAME_MAX,
    type NoteColor,
    type PublicNote,
} from '@/lib/notes';

const dateLabel = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** Small, stable tilt per note, so the wall looks pinned by hand. */
const tilt = (id: string) => {
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    return ((Math.abs(hash) % 7) - 3) * 0.8;
};

const NoteCard = ({ note, fresh }: { note: PublicNote; fresh?: boolean }) => {
    const color = NOTE_COLORS[note.color];
    return (
        <figure
            className={cn(
                'relative w-[220px] shrink-0 rounded-md px-4 pb-4 pt-6 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.55)] sm:w-[250px]',
                note.pending && 'outline outline-2 outline-dashed outline-offset-[-6px] outline-black/15',
                fresh && 'animate-note-pin',
            )}
            style={
                {
                    backgroundColor: color.paper,
                    color: color.ink,
                    '--tilt': `${tilt(note.id)}deg`,
                    transform: 'rotate(var(--tilt))',
                } as CSSProperties
            }
        >
            {/* A strip of tape holding the note up. */}
            <span
                aria-hidden
                className="absolute -top-2 left-1/2 h-5 w-14 -translate-x-1/2 -rotate-2 rounded-sm bg-white/55 shadow-sm"
            />
            {note.pending && (
                <span className="mb-2 inline-block rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]">
                    Waiting for approval
                </span>
            )}
            <blockquote className="whitespace-pre-line break-words font-display text-[17px] leading-snug">
                {note.message}
            </blockquote>
            <figcaption className="mt-3 flex items-center justify-between gap-2 text-xs opacity-70">
                <span className="truncate">— {note.name}</span>
                <span className="shrink-0">{dateLabel(note.createdAt)}</span>
            </figcaption>
        </figure>
    );
};

/** One row of notes drifting sideways forever; pauses on hover or focus. */
const Row = ({
    notes,
    reverse,
    freshId,
}: {
    notes: PublicNote[];
    reverse?: boolean;
    freshId: string | null;
}) => {
    // Short rows don't need to move; they just sit centred.
    if (notes.length < 4) {
        return (
            <div className="flex flex-wrap justify-center gap-6 px-4 py-3">
                {notes.map((note) => (
                    <NoteCard key={note.id} note={note} fresh={note.id === freshId} />
                ))}
            </div>
        );
    }
    return (
        <div className="group/row overflow-hidden py-3 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <div
                className={cn(
                    'flex w-max gap-6 pr-6 motion-safe:animate-notes-marquee group-hover/row:[animation-play-state:paused] group-focus-within/row:[animation-play-state:paused] motion-reduce:overflow-x-auto',
                    reverse && '[animation-direction:reverse]',
                )}
                style={{ animationDuration: `${Math.max(30, notes.length * 7)}s` }}
            >
                {/* Twice through, so the loop has no seam. */}
                {[...notes, ...notes].map((note, i) => (
                    <div key={`${note.id}-${i}`} aria-hidden={i >= notes.length || undefined}>
                        <NoteCard note={note} fresh={i < notes.length && note.id === freshId} />
                    </div>
                ))}
            </div>
        </div>
    );
};

interface FormState {
    name: string;
    message: string;
    color: NoteColor;
}

const EMPTY: FormState = { name: '', message: '', color: 'lime' };

/**
 * "Notes from visitors": approved notes drift across two rows, and anyone
 * can pin one. A note shows to its author straight away (marked as waiting)
 * and to everyone once it is approved in /admin.
 */
export default function NotesWall() {
    const lenis = useLenis();
    const [notes, setNotes] = useState<PublicNote[] | null>(null);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [freshId, setFreshId] = useState<string | null>(null);
    const startedAt = useRef(0);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const titleId = useId();

    useEffect(() => {
        let alive = true;
        fetch('/api/notes', { cache: 'no-store' })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (alive && data?.ok) setNotes(data.notes);
            })
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);

    const close = useCallback(() => {
        setOpen(false);
        setError(null);
        triggerRef.current?.focus();
    }, []);

    // While the form is open the page behind it holds still, and Escape closes.
    useEffect(() => {
        if (!open) return;
        startedAt.current = Date.now();
        lenis?.stop();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close();
        };
        document.addEventListener('keydown', onKey);
        return () => {
            lenis?.start();
            document.removeEventListener('keydown', onKey);
        };
    }, [open, lenis, close]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (sending) return;
        const website = String(new FormData(event.currentTarget).get('website') ?? '');
        setSending(true);
        setError(null);
        try {
            const res = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, website, startedAt: startedAt.current }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.ok) {
                setError(data?.error ?? 'Could not send. Try again.');
                return;
            }
            const note: PublicNote = { ...data.note, pending: true };
            setNotes((current) => [note, ...(current ?? [])]);
            setFreshId(note.id);
            setForm(EMPTY);
            close();
        } catch {
            setError('Could not send. Check your connection.');
        } finally {
            setSending(false);
        }
    };

    // Analytics not set up (or the database is unreachable): no wall.
    if (!notes) return null;

    // One row until there are enough notes for two rows to both drift.
    const rows =
        notes.length >= 8
            ? [notes.filter((_, i) => i % 2 === 0), notes.filter((_, i) => i % 2 === 1)]
            : [notes, []];
    const left = NOTE_MESSAGE_MAX - form.message.length;

    return (
        <section aria-labelledby={`${titleId}-wall`} className="relative mb-16 w-full md:mb-24">
            <div className="page-container mb-6 flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        Guestbook
                    </p>
                    <h2 id={`${titleId}-wall`} className="mt-2 font-anton text-3xl leading-none md:text-4xl">
                        Notes from visitors
                    </h2>
                </div>
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
                >
                    <PenLine size={16} aria-hidden /> Leave a note
                </button>
            </div>

            {notes.length ? (
                <div className="space-y-2">
                    <Row notes={rows[0]} freshId={freshId} />
                    {rows[1].length > 0 && <Row notes={rows[1]} reverse freshId={freshId} />}
                </div>
            ) : (
                <p className="page-container text-center text-sm text-muted-foreground sm:text-left">
                    No notes yet. Be the first to pin one.
                </p>
            )}

            {open && (
                <div
                    className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:p-6"
                    onPointerDown={(event) => {
                        if (event.target === event.currentTarget) close();
                    }}
                >
                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        data-lenis-prevent
                        className="max-h-[92svh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border/60 bg-background-light p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 sm:rounded-3xl"
                    >
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h3 id={titleId} className="font-anton text-2xl leading-none">
                                    Leave a note
                                </h3>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Say hi, share feedback, or leave a thought. Notes show on the wall once approved.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={close}
                                aria-label="Close"
                                className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                            >
                                <X size={18} aria-hidden />
                            </button>
                        </div>

                        <form onSubmit={submit} className="space-y-4">
                            {/* Honeypot: hidden from people, filled in by bots. */}
                            <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
                                <label>
                                    Website
                                    <input name="website" type="text" tabIndex={-1} autoComplete="off" />
                                </label>
                            </div>

                            <label className="block">
                                <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                    Your note
                                </span>
                                <textarea
                                    required
                                    autoFocus
                                    rows={4}
                                    maxLength={NOTE_MESSAGE_MAX}
                                    value={form.message}
                                    onChange={(event) => setForm({ ...form, message: event.target.value })}
                                    placeholder="Loved the projects section…"
                                    className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                                />
                                <span className={cn('mt-1 block text-right text-xs', left < 20 ? 'text-amber-500' : 'text-muted-foreground')}>
                                    {left} left
                                </span>
                            </label>

                            <label className="block">
                                <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                    Name <span className="normal-case tracking-normal">(optional)</span>
                                </span>
                                <input
                                    maxLength={NOTE_NAME_MAX}
                                    value={form.name}
                                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                                    placeholder="Anonymous"
                                    autoComplete="name"
                                    className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                                />
                            </label>

                            <fieldset>
                                <legend className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                    Note colour
                                </legend>
                                <div className="mt-2 flex gap-2.5">
                                    {(Object.keys(NOTE_COLORS) as NoteColor[]).map((key) => (
                                        <label key={key} className="cursor-pointer">
                                            <input
                                                type="radio"
                                                name="color"
                                                value={key}
                                                checked={form.color === key}
                                                onChange={() => setForm({ ...form, color: key })}
                                                className="peer sr-only"
                                            />
                                            <span
                                                title={NOTE_COLORS[key].label}
                                                className="block size-9 rounded-full border border-black/10 transition-transform peer-checked:scale-110 peer-checked:ring-2 peer-checked:ring-primary peer-checked:ring-offset-2 peer-checked:ring-offset-background peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                                                style={{ backgroundColor: NOTE_COLORS[key].paper }}
                                            />
                                            <span className="sr-only">{NOTE_COLORS[key].label}</span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>

                            <p role="alert" className="min-h-5 text-sm text-red-500">
                                {error}
                            </p>

                            <button
                                type="submit"
                                disabled={sending || form.message.trim().length < 2}
                                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
                            >
                                {sending ? (
                                    <>
                                        <Loader2 size={17} className="animate-spin" aria-hidden /> Pinning…
                                    </>
                                ) : (
                                    'Pin it to the wall'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
