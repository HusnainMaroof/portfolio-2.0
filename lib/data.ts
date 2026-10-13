import { IProject } from '@/types';

export const GENERAL_INFO = {
    Name: 'Husnain Maroof',
    email: 'husnainmaroof95@gmail.com',

    emailSubject: "Let's collaborate on a project",
    emailBody: 'Hi Husnain, I am reaching out to you because...',

    oldPortfolio: 'https://husnain-maroof-portfolio.vercel.app',
    upworkProfile: 'https://www.upwork.com/freelancers/~01e3f0c7b1d8a5e2f9',
};

export const SOCIAL_LINKS = [
    { name: 'github', url: 'https://github.com/Tajmirul' },
    { name: 'linkedin', url: 'https://www.linkedin.com/in/tajmirul' },
    { name: 'facebook', url: 'https://www.facebook.com' },
    { name: 'Old Version', url: GENERAL_INFO.oldPortfolio },
];

export const MY_STACK = {
    frontend: [
        {
            name: 'HTML',
            icon: '/logo/html5.svg',
        },
        {
            name: 'CSS',
            icon: '/logo/css3.svg',
        },
        {
            name: 'JavaScript',
            icon: '/logo/js.png',
        },
        {
            name: 'TypeScript',
            icon: '/logo/ts.png',
        },
        {
            name: 'React',
            icon: '/logo/react.png',
        },
        {
            name: 'Next.js',
            icon: '/logo/next.png',
        },
        {
            name: 'Redux',
            icon: '/logo/redux.png',
        },
        {
            name: 'Tailwind CSS',
            icon: '/logo/tailwind.png',
        },
        {
            name: 'GSAP',
            icon: '/logo/gsap.png',
        },
        {
            name: 'Framer Motion',
            icon: '/logo/framer-motion.png',
        },
        {
            name: 'Sass',
            icon: '/logo/sass.png',
        },
        {
            name: 'Bootstrap',
            icon: '/logo/bootstrap.svg',
        },
    ],
    backend: [
        {
            name: 'Node.js',
            icon: '/logo/node.png',
        },
        {
            name: 'NestJS',
            icon: '/logo/nest.svg',
        },
        {
            name: 'Express.js',
            icon: '/logo/express.png',
        },
    ],
    database: [
        {
            name: 'MySQL',
            icon: '/logo/mysql.svg',
        },
        {
            name: 'PostgreSQL',
            icon: '/logo/postgreSQL.png',
        },
        {
            name: 'MongoDB',
            icon: '/logo/mongodb.svg',
        },
        {
            name: 'Prisma',
            icon: '/logo/prisma.png',
        },
        {
            name: 'Supabase',
            icon: '/logo/supabase.svg',
        },
    ],
    tools: [
        {
            name: 'Git',
            icon: '/logo/git.png',
        },
        {
            name: 'Docker',
            icon: '/logo/docker.svg',
        },
        {
            name: 'AWS',
            icon: '/logo/aws.png',
        },
    ],
};

/**
 * Add your own projects here. Shape (all fields reused by the carousel, list,
 * case-study page, and the avatar's project lines):
 *
 * {
 *     title: 'My Project',
 *     slug: 'my-project',
 *     liveUrl: 'https://…',          // optional
 *     sourceCode: 'https://…',       // optional
 *     year: 2026,
 *     description: 'HTML allowed',   // shown on the case-study page
 *     role: 'HTML allowed',          // shown on the case-study page
 *     techStack: ['Next.js', '…'],
 *     thumbnail: '/projects/thumbnail/…',
 *     longThumbnail: '/projects/long/…',
 *     images: ['/projects/images/…'], // carousel screenshots
 * }
 */
