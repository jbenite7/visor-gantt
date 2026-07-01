import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  test("verifies the original password and rejects a different one", () => {
    const stored = hashPassword("clave-segura-123");

    expect(verifyPassword("clave-segura-123", stored)).toBe(true);
    expect(verifyPassword("otra-clave", stored)).toBe(false);
  });

  test("rejects empty or malformed stored hashes", () => {
    expect(verifyPassword("clave", "")).toBe(false);
    expect(verifyPassword("clave", "plain-text")).toBe(false);
  });
});
