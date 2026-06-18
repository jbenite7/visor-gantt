import { MPPParser } from "./mpp-parser";
import path from "path";

describe("MPPParser Integration", () => {
  test("Should parse complete project XML", () => {
    const parser = new MPPParser();
    const filePath = path.join(process.cwd(), "test_data", "test_project.xml");

    const data = parser.parse(filePath);

    expect(data.name).toBeDefined();
    expect(data.tasks.length).toBeGreaterThan(0);

    // Find a specific task (e.g. root or first)
    const firstTask = data.tasks[0];
    expect(firstTask.UID).toBeDefined();
    expect(firstTask.Name).toBeDefined();

    // Check array handling
    const taskWithPreds = data.tasks.find(
      (t) => t.PredecessorLink && t.PredecessorLink.length > 0,
    );
    if (taskWithPreds) {
      expect(Array.isArray(taskWithPreds.PredecessorLink)).toBe(true);
      expect(taskWithPreds.PredecessorLink![0].PredecessorUID).toBeDefined();
    }
  });
});
