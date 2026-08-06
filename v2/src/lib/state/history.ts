/**
 * Command Stack — undo/redo engine.
 *
 * Each user action is wrapped as a Command with `execute` / `undo`.
 * HistoryStack manages two stacks (undo + redo) with a configurable max.
 */

export interface Command {
  /** Apply the change to state. */
  execute: () => void;
  /** Revert the change. */
  undo: () => void;
  /** Human-readable label (e.g. "Move task 5 left 3 days"). */
  description: string;
}

const DEFAULT_MAX_STACK = 50;

export class HistoryStack {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxStack: number;

  constructor(maxStack: number = DEFAULT_MAX_STACK) {
    this.maxStack = maxStack;
  }

  /** Push a new command, execute it, and clear the redo stack. */
  push(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
    // Trim to max size (FIFO — drop oldest)
    if (this.undoStack.length > this.maxStack) {
      this.undoStack = this.undoStack.slice(-this.maxStack);
    }
  }

  /** Undo the most recent command. Returns its description, or null if nothing to undo. */
  undo(): string | null {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    cmd.undo();
    this.redoStack.push(cmd);
    return cmd.description;
  }

  /** Redo the most recently undone command. Returns false if nothing to redo. */
  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    cmd.execute();
    this.undoStack.push(cmd);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Clear both stacks (e.g. on project switch). */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
