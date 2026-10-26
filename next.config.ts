import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    async redirects() {
        // Production only: the *.vercel.app alias would otherwise serve a
        // duplicate of husnain.cc. Preview deployments stay reachable.
        if (process.env.VERCEL_ENV !== 'production') return [];

        return [
            {
                // www.husnain.cc served a 200 duplicate; consolidate on the apex
                source: '/:path*',
                has: [{ type: 'host', value: 'www.husnain.cc' }],
                destination: 'https://husnain.cc/:path*',
                permanent: true,
            },
            {
                source: '/:path*',
                has: [{ type: 'host', value: '.+\\.vercel\\.app' }],
                destination: 'https://husnain.cc/:path*',
                permanent: true,
            },
        ];
    },
};

export default nextConfig;
