export enum DependencyType {
  FinishToStart = "FS",
  StartToStart = "SS",
  FinishToFinish = "FF",
  StartToFinish = "SF",
}

// Helper to convert from MPP Integer to Enum
export function mapMppDependencyType(type: number): DependencyType {
  switch (type) {
    case 1:
      return DependencyType.FinishToStart;
    case 2:
      return DependencyType.StartToStart;
    case 3:
      return DependencyType.FinishToFinish;
    case 4:
      return DependencyType.StartToFinish;
    default:
      return DependencyType.FinishToStart;
  }
}

export interface Dependency {
  predecessorId: string | number;
  successorId: string | number;
  type: DependencyType;
  lag: number; // in minutes
  isPercentage: boolean;
}

export interface Task {
  id: string | number;
  name: string;
  durationMinutes: number;

  // Calculated Dates
  earlyStart?: Date;
  earlyFinish?: Date;
  lateStart?: Date;
  lateFinish?: Date;

  totalFloat: number;
  isCritical: boolean;
  isMilestone: boolean;

  // Hierarchy
  outlineLevel: number;
  isSummary: boolean;

  // Constraints
  manualStart?: Date; // Start No Earlier Than
}
