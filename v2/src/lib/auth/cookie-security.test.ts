import { shouldUseSecureCookiesFromHeaders } from "./cookie-security";

describe("shouldUseSecureCookiesFromHeaders", () => {
  test("returns false for plain http", () => {
    expect(
      shouldUseSecureCookiesFromHeaders({
        get: (name: string) =>
          name === "x-forwarded-proto" ? "http" : null,
      }),
    ).toBe(false);
  });

  test("returns true for https", () => {
    expect(
      shouldUseSecureCookiesFromHeaders({
        get: (name: string) =>
          name === "x-forwarded-proto" ? "https" : null,
      }),
    ).toBe(true);
  });
});
