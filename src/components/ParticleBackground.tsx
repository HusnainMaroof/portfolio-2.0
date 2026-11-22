'use client';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useMemo, useRef } from 'react';
import { useTheme } from '@/components/ThemeProvider';

gsap.registerPlugin(useGSAP);

const ParticleBackground = () => {
    const particlesRef = useRef<HTMLDivElement[]>([]);
    const { theme } = useTheme();
    const particleColor = theme === 'light' ? '#111111' : '#ffffff';
    const particleCount = useMemo(() => 100, []);

    useGSAP(() => {
        // Reduced motion: the dots stay as a still starfield.
        const still = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;

        particlesRef.current.forEach((particle) => {
            // Phones hide every other dot (see the container class); a hidden
            // dot needs no endless tween.
            if (getComputedStyle(particle).display === 'none') return;

            gsap.set(particle, {
                width: Math.random() * 3 + 1,
                height: Math.random() * 3 + 1,
                opacity: Math.random(),
                // Percentages, so the field still covers the screen after a
                // resize or a rotated phone.
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
            });

            if (still) return;

            gsap.to(particle, {
                y: window.innerHeight,
                duration: Math.random() * 10 + 10,
                opacity: 0,
                repeat: -1,
                ease: 'none',
            });
        });
    }, []);

    return (
        <div className="fixed inset-0 z-0 pointer-events-none max-md:[&>div:nth-child(2n)]:hidden">
            {[...Array(particleCount)].map((_, i) => (
                <div
                    key={i}
                    ref={(el) => {
                        // Assign by index: pushing grew the list on every re-render.
                        if (el) particlesRef.current[i] = el;
                    }}
                    className="absolute rounded-full"
                    style={{ backgroundColor: particleColor }}
                />
            ))}
        </div>
    );
};

export default ParticleBackground;
