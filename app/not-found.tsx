import Link from 'next/link';

const NotFound = () => (
    <section className="min-h-[70vh] flex flex-col justify-center items-center text-center px-6 py-24">
        <p className="font-anton text-7xl md:text-9xl leading-none text-primary">
            404
        </p>

        <h1 className="mt-6 font-anton text-2xl md:text-4xl leading-tight">
            Page not found
        </h1>

        <p className="mt-4 max-w-md text-sm md:text-base leading-relaxed text-muted-foreground">
            The page you are looking for does not exist or has moved. The
            case studies are still one click away.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-4">
            <Link
                href="/"
                className="rounded-xl bg-primary text-primary-foreground px-6 py-3 text-sm font-medium transition-transform duration-300 hover:-translate-y-0.5"
            >
                Back home
            </Link>
            <Link
                href="/#my-projects"
                className="rounded-xl border border-border/60 px-6 py-3 text-sm font-medium transition-colors duration-300 hover:text-primary"
            >
                View projects
            </Link>
        </div>
    </section>
);

export default NotFound;
