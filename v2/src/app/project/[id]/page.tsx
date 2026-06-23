import { loadProject } from "@/app/actions/project";
import { notFound } from "next/navigation";
import ProjectView from "./ProjectView";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await loadProject(id);

  if (!project) {
    notFound();
  }

  // Serialize Date fields to ISO strings for safe Server→Client transfer
  const serializedTasks = project.tasks.map((t) => ({
    id: t.id,
    name: t.name,
    start: t.start.toISOString(),
    finish: t.finish.toISOString(),
    duration: t.duration,
    progress: t.progress,
    isCritical: t.isCritical,
    isMilestone: t.isMilestone,
    isSummary: t.isSummary,
    outlineLevel: t.outlineLevel,
    dependencies: t.dependencies,
    baselineStart: t.baselineStart?.toISOString(),
    baselineFinish: t.baselineFinish?.toISOString(),
    baselineDuration: t.baselineDuration,
    earlyStart: t.earlyStart?.toISOString(),
    lateStart: t.lateStart?.toISOString(),
    earlyFinish: t.earlyFinish?.toISOString(),
    lateFinish: t.lateFinish?.toISOString(),
    totalFloat: t.totalFloat,
    percentComplete: t.percentComplete,
    wbs: t.wbs,
    resourceNames: t.resourceNames,
    cost: t.cost,
    actualCost: t.actualCost,
  }));

  return (
    <ProjectView
      projectId={project.id}
      tasks={serializedTasks}
      projectName={project.name}
      calendar={project.calendar}
    />
  );
}
