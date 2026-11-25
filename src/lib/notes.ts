/** Shared by the notes form (browser) and the notes API (server). */

export const NOTE_NAME_MAX = 40;
export const NOTE_MESSAGE_MAX = 280;
export const NOTE_MESSAGE_MIN = 2;
/** A human needs a few seconds to write a note; bots submit instantly. */
export const NOTE_MIN_FILL_MS = 2500;

/** Sticky-note colours: soft paper tones that read in both themes. */
export const NOTE_COLORS = {
    lime: { label: 'Lime', paper: '#E6F9D5', ink: '#17301A' },
    sky: { label: 'Sky', paper: '#DCEFFE', ink: '#13283D' },
    peach: { label: 'Peach', paper: '#FFE5D6', ink: '#3D2014' },
    lilac: { label: 'Lilac', paper: '#ECE3FF', ink: '#291C47' },
    sand: { label: 'Sand', paper: '#FBF1CF', ink: '#3A2F0E' },
} as const;

export type NoteColor = keyof typeof NOTE_COLORS;

export const isNoteColor = (value: unknown): value is NoteColor =>
    typeof value === 'string' && value in NOTE_COLORS;

export interface PublicNote {
    id: string;
    name: string;
    message: string;
    color: NoteColor;
    createdAt: string;
    /** Only on the author's own notes that are still waiting for approval. */
    pending?: boolean;
}
