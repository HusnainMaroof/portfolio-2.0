'use client';

import TransitionLink from '@/components/TransitionLink';
import { cn } from '@/lib/utils';
import { IProject } from '@/types';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { PROJECTS } from '@/lib/data';
import SectionTitle from '@/components/SectionTitle';

gsap.registerPlugin(useGSAP);

// Width: applies only to the specific card's own role (active / compressed / idle).
// These are flex-grow ratios, not px — flex-grow is unitless, it's a share of
// the row's remaining space relative to its siblings' flex-grow values.
const ACTIVE_WIDTH_GROW = 1.5;
const DEFAULT_WIDTH_GROW = 1;
const COMPRESSED_WIDTH_GROW = 0.44;

interface CardProps {
    index: number;
    project: IProject;
    selectedProject: string | null;
    onMouseEnter: (slug: string) => void;
    onMouseLeave: () => void;
}

const ProjectCard = ({
    index,
    project,
    selectedProject,
    onMouseEnter,
    onMouseLeave,
}: CardProps) => {
    const arrowRef = useRef<SVGSVGElement>(null);

    const { context, contextSafe } = useGSAP(() => {}, {
        scope: arrowRef,
        revertOnUpdate: true,
    });

    const isRowActive = selectedProject !== null;
    const isActive = selectedProject === project.slug;
    const isCompressed = isRowActive && !isActive;
    const isIdle = !isRowActive;

    const handleMouseEnter = contextSafe?.(() => {
        onMouseEnter(project.slug);
        if (!arrowRef.current) return;

        gsap.killTweensOf(arrowRef.current);
        gsap.fromTo(
            arrowRef.current,
            { x: 0 },
            {
                x: 4,
                duration: 0.6,
                ease: 'power1.inOut',
                repeat: -1,
                yoyo: true,
            },
        );
    });

    const handleMouseLeave = contextSafe?.(() => {
        context.kill();
        onMouseLeave();
    });

    const widthGrow = isActive
        ? ACTIVE_WIDTH_GROW
        : isCompressed
            ? COMPRESSED_WIDTH_GROW
            : DEFAULT_WIDTH_GROW;

    // Two small preview stills for the V-panel. Fall back gracefully if a
    // project doesn't have a full `images` array populated yet.
    const imgLeft = project.images?.[0] ?? project.thumbnail;
    const imgRight = project.images?.[1] ?? project.longThumbnail ?? project.thumbnail;

    return (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
                flexGrow: widthGrow,
                flexBasis: 0,
            }}
            className={cn(
                'project-item group relative flex h-[280px]  min-w-0 px-2 flex-shrink flex-col justify-end overflow-hidden rounded-2xl border transition-[flex-grow,border-color,background-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                isActive
                    ? 'border-primary/60 bg-background-light/60 '
                    : 'border-border/40 bg-background-light/20 ',
            )}
        >
            {/* Idle affordance — only visible when nothing on the row is hovered yet */}
            <div
                className={cn(
                    'absolute top-3 right-3 z-10 flex items-center gap-1.5 transition-opacity duration-300',
                    isIdle ? 'opacity-100' : 'pointer-events-none opacity-0',
                )}
            >
         
                <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                    Hover ME
                </span>
            </div>

            {/* V-panel: two overlapping stills, mirrored rotation, pinned at bottom-center */}
            <div
                className={cn(
                    'pointer-events-none  inset-x-0 ml-auto mr-20  z-10 flex justify-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                    isActive
                        ? 'translate-y-0 opacity-100 delay-150'
                        : '-translate-y-3 opacity-0',
                )}
            >
                <div
                    style={{ transformOrigin: 'bottom center' }}
                    className="relative h-36 w-24 -rotate-[14deg] overflow-hidden rounded-xl border-1 border-border/60 shadow-lg "
                >
                    <Image
                        src={imgLeft}
                        alt={`${project.title} preview 1`}
                        fill
                        
                        className="object-cover border-2 "
                    />
                </div>
                <div
                    style={{ transformOrigin: 'bottom center' }}
                    className="relative -ml-5 h-36 w-24 rotate-[14deg] overflow-hidden rounded-xl border-10 border-gray-6007 shadow-lg"
                >
                    <Image
                        src={imgRight}
                        alt={`${project.title} preview 2`}
                        fill
                        
                        className="object-cover"
                    />
                </div>
            </div>

            {/* Expanded panel: full tech stack */}
            <div
                className={cn(
                    'absolute inset-x-0 top-0 z-10 flex flex-col gap-1.5 px-5 pt-5 transition-opacity duration-300',
                    isActive
                        ? 'opacity-100 delay-200 px-10'
                        : 'pointer-events-none opacity-0',
                )}
            >
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Skill set includes
                </span>
                <div className="h-px w-full bg-border/50" />
                <ul className="mt-0.5 space-y-1">
                    {project.techStack.map((tech) => (
                        <li
                            key={tech}
                            className="flex items-center gap-2 text-xs text-foreground/80"
                        >
                            <span className="size-1 shrink-0 rounded-full bg-primary" />
                            {tech}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="relative z-10 flex items-end justify-between gap-3 px-5 py-5 md:px-6 md:py-6">
                <div
                    style={{ transformOrigin: 'left bottom' }}
                    className={cn(
                        'flex items-center gap-2 whitespace-nowrap transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                        isCompressed && '-rotate-90',
                    )}
                >
                    <span className="font-anton text-[10px] text-muted-foreground">
                        _{(index + 1).toString().padStart(2, '0')}.
                    </span>
                    <h4 className="font-anton text-lg xs:text-2xl">
                        {project.title}
                    </h4>
                </div>

                <TransitionLink
                    href={`/projects/${project.slug}`}
                    className={cn(
                        'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs transition-all duration-300 hover:border-primary/60',
                        isActive
                            ? 'translate-y-0 opacity-100 delay-200'
                            : 'pointer-events-none translate-y-2 opacity-0',
                    )}
                >
                    View project
                    <svg
                        ref={arrowRef}
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                </TransitionLink>
            </div>
        </div>
    );
};

const ProjectsSection = () => {
    const [selectedProject, setSelectedProject] = useState<string | null>(null);

    return (
        <div id="my-projects" className="w-[80%] mx-auto">
            <SectionTitle title="My Project" />
            <div className="flex flex-row gap-3 md:gap-4">
                {PROJECTS.map((project, index) => (
                    <ProjectCard
                        key={project.slug}
                        index={index}
                        project={project}
                        selectedProject={selectedProject}
                        onMouseEnter={setSelectedProject}
                        onMouseLeave={() => setSelectedProject(null)}
                    />
                ))}
            </div>
        </div>
    );
};

export default ProjectsSection;