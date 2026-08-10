import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  outputDir: "test-results/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    // Grabar de continuo cuesta y, peor, cuesta de forma variable: medido el
    // 2026-08-10, la **misma** captura del **mismo** documento de 1280x720
    // tardó 135 ms y 7.490 ms dentro de un solo test. Esa varianza es la que
    // agota los presupuestos de tiempo y hace fallar un test distinto cada vez.
    //
    // No se pierde evidencia: la que esta suite entrega son las capturas y los
    // logs que ella misma escribe en `attachEvidence`, y siguen igual. Esto de
    // aquí es la grabación automática de Playwright, que es una ayuda de
    // depuración: se conserva cuando hace falta, al fallar.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev:e2e",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
