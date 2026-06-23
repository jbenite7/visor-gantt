/**
 * Line of Balance (LOB) types for repetitive / phased construction workflows.
 *
 * LOB groups tasks into activities (e.g. "Floor 3 Finishing") and tracks
 * planned vs. actual production rates per unit (e.g. per floor, per lot).
 */

export interface LOBActivity {
  /** Unique activity identifier. */
  id: string;
  /** Activity display name. */
  name: string;
  /** Task UIDs that belong to this activity. */
  taskIds: (string | number)[];
  /** Planned production rate (units per period). */
  plannedRate: number;
  /** Actual production rate achieved. */
  actualRate?: number;
  /** Label for the unit of work (e.g. "Piso", "Lote", "Zona"). */
  unitLabel: string;
  /** Planned start date for the activity. */
  plannedStart: Date;
  /** Planned finish date for the activity. */
  plannedFinish: Date;
}

export interface LOBUnit {
  /** Reference to the parent LOBActivity. */
  activityId: string;
  /** Sequential unit index (0-based). */
  unitIndex: number;
  /** Planned date for this unit. */
  plannedDate: Date;
  /** Actual completion date for this unit. */
  actualDate?: Date;
}
