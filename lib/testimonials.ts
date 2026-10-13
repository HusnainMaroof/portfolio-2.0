/**
 * Testimonial screenshots for the Client Proof section.
 *
 * Add your own entries here. Shape:
 *
 * {
 *     title: 'Project name',            // shown as the full-view title
 *     src: '/projects/images/…',        // path under /public
 *     alt: 'Project: screenshot 1',    // lightbox alt text
 * }
 *
 * The `ClientProof` section is hidden on the home page while this list is
 * empty (see app/page.tsx).
 */
import { formatSlideCounter } from '@/lib/projects';

export interface TestimonialShot {
    /** Project the screenshot belongs to, shown as the full-view title. */
    title: string;
    /** Screenshot path under /public. */
    src: string;
    /** Human label used as the lightbox alt text. */
    alt: string;
}

// Placeholder screenshots (one per project) until real testimonial images are added.
export const TESTIMONIAL_SHOTS: TestimonialShot[] = [
    {
        title: 'Crispies',
        src: '/projects/images/crispies-1.avif',
        alt: 'Crispies: screenshot 1',
    },
    {
        title: 'Tijartt',
        src: '/projects/images/tijartt-1.avif',
        alt: 'Tijartt: screenshot 1',
    },
    {
        title: 'Paymit',
        src: '/projects/images/paymit-1.avif',
        alt: 'Paymit: screenshot 1',
    },
    {
        title: 'Pulse',
        src: '/projects/images/pulse-1.avif',
        alt: 'Pulse: screenshot 1',
    },
    {
        title: 'Rafin Solutions',
        src: '/projects/images/rafin-solutions-1.avif',
        alt: 'Rafin Solutions: screenshot 1',
    },
    {
        title: 'Exam System',
        src: '/projects/images/exam-system-1.avif',
        alt: 'Exam System: screenshot 1',
    },
];

/**
 * Slide counter in the same format as the project screenshots row:
 * `01 / 08`, reusing the shared project helper.
 */
export { formatSlideCounter };
