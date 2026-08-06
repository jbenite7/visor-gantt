"use client";

import BottlenecksView from "@/components/views/BottlenecksView";
import ConflictsView from "@/components/views/ConflictsView";
import type { GanttTask } from "@/components/gantt/types";
import type { Bottleneck, ScheduleIssue } from "@/lib/scheduling/types";

interface ProblemsViewProps {
  tasks: GanttTask[];
  issues: ScheduleIssue[];
  bottlenecks: Bottleneck[];
}

/**
 * Cuellos y Conflictos respondían la misma pregunta («¿qué está mal en el
 * plan?») desde dos entradas distintas del menú, con el mismo icono.
 */
export default function ProblemsView({
  tasks,
  issues,
  bottlenecks,
}: ProblemsViewProps) {
  return (
    <div className="apple-module h-full overflow-auto">
      <section data-testid="problems-section-bottlenecks">
        <BottlenecksView issues={issues} bottlenecks={bottlenecks} />
      </section>

      <section data-testid="problems-section-conflicts">
        <ConflictsView tasks={tasks} />
      </section>
    </div>
  );
}
