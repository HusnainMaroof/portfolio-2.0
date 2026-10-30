import type { Metadata } from 'next';
import { ReactLenis } from 'lenis/react';
import { Fraunces, Instrument_Serif } from 'next/font/google';
import 'lenis/dist/lenis.css';
import './globals.css';
import ParticleBackground from '@/components/ParticleBackground';
// import Navbar from '@/components/Navbar';
import AvatarInteractions from '@/components/AvatarInteractions';
import Preloader from '../components/Preloader';
import StickyEmail from './_components/StickyEmail';
import { GoogleAnalytics } from '@next/third-parties/google';
import Script from 'next/script';
import { ThemeProvider } from '@/components/ThemeProvider';
import Footer from '@/components/Footer';
import SiteNav from '@/components/SiteNav';

const SITE_DESCRIPTION =
    'Husnain Maroof is a full-stack developer in Islamabad, Pakistan, building fast, reliable web and mobile products with Next.js, React, TypeScript, Tailwind CSS and Node.js: e-commerce, SaaS dashboards, marketing sites and developer tools. Available for remote projects.';
const SHARE_DESCRIPTION =
    'Full-stack developer building fast, reliable web and mobile products with Next.js, React, TypeScript and Node.js. Available for remote projects.';

export const metadata: Metadata = {
    metadataBase: new URL('https://husnain.cc'),
    title: {
        default: 'Husnain Maroof — Full-Stack Developer (Next.js, React)',
        template: '%s — Husnain Maroof',
    },
    description: SITE_DESCRIPTION,
    applicationName: 'Husnain Maroof Portfolio',
    authors: [{ name: 'Husnain Maroof', url: 'https://husnain.cc' }],
    creator: 'Husnain Maroof',
    publisher: 'Husnain Maroof',
    category: 'technology',
    keywords: [
        'Husnain Maroof',
        'full-stack developer',
        'full stack developer Islamabad',
        'Next.js developer',
        'Next.js developer Pakistan',
        'React developer',
        'TypeScript developer',
        'web and mobile app developer',
        'web application developer',
        'SaaS developer for hire',
        'freelance web developer Pakistan',
        'Node.js developer',
        'Tailwind CSS developer',
    ],
    alternates: {
        canonical: '/',
    },
    // Preview images come from app/opengraph-image.tsx and app/twitter-image.tsx.
    openGraph: {
        type: 'profile',
        url: '/',
        siteName: 'Husnain Maroof Portfolio',
        title: 'Husnain Maroof — Full-Stack Developer (Next.js, React)',
        description: SHARE_DESCRIPTION,
        locale: 'en_US',
        firstName: 'Husnain',
        lastName: 'Maroof',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Husnain Maroof — Full-Stack Developer (Next.js, React)',
        description: SHARE_DESCRIPTION,
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    formatDetection: { telephone: false },
    verification: {
        google: 'Z9TNcDorxGrRvGmB1xHhg7v_VRvjqeO7YL-kvLlKlPM',
    },
};
const fraunces = Fraunces({
    subsets: ['latin'],
    style: ['normal', 'italic'],
    variable: '--font-fraunces',
    display: 'swap',
});
const instrumentSerif = Instrument_Serif({
    subsets: ['latin'],
    weight: '400',
    style: ['normal', 'italic'],
    variable: '--font-display',
    display: 'swap',
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
            description: SHARE_DESCRIPTION,
            url: 'https://husnain.cc/',
            image: 'https://husnain.cc/hero/portrait-og.png',
            email: 'mailto:husnainmaroof95@gmail.com',
            address: {
                '@type': 'PostalAddress',
                addressLocality: 'Islamabad',
                addressCountry: 'PK',
            },
            sameAs: [
                'https://github.com/HusnainMaroof',
                'https://www.linkedin.com/in/husnain-maroof-aa80212b5/',
                'https://www.upwork.com/freelancers/~01e3f0c7b1d8a5e2f9',
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
                'Mobile app development',
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
        <html lang="en" className={`${fraunces.variable} ${instrumentSerif.variable}`}>
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
            <body className="antialiased">
                <ThemeProvider>
                    <ReactLenis
                        root
                        options={{
                            lerp: 0.1,
                            duration: 1.4,
                        }}
                    >
                        <SiteNav />
                        <main>{children}</main>
                        <Footer />

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
