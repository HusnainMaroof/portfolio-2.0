import type { Metadata } from 'next';
import { ReactLenis } from 'lenis/react';
import { Fraunces } from 'next/font/google';
import 'lenis/dist/lenis.css';
import './globals.css';
import ParticleBackground from '@/components/ParticleBackground';
// import Navbar from '@/components/Navbar';
import CustomCursor from '@/components/CustomCursor';
import AvatarInteractions from '@/components/AvatarInteractions';
import Preloader from '../components/Preloader';
import StickyEmail from './_components/StickyEmail';
import { GoogleAnalytics } from '@next/third-parties/google';
import Script from 'next/script';
import { ThemeProvider } from '@/components/ThemeProvider';
import Footer from '@/components/Footer';
import PortfolioSidebar from '@/components/portfolio-sidebar';

export const metadata: Metadata = {
    metadataBase: new URL('https://husnain.cc'),
    title: {
        default: 'Husnain Maroof — Full-Stack Developer (Next.js, React)',
        template: '%s — Husnain Maroof',
    },
    description:
        'Freelance full-stack developer in Islamabad, Pakistan. Husnain Maroof builds fast, polished, high-performing web apps with Next.js, React, TypeScript, Tailwind CSS and Node.js. Available for remote projects.',
    keywords: [
        'Husnain Maroof',
        'full-stack developer',
        'full stack developer Islamabad',
        'Next.js developer',
        'Next.js developer Pakistan',
        'React developer',
        'TypeScript developer',
        'web application developer',
        'SaaS developer for hire',
        'freelance web developer Pakistan',
        'Node.js developer',
        'Tailwind CSS developer',
    ],
    alternates: {
        canonical: '/',
    },
    openGraph: {
        type: 'website',
        url: '/',
        siteName: 'Husnain Maroof Portfolio',
        title: 'Husnain Maroof — Full-Stack Developer (Next.js, React)',
        description:
            'Freelance full-stack developer in Islamabad, Pakistan. Fast, polished web apps with Next.js, React, TypeScript and Node.js.',
        locale: 'en_US',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Husnain Maroof — Full-Stack Developer (Next.js, React)',
        description:
            'Freelance full-stack developer in Islamabad, Pakistan. Fast, polished web apps with Next.js, React and TypeScript.',
    },
    robots: {
        index: true,
        follow: true,
    },
};
export const fraunces = Fraunces({
    subsets: ['latin'],
    weight: ['100', '400', '700'],
    variable: '--font-fraunces',
});

/*
 * Entity identity for search engines and AI answer engines. Every field is
 * taken from real, visible site content (lib/data.ts, footer, About) so the
 * schema never claims anything the page does not say.
 */
const PERSON_JSON_LD = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'Person',
            '@id': 'https://husnain.cc/#husnain-maroof',
            name: 'Husnain Maroof',
            jobTitle: 'Full-Stack Developer',
            url: 'https://husnain.cc/',
            email: 'mailto:husnainmaroof95@gmail.com',
            address: {
                '@type': 'PostalAddress',
                addressLocality: 'Islamabad',
                addressCountry: 'PK',
            },
            sameAs: [
                'https://www.upwork.com/freelancers/~01e3f0c7b1d8a5e2f9',
                'https://husnain-maroof-portfolio.vercel.app',
            ],
            knowsAbout: [
                'Next.js',
                'React',
                'TypeScript',
                'Tailwind CSS',
                'Node.js',
                'NestJS',
                'Express.js',
                'PostgreSQL',
                'MySQL',
                'MongoDB',
                'Prisma',
                'Supabase',
                'GSAP',
                'Framer Motion',
                'Web application development',
                'SaaS development',
            ],
        },
        {
            '@type': 'WebSite',
            '@id': 'https://husnain.cc/#website',
            url: 'https://husnain.cc/',
            name: 'Husnain Maroof Portfolio',
            inLanguage: 'en',
            publisher: { '@id': 'https://husnain.cc/#husnain-maroof' },
        },
        {
            '@type': 'ProfilePage',
            '@id': 'https://husnain.cc/#webpage',
            url: 'https://husnain.cc/',
            name: 'Husnain Maroof — Full-Stack Developer (Next.js, React)',
            inLanguage: 'en',
            isPartOf: { '@id': 'https://husnain.cc/#website' },
            mainEntity: { '@id': 'https://husnain.cc/#husnain-maroof' },
        },
    ],
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <GoogleAnalytics gaId="G-MHLY1LNGY5" />
            <Script id="hotjar" strategy="afterInteractive">
                {`(function(h,o,t,j,a,r){
                h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                h._hjSettings={hjid:6380611,hjsv:6};
                a=o.getElementsByTagName('head')[0];
                r=o.createElement('script');r.async=1;
                r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                a.appendChild(r);
            })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`}
            </Script>
            <body className="antialiased pb-[68px] lg:pb-0">
                <ThemeProvider>
                    <ReactLenis
                        root
                        options={{
                            lerp: 0.1,
                            duration: 1.4,
                        }}
                    >
                        {/* lg+: clear the fixed 148px left rail so no section's */}
                        {/* 80%-centred container can ever slide under it. */}
                        <main className="lg:pl-[156px]">{children}</main>
                        <PortfolioSidebar />
                        <Footer />

                        <CustomCursor />
                        <AvatarInteractions />
                        <Preloader />
                        <ParticleBackground />
                        <StickyEmail />
                    </ReactLenis>

                    <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{
                            __html: JSON.stringify(PERSON_JSON_LD).replace(
                                /</g,
                                '\\u003c',
                            ),
                        }}
                    />
                </ThemeProvider>
            </body>
        </html>
    );
}
