import { Dependency, DependencyType, Task } from "./types";

export interface SchedulingCalendar {
  getNextWorkingDay(date: Date): Date;
  getPreviousWorkingDay(date: Date): Date;
  addLag(start: Date, minutesLag: number): Date;
  subtractLag(end: Date, minutesLag: number): Date;
  addDuration(start: Date, minutes: number): Date;
  subtractDuration(end: Date, minutes: number): Date;
}

export class CPMCalculatorService {
  constructor(private calendar: SchedulingCalendar) {}

  calculate(
    tasks: Task[],
    dependencies: Dependency[],
    projectStart: Date,
  ): Task[] {
    // 0. Map helper
    const taskMap = new Map<string | number, Task>();
    tasks.forEach((t) => taskMap.set(t.id, { ...t })); // Clone to avoid mutation of input

    // 1. Build Graph
    const successors = new Map<string | number, Dependency[]>();
    const predecessors = new Map<string | number, Dependency[]>();
    const inDegree = new Map<string | number, number>();

    tasks.forEach((t) => {
      successors.set(t.id, []);
      predecessors.set(t.id, []);
      inDegree.set(t.id, 0);
    });

    dependencies.forEach((dep) => {
      if (!taskMap.has(dep.predecessorId) || !taskMap.has(dep.successorId))
        return;

      successors.get(dep.predecessorId)?.push(dep);
      predecessors.get(dep.successorId)?.push(dep);
      inDegree.set(dep.successorId, (inDegree.get(dep.successorId) || 0) + 1);
    });

    // 2. Topological Sort
    const sortedIds = this.topologicalSort(taskMap, successors, inDegree);

    // 3. Forward Pass
    this.forwardPass(sortedIds, taskMap, predecessors, projectStart);

    // 4. Backward Pass
    const projectFinish = this.getProjectFinishDate(taskMap);
    this.backwardPass(sortedIds, taskMap, successors, projectFinish);

    // 5. Float & Criticality
    taskMap.forEach((task) => {
      if (task.earlyStart && task.lateStart) {
        const diffMs = task.lateStart.getTime() - task.earlyStart.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);
        task.totalFloat = diffMinutes;
        task.isCritical = diffMinutes <= 15; // Tolerance
      }
    });

