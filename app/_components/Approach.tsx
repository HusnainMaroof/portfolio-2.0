import { APPROACH } from '@/content/hero';
import { cn } from '@/lib/utils';

/** What I build plus How I Work, moved out of the hero. */
const Approach = () => (
    <section id="approach" className="py-20 md:py-28">
        <div className="page-container">
            <div className="flex max-w-2xl flex-col gap-3 text-sm text-muted-foreground md:text-base">
                {APPROACH.bullets.map((bullet) => (
                    <p key={bullet.lead}>
                        <span className="font-semibold text-foreground">{bullet.lead}</span>{' '}
                        - {bullet.text}
                    </p>
                ))}
            </div>

            {/* header: label + divider + idea > build > ship */}
            <div className="mt-16 flex flex-wrap items-center gap-x-4 gap-y-2 md:mt-20">
                <p className="shrink-0 text-xs uppercase leading-none tracking-[0.2em] text-muted-foreground">
                    {APPROACH.label}
                </p>
                <span aria-hidden className="h-px min-w-8 flex-1 bg-border" />
                <span className="shrink-0 text-xs uppercase leading-none tracking-[0.2em] text-muted-foreground">
                    {APPROACH.flow}
                </span>
            </div>

            {/* three principles, separated by thin lines instead of cards */}
            <div className="mt-10 grid md:mt-14 md:grid-cols-3">
                {APPROACH.principles.map((principle, index) => (
                    <div
                        key={principle.heading}
                        className={cn(
                            index > 0 && 'border-t border-border pt-7 md:border-t-0 md:pt-0',
                            index > 0 && 'md:border-l md:border-border md:pl-10',
                            index < APPROACH.principles.length - 1 && 'md:pr-10',
                        )}
                    >
                        <h2 className="font-anton text-[20px] leading-tight text-foreground sm:text-[26px] md:text-[34px]">
                            {principle.heading}
                        </h2>
                        <p className="mt-3 max-w-[340px] text-sm leading-relaxed text-muted-foreground">
                            {principle.description}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    </section>
);

export default Approach;
