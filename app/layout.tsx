import type { Metadata } from 'next';
import { ReactLenis } from 'lenis/react';
import { Fraunces } from 'next/font/google';
import 'lenis/dist/lenis.css';
import './globals.css';
import Footer from '@/components/Footer';
import ScrollProgressIndicator from '@/components/ScrollProgressIndicator';
import ParticleBackground from '@/components/ParticleBackground';
import Navbar from '@/components/Navbar';
import CustomCursor from '@/components/CustomCursor';
import Preloader from '../components/Preloader';
import StickyEmail from './_components/StickyEmail';
import { GoogleAnalytics } from '@next/third-parties/google';
import Script from 'next/script';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
    title: 'Portfolio - Husnain Maroof',
    description: 'Personal portfolio of Husnain Maroof, a Fullstack developer.',
};
export const fraunces = Fraunces({
    subsets: ['latin'],
    weight: ['100', '400', '700'],
    variable: '--font-fraunces',
});

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
            <body className="antialiased">
                <ThemeProvider>
                    <ReactLenis
                        root
                        options={{
                            lerp: 0.1,
                            duration: 1.4,
                        }}
                    >
                        {/* <a
                            href="https://forms.gle/t73XYJgWD5cJNr6e8"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 block bg-black text-center z-[1] text-sm py-2 hover:text-primary transition-all"
                        >
                            Frontend dev? I&apos;ll help you polish your resume —
                            completely free.
                        </a> */}
                        <Navbar />
                        <main>{children}</main>
                        <Footer />

                        <CustomCursor />
                        <Preloader />
                        <ScrollProgressIndicator />
                        <ParticleBackground />
                        <StickyEmail />
                    </ReactLenis>
                </ThemeProvider>
            </body>
        </html>
    );
}
