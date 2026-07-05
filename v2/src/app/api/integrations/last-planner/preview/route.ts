import { NextRequest, NextResponse } from "next/server";
import type { GanttTask } from "@/components/gantt/types";
import { buildLastPlannerPreview } from "@/lib/integrations/lastPlanner";

type DateField =
  | "start"
  | "finish"
  | "baselineStart"
  | "baselineFinish"
  | "earlyStart"
  | "lateStart"
  | "earlyFinish"
  | "lateFinish"
  | "manualStart"
  | "constraintDate"
  | "deadline";

type SerializedTask = Omit<GanttTask, DateField> & {
  start: string;
  finish: string;
  baselineStart?: string;
  baselineFinish?: string;
  earlyStart?: string;
  lateStart?: string;
  earlyFinish?: string;
  lateFinish?: string;
  manualStart?: string;
  constraintDate?: string;
  deadline?: string;
};

function deserializeTask(task: SerializedTask): GanttTask {
  return {
    ...task,
    start: new Date(task.start),
    finish: new Date(task.finish),
    baselineStart: task.baselineStart ? new Date(task.baselineStart) : undefined,
    baselineFinish: task.baselineFinish ? new Date(task.baselineFinish) : undefined,
    earlyStart: task.earlyStart ? new Date(task.earlyStart) : undefined,
    lateStart: task.lateStart ? new Date(task.lateStart) : undefined,
    earlyFinish: task.earlyFinish ? new Date(task.earlyFinish) : undefined,
    lateFinish: task.lateFinish ? new Date(task.lateFinish) : undefined,
    manualStart: task.manualStart ? new Date(task.manualStart) : undefined,
    constraintDate: task.constraintDate ? new Date(task.constraintDate) : undefined,
    deadline: task.deadline ? new Date(task.deadline) : undefined,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    tasks?: SerializedTask[];
    windowStart?: string;
    weeks?: number;
    statusDate?: string;
  } | null;

  if (!body || !Array.isArray(body.tasks)) {
    return NextResponse.json(
      { error: "Envia un arreglo de tareas para generar el preview Last Planner." },
      { status: 400 },
    );
  }

  const tasks = body.tasks.map(deserializeTask).filter(
    (task) => !Number.isNaN(task.start.getTime()) && !Number.isNaN(task.finish.getTime()),
  );
  const windowStart = body.windowStart ? new Date(body.windowStart) : undefined;
  const statusDate = body.statusDate ? new Date(body.statusDate) : undefined;

  if (body.windowStart && Number.isNaN(windowStart?.getTime())) {
    return NextResponse.json(
      { error: "windowStart debe ser una fecha valida." },
      { status: 400 },
    );
  }

  if (body.statusDate && Number.isNaN(statusDate?.getTime())) {
    return NextResponse.json(
      { error: "statusDate debe ser una fecha valida." },
      { status: 400 },
    );
  }

  return NextResponse.json(
    buildLastPlannerPreview({
      tasks,
      windowStart,
      weeks: body.weeks,
      statusDate,
    }),
  );
}
