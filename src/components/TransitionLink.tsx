'use client';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { ComponentProps } from 'react';

interface Props extends ComponentProps<typeof Link> {
    back?: boolean;
}

gsap.registerPlugin(useGSAP);

/** If the new page never lifts the cover (failed or same-template navigation), lift it here. */
const COVER_SAFETY_MS = 2500;

/** True when there is an in-site page to go back to. */
const canGoBack = () =>
    window.history.length > 1 &&
    document.referrer !== '' &&
    new URL(document.referrer).origin === window.location.origin;

const TransitionLink = ({
    href,
    onClick,
    onMouseEnter,
    onFocus,
    children,
    back = false,
    ...rest
}: Props) => {
    const router = useRouter();

    const { contextSafe } = useGSAP(() => {});

    // Warm the route while the pointer is on the link, so the cover is up
    // for as short a time as possible.
    const prefetch = () => {
        if (!back && href) router.prefetch(href.toString());
    };

    const handleLinkClick = contextSafe(
        (e: React.MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault();

            gsap.killTweensOf(['.page-transition', '.page-transition--inner']);
            gsap.set('.page-transition', { yPercent: 100 });
            gsap.set('.page-transition--inner', { yPercent: 100 });

            gsap.to('.page-transition', {
                yPercent: 0,
                duration: 0.25,
                ease: 'power2.in',
                onComplete: () => {
                    if (back) {
                        // Opened directly (new tab, reload, shared link): there
                        // is no history entry, so go home instead of nowhere.
                        if (canGoBack()) router.back();
                        else router.push('/');
                    } else if (href) {
                        router.push(href.toString());
                    } else if (onClick) {
                        onClick(e);
                    }

                    window.setTimeout(() => {
                        const cover =
                            document.querySelector<HTMLElement>(
                                '.page-transition',
                            );

                        if (
                            cover &&
                            Number(gsap.getProperty(cover, 'yPercent')) === 0
                        ) {
                            gsap.to(cover, {
                                yPercent: -100,
                                duration: 0.4,
                                ease: 'power2.inOut',
                            });
                        }
                    }, COVER_SAFETY_MS);
                },
            });
        },
    );

    return (
        <Link
            href={href}
            {...rest}
            onClick={handleLinkClick}
            onMouseEnter={(e) => {
                prefetch();
                onMouseEnter?.(e);
            }}
            onFocus={(e) => {
                prefetch();
                onFocus?.(e);
            }}
        >
            {children}
        </Link>
    );
};

export default TransitionLink;
