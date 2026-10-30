'use client';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useLenis } from 'lenis/react';
import React, { useEffect, useRef } from 'react';

gsap.registerPlugin(useGSAP);

const Preloader = () => {
    const preloaderRef = useRef<HTMLDivElement>(null);
    // Scrolling is locked while the loader covers the page: scrolling under it
    // showed its bars and the name over the projects. Lenis is undefined on
    // the first render, so it is read through a ref, or the unlock at the end
    // would hold the stale undefined and never restart it.
    const lenis = useLenis();
    const lenisRef = useRef(lenis);
    lenisRef.current = lenis;
    const doneRef = useRef(false);

    const unlock = () => {
        doneRef.current = true;
        document.documentElement.style.overflow = '';
        lenisRef.current?.start();
        preloaderRef.current?.classList.add('pointer-events-none');
        // Lets things that wait for the reveal (the hero coffee card) start
        // the moment the page is uncovered, and late mounts read the flag.
        document.documentElement.dataset.preloaded = 'true';
        window.dispatchEvent(new Event('preloader:done'));
    };

    // Lenis arrives a render later; stop it then if the loader is still up.
    useEffect(() => {
        if (lenis && !doneRef.current) {
            lenis.scrollTo(0, { immediate: true });
            lenis.stop();
        }
    }, [lenis]);

    useGSAP(
        () => {
            window.scrollTo(0, 0);
            document.documentElement.style.overflow = 'hidden';

            const tl = gsap.timeline({
                defaults: {
                    ease: 'power1.inOut',
                },
                onComplete: unlock,
            });

            tl.to('.name-text span', {
                y: 0,
                stagger: 0.05,
                duration: 0.2,
            });

            tl.to('.preloader-item', {
                delay: 1,
                y: '100%',
                duration: 0.5,
                stagger: 0.1,
            })
                .to('.name-text span', { autoAlpha: 0 }, '<0.5')
                .to(
                    preloaderRef.current,
                    {
                        autoAlpha: 0,
                    },
                    '<1',
                );

            // Never leave the page locked if the loader unmounts early.
            return () => {
                if (!doneRef.current) unlock();
            };
        },
        { scope: preloaderRef },
    );

    return (
        // z-[90]: sits above all page content, including the project cards'
        // z-10 internals, which live in the root stacking context, so nothing
        // leaks over the loader. Only the custom cursor (z-[100]) stays on top.
        <div className="fixed inset-0 z-[90] flex" ref={preloaderRef}>
            <div className="preloader-item h-full w-[10%] bg-black"></div>
            <div className="preloader-item h-full w-[10%] bg-black"></div>
            <div className="preloader-item h-full w-[10%] bg-black"></div>
            <div className="preloader-item h-full w-[10%] bg-black"></div>
            <div className="preloader-item h-full w-[10%] bg-black"></div>
            <div className="preloader-item h-full w-[10%] bg-black"></div>
            <div className="preloader-item h-full w-[10%] bg-black"></div>
            <div className="preloader-item h-full w-[10%] bg-black"></div>
            <div className="preloader-item h-full w-[10%] bg-black"></div>
            <div className="preloader-item h-full w-[10%] bg-black"></div>

            <p className="name-text flex whitespace-nowrap text-[clamp(2rem,8vw,110px)] font-name text-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 leading-none overflow-hidden">
                <span className="inline-block translate-y-full">H</span>
                <span className="inline-block translate-y-full">U</span>
                <span className="inline-block translate-y-full">S</span>
                <span className="inline-block translate-y-full">N</span>
                <span className="inline-block translate-y-full">A</span>
                <span className="inline-block translate-y-full">I</span>
                <span className="inline-block translate-y-full">N</span>
                <span className="inline-block translate-y-full pl-[0.3em]">M</span>
                <span className="inline-block translate-y-full">A</span>
                <span className="inline-block translate-y-full">R</span>
                <span className="inline-block translate-y-full">O</span>
                <span className="inline-block translate-y-full">O</span>
                <span className="inline-block translate-y-full">F</span>
            </p>
        </div>
    );
};

export default Preloader;


