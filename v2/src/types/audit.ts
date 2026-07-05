export type PlanningAuditEventKind =
  | "taskEdit"
  | "dependencyEdit"
  | "structureEdit"
  | "calendarEdit"
  | "matrixEdit";

export interface PlanningAuditEvent {
  id: string;
  kind: PlanningAuditEventKind;
  summary: string;
  taskIds: (string | number)[];
  createdAt: string;
}
