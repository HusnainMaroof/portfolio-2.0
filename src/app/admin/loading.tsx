/**
 * Shown while the dashboard loads (right after signing in, or on a first
 * visit while Neon wakes up): the dashboard's own shape, shimmering, so the
 * page never sits blank.
 */
const Block = ({ className }: { className: string }) => (
    <div
        className={`animate-pulse rounded-2xl bg-foreground/[0.06] motion-reduce:animate-none ${className}`}
    />
);

export default function Loading() {
    return (
        <section
            className="page-container min-h-svh pb-24 pt-24 sm:pt-28"
            aria-busy="true"
            aria-label="Loading the visitor dashboard"
        >
            <div className="mb-6 flex items-start justify-between sm:mb-8">
                <div className="space-y-3">
                    <Block className="h-3 w-32 rounded-full" />
                    <Block className="h-10 w-48 sm:h-12" />
                </div>
                <Block className="h-10 w-10 sm:w-28" />
            </div>
            <Block className="h-11 w-72 max-w-full" />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
                {Array.from({ length: 5 }, (_, i) => (
                    <Block
                        key={i}
                        className={`h-[104px] sm:h-[118px] ${i === 4 ? 'col-span-2 lg:col-span-1' : ''}`}
                    />
                ))}
            </div>
            <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-3">
                <Block className="h-56" />
                <Block className="h-56 lg:col-span-2" />
                <Block className="h-48" />
                <Block className="h-48" />
                <Block className="h-48" />
            </div>
        </section>
    );
}