export const PROJECTS: IProject[] = [
    {
        title: 'Crispies',
        slug: 'crispies',
        liveUrl: 'https://crispiesuk.com/',
        year: 2026,
        description: `
      Crispies is the official website for Crispies, a 100% halal burger & crispy chicken brand serving London from 10+ takeaway locations. The site pairs a bold, food-first landing experience with the tools customers actually need: flavour discovery, a store locator with live opening hours, and a takeaway-only click & collect ordering flow. <br/> <br/>

      Key Features:<br/>
      <ul>
        <li>Flavour Explorer: interactive "Discover Your Crispy Flavor" section showcasing all Crispies original flavours with heat levels</li>
        <li>Store Locator: 10+ London locations with opening hours, live open/closed status, postcode search and an interactive map</li>
        <li>Click & Collect: cart and takeaway-only pickup ordering backed by a custom REST API</li>
        <li>Social Proof: embedded Instagram & TikTok feed straight from the brand's account</li>
        <li>Partner CTA: "Become A Partner" franchise section for brand expansion</li>
        <li>Fully Responsive: optimized for all device sizes</li>
      </ul><br/>

      Technical Highlights:
      <ul>
        <li>Built with Next.js and Tailwind CSS, animated with GSAP for a bold, scroll-driven landing experience</li>
        <li>Redux slices for cart, locations, ordering and UI state</li>
        <li>Custom REST API powering locations, menu and click & collect orders</li>
        <li>Cloudinary for media delivery; CARTO map tiles with Nominatim geocoding and postcode lookup</li>
        <li>SEO metadata, strict Content-Security-Policy and optimized assets for performance</li>
      </ul>
      `,
        role: `
      Full-Stack Developer <br/>
      Owned the entire project from concept to deployment:
      <ul>
        <li>Design: translated the brand's bold diner identity into a responsive, conversion-focused UI</li>
        <li>Frontend: built every page and component with Next.js, TypeScript and Tailwind CSS</li>
        <li>State: managed cart, locations and ordering flows with Redux</li>
        <li>Backend: implemented the REST API behind locations, menu and orders</li>
        <li>Integrations: store locator map, postcode search, Cloudinary media and Instagram/TikTok feeds</li>
        <li>Deployment: shipped to production behind nginx with CSP hardening and optimized caching</li>
      </ul>
      `,
        techStack: [
            'Next.js',
            'React',
            'TypeScript',
            'Tailwind CSS',
            'GSAP',
            'Redux',
            'Cloudinary',
            'Leaflet / Map',
            'REST API',
        ],
        thumbnail: '/projects/images/crispies-1.avif',
        longThumbnail: '/projects/images/crispies-6.avif',
        images: [
            '/projects/images/crispies-1.avif',
            '/projects/images/crispies-2.avif',
            '/projects/images/crispies-3.avif',
            '/projects/images/crispies-4.avif',
            '/projects/images/crispies-5.avif',
            '/projects/images/crispies-6.avif',
        ],
    },
    {
        title: 'Tijartt',
        slug: 'tijartt',
        liveUrl: 'https://www.tijartt.com/',
        year: 2026,
        description: `
      Tijartt is a business record-keeping app for stock-based businesses, built to answer three questions at a glance: what you have, what you owe, and what you earn. Stock, purchases, sales, payments and profit live in one record instead of scattered spreadsheets. <br/> <br/>

      Key Features:<br/>
      <ul>
        <li>Dashboard: revenue overview with charts breaking income down by source</li>
        <li>Stock: inventory levels kept in sync with every purchase and sale</li>
        <li>Purchases & Sales: record transactions against customers and suppliers in a few clicks</li>
        <li>Payments: see what is paid, what is due, and who it is owed to</li>
        <li>Reports: profit and performance reporting across the whole business</li>
        <li>Pricing & Auth: public marketing site with sign up, login and subscription tiers</li>
      </ul><br/>

      Technical Highlights:
      <ul>
        <li>Next.js App Router with server rendering and route caching for fast first loads</li>
        <li>Custom SVG charts built by hand instead of a heavy charting library</li>
        <li>Tailwind CSS utility workflow for a consistent design system</li>
        <li>Cloudinary for media storage and delivery</li>
        <li>Strict security headers (CSP, HSTS, frame denial) served behind nginx on Ubuntu</li>
      </ul>
      `,
        role: `
      Full-Stack Developer <br/>
      Owned the entire project from concept to deployment:
      <ul>
        <li>Design: modelled the data and UI around the have, owe and earn mental model</li>
        <li>Frontend: built the dashboard, charts and every screen with Next.js, TypeScript and Tailwind CSS</li>
        <li>Backend: implemented the records API behind stock, purchases, sales and payments</li>
        <li>Media: integrated Cloudinary for uploads and asset delivery</li>
        <li>Security: configured CSP and security headers, plus SSR and caching strategies</li>
        <li>Deployment: self-hosted behind nginx on Ubuntu with automated builds</li>
      </ul>
      `,
        techStack: [
            'Next.js',
            'React',
            'TypeScript',
            'Tailwind CSS',
            'Framer Motion',
            'Cloudinary',
            'REST API',
        ],
        thumbnail: '/projects/images/tijartt-1.avif',
        longThumbnail: '/projects/images/tijartt-7.avif',
        images: [
            '/projects/images/tijartt-1.avif',
            '/projects/images/tijartt-2.avif',
            '/projects/images/tijartt-3.avif',
            '/projects/images/tijartt-4.avif',
            '/projects/images/tijartt-5.avif',
            '/projects/images/tijartt-6.avif',
            '/projects/images/tijartt-7.avif',
        ],
    },
    {
        title: 'Warden',
        slug: 'warden',
        liveUrl: 'https://warden.blog/',
        year: 2026,
        description: `
      Warden is an open-source security tool that runs MCP servers inside a restricted sandbox instead of giving them access to your filesystem. Servers only get the files, hosts and environment variables you explicitly grant, so a misbehaving or compromised tool can never touch anything else. <br/> <br/>

      Key Features:<br/>
      <ul>
        <li>Sandboxed Execution: MCP servers run under a fail-closed sandbox with an explicit allowlist of files, hosts and env vars</li>
        <li>Web Fetch: uses web fetch to safely gather information from remote URLs inside the sandbox boundary</li>
        <li>Fail-Closed by Default: anything not explicitly granted is denied</li>
        <li>Docker Fallback: sandbox-exec on macOS with Docker as a portable fallback</li>
        <li>Audited & Open Source: CI-verified policy checks with the source available to review</li>
        <li>Drop-In Setup: wraps existing MCP server commands without changing them</li>
      </ul><br/>

      Technical Highlights:
      <ul>
        <li>OS-level sandboxing with macOS sandbox-exec and a Docker fallback for other platforms</li>
        <li>Policy generation from an explicit allowlist of filesystem paths, network hosts and environment variables</li>
        <li>Web fetch for information gathering, restricted to the hosts granted in the policy</li>
        <li>Fail-closed error handling: if a policy cannot be applied, the server does not start</li>
        <li>CI pipeline verifying sandbox policies on every change</li>
      </ul>
      `,
        role: `
      Full-Stack Developer <br/>
      Owned the entire project from concept to deployment:
      <ul>
        <li>Design: defined the threat model and the least-privilege allowlist approach</li>
        <li>Core: built the sandbox wrapper around MCP server processes</li>
        <li>Networking: implemented sandboxed web fetch limited to approved hosts</li>
        <li>Portability: added the Docker fallback alongside macOS sandbox-exec</li>
        <li>Quality: set up CI verification and audited the default policies</li>
        <li>Launch: shipped the marketing site and documentation at warden.blog</li>
      </ul>
      `,
        techStack: ['Sandboxing', 'Web Fetch', 'MCP', 'Docker', 'TypeScript', 'CI/CD'],
        thumbnail: '/projects/images/warden-1.avif',
        longThumbnail: '/projects/images/warden-6.avif',
        images: [
            '/projects/images/warden-1.avif',
            '/projects/images/warden-2.avif',
            '/projects/images/warden-3.avif',
            '/projects/images/warden-4.avif',
            '/projects/images/warden-5.avif',
            '/projects/images/warden-6.avif',
        ],
    },
    {
        title: 'Paymit',
        slug: 'paymit',
        liveUrl: 'https://paymit-iota.vercel.app/',
        year: 2024,
        description: `
      Paymit is a payment product project built as a clean, easy to use web experience. <br/> <br/>

      Key Features:<br/>
      <ul>
        <li>Clear, simple layouts for everyday payment flows</li>
        <li>Fully responsive design for all device sizes</li>
      </ul>
      `,
        role: `
      Frontend Developer <br/>
      <ul>
        <li>Built the user interface with reusable components</li>
        <li>Made the layouts responsive and consistent across pages</li>
      </ul>
      `,
        techStack: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS'],
        thumbnail: '/projects/images/paymit-1.avif',
        longThumbnail: '/projects/images/paymit-7.avif',
        images: [
            '/projects/images/paymit-1.avif',
            '/projects/images/paymit-2.avif',
            '/projects/images/paymit-3.avif',
            '/projects/images/paymit-4.avif',
            '/projects/images/paymit-5.avif',
            '/projects/images/paymit-6.avif',
            '/projects/images/paymit-7.avif',
        ],
    },
    {
        title: 'Pulse',
        slug: 'pulse',
        liveUrl: 'https://pulse-iota-one-11.vercel.app/',
        year: 2026,
        description: `
      Pulse is a web project with a clean, modern interface and a focus on a smooth user experience. <br/> <br/>

      Key Features:<br/>
      <ul>
        <li>Clear, simple layouts across all pages</li>
        <li>Fully responsive design for all device sizes</li>
      </ul>
      `,
        role: `
      Frontend Developer <br/>
      <ul>
        <li>Built the user interface with reusable components</li>
        <li>Made the layouts responsive and consistent across pages</li>
      </ul>
      `,
        techStack: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS'],
        thumbnail: '/projects/images/pulse-1.avif',
        longThumbnail: '/projects/images/pulse-5.avif',
        images: [
            '/projects/images/pulse-1.avif',
            '/projects/images/pulse-2.avif',
            '/projects/images/pulse-3.avif',
            '/projects/images/pulse-4.avif',
            '/projects/images/pulse-5.avif',
        ],
    },
    {
        title: 'Rafin Solutions',
        slug: 'rafin-solutions',
        liveUrl: 'https://rafinsolutions.com/',
        year: 2026,
        description: `
      Rafin Solutions is the official website for Rafin Solutions, a company offering digital solutions for its clients. <br/> <br/>

      Key Features:<br/>
      <ul>
        <li>Clear presentation of the company's services</li>
        <li>Fully responsive design for all device sizes</li>
      </ul>
      `,
        role: `
      Frontend Developer <br/>
      <ul>
        <li>Built the user interface with reusable components</li>
        <li>Made the layouts responsive and consistent across pages</li>
      </ul>
      `,
        techStack: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS'],
        thumbnail: '/projects/images/rafin-solutions-1.avif',
        longThumbnail: '/projects/images/rafin-solutions-5.avif',
        images: [
            '/projects/images/rafin-solutions-1.avif',
            '/projects/images/rafin-solutions-2.avif',
            '/projects/images/rafin-solutions-3.avif',
            '/projects/images/rafin-solutions-4.avif',
            '/projects/images/rafin-solutions-5.avif',
        ],
    },
    {
        title: 'Exam System',
        slug: 'exam-system',
        year: 2026,
        description: `
      Exam System is a web application for taking and managing exams online. <br/> <br/>

      Key Features:<br/>
      <ul>
        <li>Clear, simple screens for taking and reviewing exams</li>
        <li>Fully responsive design for all device sizes</li>
      </ul>
      `,
        role: `
      Frontend Developer <br/>
      <ul>
        <li>Built the user interface with reusable components</li>
        <li>Made the layouts responsive and consistent across pages</li>
      </ul>
      `,
        techStack: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS'],
        thumbnail: '/projects/images/exam-system-1.avif',
        longThumbnail: '/projects/images/exam-system-5.avif',
        images: [
            '/projects/images/exam-system-1.avif',
            '/projects/images/exam-system-2.avif',
            '/projects/images/exam-system-3.avif',
            '/projects/images/exam-system-4.avif',
            '/projects/images/exam-system-5.avif',
        ],
    },
];

export const MY_EXPERIENCE = [
    {
        title: 'Full Stack (Frontend)',
        company: 'Freelance',
        duration: ' 2025 - Present',
    },
    {
        title: 'Frontend Developer',
        company: 'Paymits',
        duration: 'jan 2024 - Nov 2024',
    },
    {
        title: 'Frontend Engineer',
        company: 'TangoPay',
        duration: 'Oct 2024 - jan 2025',
    },
];
