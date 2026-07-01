import nextConfig from "./next.config";

describe("next config", () => {
  test("allows project autosave payloads larger than the default Server Action limit", () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe("16mb");
  });
});
