'use client';

import TransitionLink from '@/components/TransitionLink';
import { IProject } from '@/types';
import {
    getProjectActions,
    getShortDescription,
    padIndex,
} from '@/lib/projects';

interface ProjectListRowProps {
    project: IProject;
    index: number;
}

export const ProjectListRow = ({ project, index }: ProjectListRowProps) => {
    const actions = getProjectActions(project);
    const description = getShortDescription(project);
    const hasStack = project.techStack.length > 0;

    return (
        <article
            className="border-b border-border/50"
            data-avatar="project"
            data-avatar-label={project.title}
            data-avatar-detail={project.techStack.slice(0, 3).join(', ')}
            data-avatar-slug={project.slug}
        >
            <div className="grid gap-4 py-7 md:grid-cols-12 md:gap-6 md:py-10">
                {/* left: number */}
                <div className="md:col-span-1">
                    <span className="text-xs tracking-[0.16em] text-muted-foreground/80 tabular-nums">
                        {padIndex(index + 1)}
                    </span>
                </div>

                {/* center: details */}
                <div className="min-w-0 md:col-span-7">
                    <h3 className="text-xl font-semibold text-foreground md:text-3xl">
                        {project.title}
                    </h3>

                    {description && (
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                            {description}
                        </p>
                    )}

                    {actions.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                            {actions.map((action) => {
                                const className =
                                    'text-sm text-muted-foreground underline-offset-4 transition-colors duration-200 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:text-primary';

                                return action.external ? (
                                    <a
                                        key={action.label}
                                        href={action.href}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className={className}
                                    >
                                        {action.label}
                                    </a>
                                ) : (
                                    <TransitionLink
                                        key={action.label}
                                        href={action.href}
                                        className={className}
                                    >
                                        {action.label}
                                    </TransitionLink>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* right: year + technologies */}
                <div className="md:col-span-4 md:text-right">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {project.year}
                    </p>

                    {hasStack && (
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
                            {project.techStack.join(' · ')}
                        </p>
                    )}
                </div>
            </div>
        </article>
    );
};

interface Props {
    projects: IProject[];
}

const SelectedWorkList = ({ projects }: Props) => (
    <div className="border-t border-border/50">
        {projects.map((project, index) => (
            <ProjectListRow
                key={project.slug}
                project={project}
                index={index}
            />
        ))}
    </div>
);

export default SelectedWorkList;
