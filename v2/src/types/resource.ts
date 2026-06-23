/**
 * Resource and assignment types for MS Project resources.
 *
 * Supports work (labour), material, and cost resource types
 * with rate-based costing and task assignment tracking.
 */

export type ResourceType = "work" | "material" | "cost";

export interface Resource {
  /** Unique resource identifier. */
  uid: number;
  /** Resource display name. */
  name: string;
  /** Resource category. */
  type: ResourceType;
  /** Cost per hour (work) or per unit (material). */
  rate?: number;
  /** Maximum availability as a percentage (0–100). */
  availability?: number;
  /** Resource group / department label. */
  group?: string;
  /** Task assignments for this resource. */
  assignments?: Assignment[];
}

export interface Assignment {
  /** The task this resource is assigned to. */
  taskId: string | number;
  /** The assigned resource's UID. */
  resourceId: number;
  /** Allocation percentage (100 = full-time). */
  units: number;
  /** Total cost for this assignment. */
  cost: number;
}
