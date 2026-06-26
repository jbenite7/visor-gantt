/**
 * Shared MPP import types — barrel export.
 *
 * Import from `@/types` anywhere in the v2 codebase:
 * ```ts
 * import { MPPProject, MPPTask, MPPResource } from "@/types";
 * ```
 */

export type {
  MPPCalendarException,
  MPPCalendar,
  MPPDependency,
  MPPTask,
  MPPResource,
  MPPProject,
} from "./mpp";

export type { BaselineTask, Baseline } from "./baseline";

export type { ResourceType, Resource, Assignment } from "./resource";

export type {
  BudgetCategory,
  BudgetItem,
  BudgetMapping,
} from "./budget";

export type { LOBActivity, LOBUnit } from "./lob";

export type {
  ActivityDependencyRule,
  ActivityRecipe,
  ActivityRecipeItem,
  AreaNode,
  LineOfBalanceRule,
  MatrixCell,
  MatrixActivityOverride,
  MatrixGenerationResult,
  MatrixIssue,
  MatrixIssueKind,
  MatrixIssueSeverity,
  MatrixPlan,
  MatrixSource,
  MatrixSyncMetadata,
  MatrixSyncConflict,
  MatrixTemplate,
  ScopeNode,
} from "./matrix";
