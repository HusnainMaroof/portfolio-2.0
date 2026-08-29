'use client';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import React from 'react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface AboutMeProps {
    // Pass the ref/selector your useVirtualScroll hook uses as the
    // scroll proxy. Leave undefined to fall back to native window scroll.
    scrollerRef?: React.RefObject<HTMLElement> | string;
}

const AboutMe = ({ scrollerRef }: AboutMeProps) => {
    const container = React.useRef<HTMLDivElement>(null);

    const scroller = scrollerRef
        ? typeof scrollerRef === 'string'
            ? scrollerRef
            : scrollerRef.current
        : undefined;

    useGSAP(
        () => {
            const tlIn = gsap.timeline({
                scrollTrigger: {
                    id: 'about-me-in',
                    trigger: container.current,
                    scroller,
                    start: 'top 70%',
                    end: 'bottom bottom',
                    scrub: 1.5,
                },
            });

            tlIn.from('.slide-up-and-fade', {
                y: 150,
                opacity: 0,
                stagger: 0.05,
            });

            const tlOut = gsap.timeline({
                scrollTrigger: {
                    id: 'about-me-out',
                    trigger: container.current,
                    scroller,
                    start: 'bottom 50%',
                    end: 'bottom 10%',
                    scrub: 1.5,
                },
            });

            tlOut.to('.slide-up-and-fade', {
                y: -150,
                opacity: 0,
                stagger: 0.02,
            });

            return () => {
                ScrollTrigger.getById('about-me-in')?.kill();
                ScrollTrigger.getById('about-me-out')?.kill();
            };
        },
        { scope: container, dependencies: [scroller] },
    );

    return (
        <section className="pb-section" id="about-me">
            <div className="max-w-[80%] mx-auto" ref={container}>
                <p className="pb-3 border-b text-muted-foreground slide-up-and-fade">
                    This is me.
                </p>

                <div className="grid md:grid-cols-12 mt-9">
                    <div className="md:col-span-5">
                        <p className="text-5xl slide-up-and-fade">
                            Hi, I&apos;m Husnain.
                        </p>
                    </div>

                    <div className="md:col-span-7 text-2xl text-muted-foreground max-w-[450px] md:max-w-none">
                        <div className="mb-10 leading-35 tracking-widest">
                            I&apos;m a full-stack developer focused on
                            building fast, polished web experiences — from
                            pixel-level scroll animation to
                            production-grade data-driven apps.
                        </div>
                        My approach focuses on creating scalable,
                        high-performing solutions tailored to both user
                        needs and business objectives. By prioritizing
                        performance, accessibility, and responsiveness, I
                        strive to deliver experiences that not only engage
                        users but also drive tangible results.
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AboutMe;