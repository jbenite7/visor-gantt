import {
  calculateAssignmentCost,
  computeResourceHours,
  detectOverallocation,
  getResourceAssignments,
  getTaskAssignments,
  createAssignment,
  wouldOverallocate,
} from "./assignments";
import { Resource, Assignment } from "@/types/resource";
import { GanttTask } from "@/components/gantt/types";

describe("calculateAssignmentCost", () => {
  test("Work resource: 50% allocation, $20/hr, 10 days → $800", () => {
    const resource: Resource = {
      uid: 1,
      name: "Engineer",
      type: "work",
      rate: 20,
    };
    const assignment: Assignment = {
      taskId: 1,
      resourceId: 1,
      units: 50,
      cost: 0,
    };
    expect(calculateAssignmentCost(assignment, resource, 10)).toBe(800);
  });

  test("Material resource: rate=$50/unit, units=10 → $500", () => {
    const resource: Resource = {
      uid: 2,
      name: "Steel",
      type: "material",
      rate: 50,
    };
    const assignment: Assignment = {
      taskId: 1,
      resourceId: 2,
      units: 10,
      cost: 0,
    };
    expect(calculateAssignmentCost(assignment, resource, 0)).toBe(500);
  });

  test("Cost resource: rate=$1000 → $1000 (fixed)", () => {
    const resource: Resource = {
      uid: 3,
      name: "Permit Fee",
      type: "cost",
      rate: 1000,
    };
    const assignment: Assignment = {
      taskId: 1,
      resourceId: 3,
      units: 0,
      cost: 0,
    };
    expect(calculateAssignmentCost(assignment, resource, 0)).toBe(1000);
  });

  test("No rate (rate=undefined) → cost = 0", () => {
    const resource: Resource = {
      uid: 4,
      name: "Intern",
      type: "work",
    };
    const assignment: Assignment = {
      taskId: 1,
      resourceId: 4,
      units: 100,
      cost: 0,
    };
    expect(calculateAssignmentCost(assignment, resource, 5)).toBe(0);
  });
});

describe("computeResourceHours", () => {
  test("50% allocation for 10 days → 40 hours", () => {
    const assignment: Assignment = {
      taskId: 1,
      resourceId: 1,
      units: 50,
      cost: 0,
    };
    expect(computeResourceHours(assignment, 10)).toBe(40);
  });

  test("100% allocation for 5 days → 40 hours", () => {
    const assignment: Assignment = {
      taskId: 1,
      resourceId: 1,
      units: 100,
      cost: 0,
    };
    expect(computeResourceHours(assignment, 5)).toBe(40);
  });

  test("25% allocation for 4 days → 8 hours", () => {
    const assignment: Assignment = {
      taskId: 1,
      resourceId: 1,
      units: 25,
      cost: 0,
    };
    expect(computeResourceHours(assignment, 4)).toBe(8);
  });
});

describe("detectOverallocation", () => {
  test("Resource A at 60% and 50% on same day → overallocated (totalUnits=110)", () => {
    const resources: Resource[] = [
      { uid: 1, name: "Alice", type: "work", availability: 100 },
    ];
    const tasks: GanttTask[] = [
      {
        id: 1,
        name: "Task 1",
        start: new Date("2026-06-15"),
        finish: new Date("2026-06-19"),
        duration: 5,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 1,
        dependencies: [],
      },
      {
        id: 2,
        name: "Task 2",
        start: new Date("2026-06-15"),
        finish: new Date("2026-06-17"),
        duration: 3,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 1,
        dependencies: [],
      },
    ];
    const assignments: Assignment[] = [
      { taskId: 1, resourceId: 1, units: 60, cost: 0 },
      { taskId: 2, resourceId: 1, units: 50, cost: 0 },
    ];

    const result = detectOverallocation(assignments, resources, tasks);

    // Tasks overlap on Jun 15, 16, 17 → 3 days of overallocation
    expect(result).toHaveLength(3);
    for (const entry of result) {
      expect(entry.resourceId).toBe(1);
      expect(entry.resourceName).toBe("Alice");
      expect(entry.totalUnits).toBe(110);
      expect(entry.maxAvailability).toBe(100);
      expect(entry.isOverallocated).toBe(true);
      expect(entry.assignedTasks).toHaveLength(2);
    }
  });

  test("Resource B at 40% only → no overallocation", () => {
    const resources: Resource[] = [
      { uid: 2, name: "Bob", type: "work", availability: 100 },
    ];
    const tasks: GanttTask[] = [
      {
        id: 10,
        name: "Single Task",
        start: new Date("2026-06-15"),
        finish: new Date("2026-06-15"),
        duration: 1,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 1,
        dependencies: [],
      },
    ];
    const assignments: Assignment[] = [
      { taskId: 10, resourceId: 2, units: 40, cost: 0 },
    ];

    const result = detectOverallocation(assignments, resources, tasks);

    expect(result).toHaveLength(0);
  });
});

describe("getResourceAssignments", () => {
  test("Filter by resource ID: 2 of 3 assignments match resource 1", () => {
    const assignments: Assignment[] = [
      { taskId: 1, resourceId: 1, units: 50, cost: 0 },
      { taskId: 2, resourceId: 1, units: 100, cost: 0 },
      { taskId: 3, resourceId: 2, units: 50, cost: 0 },
    ];
    expect(getResourceAssignments(1, assignments)).toHaveLength(2);
    expect(getResourceAssignments(2, assignments)).toHaveLength(1);
    expect(getResourceAssignments(99, assignments)).toHaveLength(0);
  });
});

