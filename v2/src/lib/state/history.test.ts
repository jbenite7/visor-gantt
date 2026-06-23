import { HistoryStack, Command } from "./history";

function createMockCommand(desc: string): jest.Mocked<Command> {
  return {
    execute: jest.fn(),
    undo: jest.fn(),
    description: desc,
  };
}

describe("HistoryStack", () => {
  describe("initial state", () => {
    it("starts with canUndo = false and canRedo = false", () => {
      const stack = new HistoryStack();
      expect(stack.canUndo()).toBe(false);
      expect(stack.canRedo()).toBe(false);
    });
  });

  describe("push and undo", () => {
    it("push → undo calls command.undo() and empties undo stack", () => {
      const stack = new HistoryStack();
      const cmd = createMockCommand("test");

      stack.push(cmd);

      expect(stack.canUndo()).toBe(true);
      expect(cmd.execute).toHaveBeenCalledTimes(1);

      const result = stack.undo();

      expect(result).toBe(true);
      expect(cmd.undo).toHaveBeenCalledTimes(1);
      expect(stack.canUndo()).toBe(false);
      expect(stack.canRedo()).toBe(true);
    });
  });

  describe("push and redo", () => {
    it("push → undo → redo calls command.execute() again", () => {
      const stack = new HistoryStack();
      const cmd = createMockCommand("test");

      stack.push(cmd);
      stack.undo();
      expect(cmd.execute).toHaveBeenCalledTimes(1);

      const result = stack.redo();

      expect(result).toBe(true);
      expect(cmd.execute).toHaveBeenCalledTimes(2);
      expect(stack.canRedo()).toBe(false);
      expect(stack.canUndo()).toBe(true);
    });
  });

  describe("stack limit", () => {
    it("trims oldest commands when exceeding max stack (default 50)", () => {
      const stack = new HistoryStack(50);
      const commands = Array.from({ length: 55 }, (_, i) =>
        createMockCommand(`cmd-${i}`),
      );

      for (const cmd of commands) {
        stack.push(cmd);
      }

      // First 5 commands should have been trimmed (FIFO eviction)
      // Commands 0-4 are gone, commands 5-54 remain (50 items)
      for (let i = 0; i < 5; i++) {
        expect(commands[i].execute).toHaveBeenCalledTimes(1);
        // undo() on a trimmed command should not happen since it's dropped
      }

      // We can verify the stack size by undoing 50 times (should all succeed)
      for (let i = 0; i < 50; i++) {
        expect(stack.undo()).toBe(true);
      }
      // 51st undo should fail
      expect(stack.undo()).toBe(false);
    });
  });

  describe("redo cleared on new push", () => {
    it("push after undo clears redo stack", () => {
      const stack = new HistoryStack();
      const cmd1 = createMockCommand("first");
      const cmd2 = createMockCommand("second");

      stack.push(cmd1);
      stack.undo();
      expect(stack.canRedo()).toBe(true);

      stack.push(cmd2);
      expect(stack.canRedo()).toBe(false);
      expect(cmd2.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe("clear", () => {
    it("clears both undo and redo stacks", () => {
      const stack = new HistoryStack();
      const cmds = [
        createMockCommand("a"),
        createMockCommand("b"),
        createMockCommand("c"),
      ];

      for (const cmd of cmds) {
        stack.push(cmd);
      }

      // undo one so we have redo entries too
      stack.undo();

      stack.clear();

      expect(stack.canUndo()).toBe(false);
      expect(stack.canRedo()).toBe(false);
      expect(stack.undo()).toBe(false);
      expect(stack.redo()).toBe(false);
    });
  });
});
