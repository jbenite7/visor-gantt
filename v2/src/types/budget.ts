/**
 * Budget and cost-tracking types.
 *
 * Supports categorised budget planning, actual spend tracking,
 * and allocation of budget amounts to individual tasks.
 */

export type BudgetCategory =
  | "labor"
  | "materials"
  | "equipment"
  | "subcontractors"
  | "other";

export interface BudgetItem {
  /** Unique budget item identifier. */
  id: string;
  /** Budget category. */
  category: BudgetCategory;
  /** Optional subcategory (e.g. "Concrete", "Electrical"). */
  subcategory?: string;
  /** Planned (budgeted) amount. */
  budgetedAmount: number;
  /** Actual amount spent so far. */
  spentAmount: number;
  /** Time period for phased budgeting (e.g. "2026-01", "Q1-2026"). */
  period?: string;
  /** Task IDs that consume this budget item. */
  mappedTaskIds: (string | number)[];
}

export interface BudgetMapping {
  /** Reference to a BudgetItem. */
  budgetItemId: string;
  /** Task that consumes a portion of the budget. */
  taskId: string | number;
  /** Amount allocated from this budget item to the task. */
  amount: number;
}