    // 6. Rollup Summaries (Top-Down or Bottom-Up?)
    // Rule 1: Summary Calculation based on children.
    // We need original order or level-based sort.
    // Tasks array 'tasks' usually comes in WBS order.
    return this.rollUpSummaryDates(
      Array.from(taskMap.values()),
      tasks.map((t) => t.id),
    );
  }

  private topologicalSort(
    taskMap: Map<string | number, Task>,
    successors: Map<string | number, Dependency[]>,
    inDegree: Map<string | number, number>,
  ): (string | number)[] {
    const queue: (string | number)[] = [];
    const sorted: (string | number)[] = [];

    inDegree.forEach((degree, id) => {
      if (degree === 0) queue.push(id);
    });

    while (queue.length > 0) {
      const u = queue.shift()!;
      sorted.push(u);

      const deps = successors.get(u) || [];
      deps.forEach((dep) => {
        const v = dep.successorId;
        inDegree.set(v, inDegree.get(v)! - 1);
        if (inDegree.get(v) === 0) {
          queue.push(v);
        }
      });
    }

    // Handle cycles if needed (sorted.length !== taskMap.size)
    return sorted;
  }

  private forwardPass(
    sortedIds: (string | number)[],
    taskMap: Map<string | number, Task>,
    predecessors: Map<string | number, Dependency[]>,
    projectStart: Date,
  ) {
    sortedIds.forEach((id) => {
      const task = taskMap.get(id)!;

      // Initial ES
      let earlyStart = new Date(projectStart);

      // Respect Manual Start
      if (task.manualStart) {
        if (task.manualStart.getTime() > earlyStart.getTime()) {
          earlyStart = new Date(task.manualStart);
        }
      }

      // Check Predecessors
      const preds = predecessors.get(id) || [];
      preds.forEach((dep) => {
        const predTask = taskMap.get(dep.predecessorId);
        if (!predTask || !predTask.earlyFinish || !predTask.earlyStart) return;

        let candidateDate: Date | null = null;

        // Lag Calculation
        let actualLag = dep.lag;
        if (dep.isPercentage) {
          // Dep logic: based on predecessor duration
          actualLag = Math.floor((predTask.durationMinutes * dep.lag) / 100);
        }

        switch (dep.type) {
          case DependencyType.FinishToStart: // ES = Pred.EF + Lag
            // Logic: Finish is Inclusive. Next starts next working moment.
            // PHP used getNextWorkingDay(EF) then addLag.
            const baseDate = this.calendar.getNextWorkingDay(
              predTask.earlyFinish,
            );
            candidateDate = this.calendar.addLag(baseDate, actualLag);
            break;
          case DependencyType.StartToStart: // ES = Pred.ES + Lag
            candidateDate = this.calendar.addLag(
              predTask.earlyStart,
              actualLag,
            );
            break;
          case DependencyType.FinishToFinish: // ES = (Pred.EF + Lag) - Duration
            const targetEF = this.calendar.addLag(
              predTask.earlyFinish,
              actualLag,
            );
            candidateDate = this.calendar.subtractDuration(
              targetEF,
              task.durationMinutes,
            );
            break;
          case DependencyType.StartToFinish: // ES = (Pred.ES + Lag) - Duration
            const targetEF_SF = this.calendar.addLag(
              predTask.earlyStart,
              actualLag,
            );
            candidateDate = this.calendar.subtractDuration(
              targetEF_SF,
              task.durationMinutes,
            );
            break;
        }

        if (candidateDate && candidateDate.getTime() > earlyStart.getTime()) {
          earlyStart = candidateDate;
        }
      });

      task.earlyStart = earlyStart;
      task.earlyFinish = this.calendar.addDuration(
        earlyStart,
        task.durationMinutes,
      );
    });
  }

  private backwardPass(
    sortedIds: (string | number)[],
    taskMap: Map<string | number, Task>,
    successors: Map<string | number, Dependency[]>,
    projectFinish: Date,
  ) {
    // Reverse order
    for (let i = sortedIds.length - 1; i >= 0; i--) {
      const id = sortedIds[i];
      const task = taskMap.get(id)!;

      let lateFinish = new Date(projectFinish);

      const succs = successors.get(id) || [];
      if (succs.length > 0) {
        let minLF: Date | null = null;

        succs.forEach((dep) => {
          const succTask = taskMap.get(dep.successorId);
          if (!succTask || !succTask.lateStart || !succTask.lateFinish) return;

          let candidateLF: Date | null = null;
          let actualLag = dep.lag;
          if (dep.isPercentage) {
            // Based on THIS task (predecessor) duration
            actualLag = Math.floor((task.durationMinutes * dep.lag) / 100);
          }

          switch (dep.type) {
            case DependencyType.FinishToStart: // LF = Succ.LS - Lag (PrevWorking)
              const baseDate = this.calendar.subtractLag(
                succTask.lateStart,
                actualLag,
              );
              candidateLF = this.calendar.getPreviousWorkingDay(baseDate);
              break;
            case DependencyType.StartToStart: // LS <= Succ.LS - Lag => LF = LS + Dur
              const limitLS = this.calendar.subtractLag(
                succTask.lateStart,
                actualLag,
              );
              candidateLF = this.calendar.addDuration(
                limitLS,
                task.durationMinutes,
              );
              break;
            case DependencyType.FinishToFinish: // LF <= Succ.LF - Lag
              candidateLF = this.calendar.subtractLag(
                succTask.lateFinish,
                actualLag,
              );
              break;
            case DependencyType.StartToFinish: // LS <= Succ.LF - Lag
              const limitLS_SF = this.calendar.subtractLag(
                succTask.lateFinish,
                actualLag,
              );
              candidateLF = this.calendar.addDuration(
                limitLS_SF,
                task.durationMinutes,
              );
              break;
          }

          if (candidateLF) {
            if (!minLF || candidateLF.getTime() < minLF.getTime()) {
              minLF = candidateLF;
            }
          }
        });

        if (minLF) lateFinish = minLF;
      }

      task.lateFinish = lateFinish;
      task.lateStart = this.calendar.subtractDuration(
        lateFinish,
        task.durationMinutes,
      );
    }
  }

  private getProjectFinishDate(taskMap: Map<string | number, Task>): Date {
    let max = new Date(0);
    taskMap.forEach((t) => {
      if (t.earlyFinish && t.earlyFinish.getTime() > max.getTime()) {
        max = t.earlyFinish;
      }
    });
    return max.getTime() === 0 ? new Date() : max;
  }

  private rollUpSummaryDates(
    tasks: Task[],
    originalOrderIds: (string | number)[],
  ): Task[] {
    // Reconstruct order to ensure hierarchy processing
    const taskMap = new Map<string | number, Task>();
    tasks.forEach((t) => taskMap.set(t.id, t));

    const ordered: Task[] = [];
    originalOrderIds.forEach((id) => {
      const t = taskMap.get(id);
      if (t) ordered.push(t);
    });

    // Identify children
    // Use stack approach from PHP
    const childrenOf = new Map<string | number, (string | number)[]>();
    const stack: Map<number, string | number> = new Map();

    ordered.forEach((task) => {
      const level = task.outlineLevel;
      if (level > 1) {
        if (stack.has(level - 1)) {
          const parentId = stack.get(level - 1)!;
          if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
          childrenOf.get(parentId)!.push(task.id);
        }
      }
      stack.set(level, task.id);
    });

    // Process parents Bottom-Up
    // Filter tasks that are parents
    const parents = ordered.filter((t) => childrenOf.has(t.id));
    // Sort by outline level DESC (deepest first)
    parents.sort((a, b) => b.outlineLevel - a.outlineLevel);

    parents.forEach((parent) => {
      let minStart: Date | null = null;
      let maxFinish: Date | null = null;

      childrenOf.get(parent.id)?.forEach((childId) => {
        const child = taskMap.get(childId);
        if (!child || !child.earlyStart || !child.earlyFinish) return;

        if (!minStart || child.earlyStart.getTime() < minStart.getTime()) {
          minStart = child.earlyStart;
        }
        if (!maxFinish || child.earlyFinish.getTime() > maxFinish.getTime()) {
          maxFinish = child.earlyFinish;
        }
      });

      if (minStart && maxFinish) {
        parent.earlyStart = minStart;
        parent.earlyFinish = maxFinish;
        // Sync Late dates equal to Early for summary (simplified)
        parent.lateStart = minStart;
        parent.lateFinish = maxFinish;
        // Duration? Summary duration is elapsed time usually, but let's leave it for now.
      }
    });

    return Array.from(taskMap.values());
  }
}
