'use client';
import SectionTitle from '@/components/SectionTitle';
import { MY_STACK } from '@/lib/data';
import { revealOnEnter } from '@/lib/motion';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import Image from 'next/image';
import React, { useRef } from 'react';

gsap.registerPlugin(useGSAP);

const Skills = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Each row and tag rises in once as it enters, and then stays put. The
    // old version scrubbed opacity against the whole section's scroll, so
    // tags in the middle of the screen sat half-faded, and the section faded
    // out while its last rows were still being read.
    useGSAP(
        () => {
            const root = containerRef.current;
            if (!root) return;

            revealOnEnter(gsap.utils.toArray<HTMLElement>('.slide-up', root));
        },
        { scope: containerRef },
    );

    return (
        <section id="my-stack" ref={containerRef} className="pt-section">
            <div className="page-container">
                <SectionTitle title="My Stack" />

                <div className="space-y-20">
                    {Object.entries(MY_STACK).map(([key, value]) => (
                        <div className="grid sm:grid-cols-12" key={key}>
                            <div className="sm:col-span-5">
                                <p className="slide-up text-3xl font-anton leading-none text-muted-foreground uppercase sm:text-4xl md:text-5xl">
                                    {key}
                                </p>
                            </div>

                            <div className="sm:col-span-7 flex gap-x-8 gap-y-7 flex-wrap md:gap-x-11 md:gap-y-9">
                                {value.map((item) => (
                                    <div
                                        className="slide-up flex gap-3.5 items-center leading-none"
                                        data-avatar="skill"
                                        data-avatar-label={item.name}
                                        data-avatar-group={key}
                                        key={item.name}
                                    >
                                        <div>
                                            <Image
                                                src={item.icon}
                                                alt={item.name}
                                                width="40"
                                                height="40"
                                                className="max-h-10"
                                            />
                                        </div>
                                        <span className="text-lg capitalize sm:text-xl md:text-2xl">
                                            {item.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}


export default Skills;
