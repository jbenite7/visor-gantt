import type { GanttDependency, GanttTask } from "@/components/gantt/types";

export interface MatrixSource {
  matrixPlanId: string;
  scopeId: string;
  areaId: string;
  cellId: string;
  recipeId: string;
  activityId: string;
}

export interface MatrixSyncMetadata {
  lastEditedAt: string;
  lastEditedFrom: "matrix" | "gantt";
}

export interface ScopeNode {
  id: string;
  name: string;
  type: string;
  defaultRecipeId?: string;
  children?: ScopeNode[];
}

export interface AreaNode {
  id: string;
  name: string;
  type?: string;
  discipline?: string;
  children?: AreaNode[];
}

export interface ActivityRecipeItem {
  id: string;
  name: string;
  productivityPerDay: number;
  defaultQuantity?: number;
  unit?: string;
  namePattern?: string;
}

export interface ActivityDependencyRule {
  predecessorActivityId: string;
  successorActivityId: string;
  type: GanttDependency["type"];
  lagDays?: number;
}

export interface LineOfBalanceRule {
  scopeType: string;
  offsetDays: number;
}

export interface ActivityRecipe {
  id: string;
  name: string;
  activities: ActivityRecipeItem[];
  dependencies: ActivityDependencyRule[];
  lineOfBalance?: LineOfBalanceRule;
}

export interface MatrixCell {
  id: string;
  scopeId: string;
  areaId: string;
  recipeId?: string;
  active: boolean;
  activityOverrides?: MatrixActivityOverride[];
  quantity?: number;
  unit?: string;
  productivityOverridePerDay?: number;
  notes?: string;
  generatedTaskIds?: (string | number)[];
  syncedTaskIds?: (string | number)[];
  lastEditedAt?: string;
  lastEditedFrom?: "matrix" | "gantt";
  feedback?: {
    source: "gantt";
    observedDurationDays: number;
    suggestedProductivityPerDay: number;
    status: "pendingApproval" | "approved" | "dismissed";
  };
}

export interface MatrixActivityOverride extends MatrixSyncMetadata {
  activityId: string;
  name?: string;
  quantity: number;
  unit?: string;
  productivityPerDay?: number;
  sourceTaskId?: string | number;
  start?: string;
  finish?: string;
  duration?: number;
  progress?: number;
  percentComplete?: number;
  isCritical?: boolean;
  isMilestone?: boolean;
  resourceNames?: string[];
  cost?: number;
  actualCost?: number;
}

export interface MatrixTemplate {
  id: string;
  name: string;
  projectType?: string;
  scopeTree: ScopeNode[];
  areas: AreaNode[];
  recipes: ActivityRecipe[];
}

export interface MatrixPlan {
  id: string;
  name: string;
  templateId?: string;
  startDate: string;
  scopeTree: ScopeNode[];
  areas: AreaNode[];
  recipes: ActivityRecipe[];
  cells: MatrixCell[];
  ganttDependencies?: GanttDependency[];
}

export type MatrixIssueKind =
  | "inactiveCell"
  | "missingScope"
  | "missingArea"
  | "missingRecipe"
  | "missingQuantity"
  | "invalidProductivity";

export type MatrixIssueSeverity = "low" | "medium" | "high";

export interface MatrixIssue {
  severity: MatrixIssueSeverity;
  kind: MatrixIssueKind;
  cellId?: string;
  message: string;
}

export interface MatrixGenerationResult {
  tasks: GanttTask[];
  dependencies: GanttDependency[];
  issues: MatrixIssue[];
  provenance: Record<string, (string | number)[]>;
}

export interface MatrixSyncConflict {
  taskId: string | number;
  cellId: string;
  field: "name" | "duration" | "start" | "finish";
  message: string;
}