describe("getTaskAssignments", () => {
  test("Filter by task ID: 2 of 3 assignments match task 1", () => {
    const assignments: Assignment[] = [
      { taskId: 1, resourceId: 1, units: 50, cost: 0 },
      { taskId: 1, resourceId: 2, units: 100, cost: 0 },
      { taskId: 2, resourceId: 1, units: 50, cost: 0 },
    ];
    expect(getTaskAssignments(1, assignments)).toHaveLength(2);
    expect(getTaskAssignments(2, assignments)).toHaveLength(1);
    expect(getTaskAssignments(99, assignments)).toHaveLength(0);
  });

  test("Filter by string task ID", () => {
    const assignments: Assignment[] = [
      { taskId: "abc", resourceId: 1, units: 100, cost: 0 },
      { taskId: "def", resourceId: 2, units: 50, cost: 0 },
    ];
    expect(getTaskAssignments("abc", assignments)).toHaveLength(1);
  });
});

describe("createAssignment", () => {
  test("Creates assignment with work resource cost calculated", () => {
    const resources: Resource[] = [
      { uid: 1, name: "Engineer", type: "work", rate: 25 },
    ];
    const tasks: GanttTask[] = [
      {
        id: 1,
        name: "Design",
        start: new Date("2026-06-15"),
        finish: new Date("2026-06-19"),
        duration: 5,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 1,
        dependencies: [],
      },
    ];

    const result = createAssignment(1, 1, 50, resources, tasks);

    expect(result.taskId).toBe(1);
    expect(result.resourceId).toBe(1);
    expect(result.units).toBe(50);
    // 0.5 * 25 * 5 * 8 = 500
    expect(result.cost).toBe(500);
  });

  test("Creates assignment with string taskId", () => {
    const resources: Resource[] = [
      { uid: 1, name: "Dev", type: "work", rate: 10 },
    ];
    const tasks: GanttTask[] = [
      {
        id: "t1",
        name: "Coding",
        start: new Date("2026-06-15"),
        finish: new Date("2026-06-16"),
        duration: 2,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 1,
        dependencies: [],
      },
    ];

    const result = createAssignment("t1", 1, 100, resources, tasks);

    expect(result.taskId).toBe("t1");
    // 1.0 * 10 * 2 * 8 = 160
    expect(result.cost).toBe(160);
  });

  test("Falls back to 0 cost when resource not found", () => {
    const resources: Resource[] = [];
    const tasks: GanttTask[] = [
      {
        id: 1,
        name: "Task",
        start: new Date("2026-06-15"),
        finish: new Date("2026-06-15"),
        duration: 1,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 1,
        dependencies: [],
      },
    ];

    const result = createAssignment(1, 999, 50, resources, tasks);

    expect(result.cost).toBe(0);
  });
});

describe("una sola definición de sobreasignado (M18, M19)", () => {
  const recursos: Resource[] = [
    { uid: 1, name: "Cuadrilla 2", type: "work", rate: 20, availability: 100 },
  ];
  const tareas: GanttTask[] = [
    {
      id: 1,
      name: "Excavación",
      start: new Date("2026-01-05"),
      finish: new Date("2026-01-09"),
      duration: 5,
      progress: 0,
      isCritical: false,
      isMilestone: false,
      isSummary: false,
      outlineLevel: 1,
      dependencies: [],
    },
    {
      id: 2,
      name: "Cimentación",
      start: new Date("2026-01-05"),
      finish: new Date("2026-01-09"),
      duration: 5,
      progress: 0,
      isCritical: false,
      isMilestone: false,
      isSummary: false,
      outlineLevel: 1,
      dependencies: [],
    },
  ];
  const yaAsignado: Assignment[] = [
    { taskId: 1, resourceId: 1, units: 100, cost: 0 },
  ];

  test("la nueva asignación que rebasa el día se detecta antes de crearla", () => {
    const aviso = wouldOverallocate(yaAsignado, recursos, tareas, {
      taskId: 2,
      resourceId: 1,
      units: 100,
      cost: 0,
    });

    expect(aviso).not.toBeNull();
    expect(aviso!.resourceId).toBe(1);
  });

  test("una que cabe no genera aviso", () => {
    const aviso = wouldOverallocate([], recursos, tareas, {
      taskId: 2,
      resourceId: 1,
      units: 50,
      cost: 0,
    });

    expect(aviso).toBeNull();
  });

  test("usa el mismo umbral que Problemas, no uno propio", () => {
    const nueva: Assignment = {
      taskId: 2,
      resourceId: 1,
      units: 100,
      cost: 0,
    };

    const porProblemas = detectOverallocation(
      [...yaAsignado, nueva],
      recursos,
      tareas,
    ).filter((r) => r.isOverallocated);
    const previo = wouldOverallocate(yaAsignado, recursos, tareas, nueva);

    expect(porProblemas.length > 0).toBe(previo !== null);
  });

  test("no avisa por un recurso distinto del que se está asignando", () => {
    const otros: Resource[] = [
      ...recursos,
      { uid: 2, name: "Cuadrilla 3", type: "work", rate: 20, availability: 100 },
    ];

    const aviso = wouldOverallocate(yaAsignado, otros, tareas, {
      taskId: 2,
      resourceId: 2,
      units: 100,
      cost: 0,
    });

    expect(aviso).toBeNull();
  });
});
