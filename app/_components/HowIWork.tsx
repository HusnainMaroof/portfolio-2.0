import { cn } from '@/lib/utils';

const PRINCIPLES = [
    {
        heading: 'Understand the real problem',
        description:
            'I focus on user needs, business goals, and technical constraints to find the right solution.',
    },
    {
        heading: 'Build with scalability in mind',
        description:
            'Clean architecture, modern tech stack, and best practices so your product grows without limits.',
    },
    {
        heading: 'Ship polished and keep improving',
        description:
            'Attention to detail, performance, and continuous feedback to make products people love to use.',
    },
];

const HowIWork = () => {
    return (
        <section id="how-i-work" className="pb-20 md:pb-28">
            <div className="max-w-[80%] mx-auto">
                {/* header: label + divider + idea > build > ship */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <h2 className="shrink-0 text-xs uppercase leading-none tracking-[0.2em] text-muted-foreground">
                        How I Work
                    </h2>

                    <span
                        aria-hidden
                        className="h-px min-w-8 flex-1 bg-border"
                    />

                    <span className="shrink-0 text-xs uppercase leading-none tracking-[0.2em] text-muted-foreground">
                        Idea &rarr; Build &rarr; Ship
                    </span>
                </div>

                {/* three principles, separated by thin lines instead of cards */}
                <div className="mt-10 grid md:mt-14 md:grid-cols-3">
                    {PRINCIPLES.map((item, index) => (
                        <div
                            key={item.heading}
                            className={cn(
                                index > 0 &&
                                    'border-t border-border pt-8 md:border-t-0 md:pt-0',
                                index > 0 && 'md:border-l md:border-border md:pl-10',
                                index < PRINCIPLES.length - 1 && 'md:pr-10',
                            )}
                        >
                            <h3 className="font-anton text-[26px] leading-tight text-foreground md:text-[34px]">
                                {item.heading}
                            </h3>

                            <p className="mt-3 max-w-[340px] text-sm leading-relaxed text-muted-foreground">
                                {item.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default HowIWork;
