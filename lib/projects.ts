import { IProject } from '@/types';

export interface ProjectAction {
    label: string;
    href: string;
    external: boolean;
}

/** Zero-padded index, e.g. `01`, used for numbering and slide counters. */
export const padIndex = (value: number): string => String(value).padStart(2, '0');

/** Slide counter formatted from the real position and real image count. */
export const formatSlideCounter = (position: number, total: number): string =>
    `${padIndex(position)} / ${padIndex(total)}`;

const stripHtml = (html: string): string =>
    html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const splitSentences = (text: string): string[] =>
    (text.match(/[^.!?]+[.!?]*/g) ?? [])
        .map((sentence) => sentence.trim())
        .filter(Boolean);

/**
 * A short summary taken verbatim from the project's real description.
 *
 * Descriptions in `lib/data.ts` are HTML blobs (lists, `<br/>`, emoji), so the
 * markup is dropped and the text is trimmed at sentence/word boundaries. The
 * wording itself is never rewritten. Nothing here invents copy.
 */
export const getShortDescription = (
    project: IProject,
    maxLength = 240,
): string => {
    const text = stripHtml(project.description ?? '');

    if (!text) return '';

    const sentences = splitSentences(text);

    if (!sentences.length) return text;

    let summary = sentences[0];

    // A very short opener on its own reads like a teaser, not a description;
    // carry the following sentence along when it still fits the budget.
    if (summary.length < 80 && sentences[1]) {
        const combined = `${summary} ${sentences[1]}`;

        if (combined.length <= maxLength) summary = combined;
    }

    if (summary.length <= maxLength) return summary;

    const head = summary.slice(0, maxLength);
    const boundary = head.lastIndexOf(' ');

    return `${(boundary > maxLength * 0.6 ? head.slice(0, boundary) : head).trim()}…`;
};

/**
 * The only actions ever rendered for a project: the project's own detail route
 * (which already exists at `/projects/[slug]`) plus any external destinations
 * that are actually present in the data. Never any placeholder URLs.
 */
export const getProjectActions = (project: IProject): ProjectAction[] => {
    const actions: ProjectAction[] = [];

    if (project.slug) {
        actions.push({
            label: 'Case study',
            href: `/projects/${project.slug}`,
            external: false,
        });
    }

    if (project.liveUrl) {
        actions.push({
            label: 'Visit site',
            href: project.liveUrl,
            external: true,
        });
    }

    if (project.sourceCode) {
        actions.push({
            label: 'Source code',
            href: project.sourceCode,
            external: true,
        });
    }

    return actions;
};
