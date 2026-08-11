import { defineConfig, devices } from "@playwright/test";

const puerto = process.env.E2E_PORT ?? "3000";
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${puerto}`;

/**
 * `prod` construye y sirve el build; `dev` levanta `next dev`.
 *
 * Por defecto, producción. `next dev` compila cada ruta la primera vez que se
 * visita, así que la primera visita a cada ruta tardaba un tiempo variable e
 * impredecible, y eso obligaba a calentar rutas a mano. Medido el 2026-08-10
 * en esta máquina, mismo código y misma suite: la corrida entera pasó de 8,0
 * min a 3,1-4,5 min, y el test más caro —`flow matrix-housing-full-flow`— del
 * 60 % de su presupuesto al 29-40 %. El `next build` que esto añade cuesta
 * 19 s, así que se reconstruye en cada corrida y nunca se sirve un build viejo.
 *
 * `E2E_SERVER=dev` sigue disponible para depurar con recarga en caliente.
 */
const modoServidor = process.env.E2E_SERVER ?? "prod";

const comandoServidor =
  modoServidor === "prod"
    ? `next build --webpack && next start --hostname 127.0.0.1 --port ${puerto}`
    : `next dev --webpack --hostname 127.0.0.1 --port ${puerto}`;

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
    command: comandoServidor,
    url: baseURL,
    // Nunca se reutiliza lo que ya escuche en el puerto. `!CI` reutilizaba en
    // local cualquier cosa: el 2026-08-10 había un `next dev` de otra worktree,
    // en otra rama, llevando una hora en el 3000. La suite habría probado ese
    // código sin avisar. Levantar el servidor propio cuesta segundos; probar la
    // rama equivocada cuesta la corrida entera y no se nota.
    reuseExistingServer: false,
    // En modo `prod` este tiempo incluye el `next build`, no solo el arranque.
    timeout: modoServidor === "prod" ? 600_000 : 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
