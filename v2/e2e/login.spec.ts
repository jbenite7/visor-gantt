import { expect, test } from "@playwright/test";

test("protege el home y redirige al login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
});

test("muestra el formulario de acceso en español", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await expect(page.getByLabel("Correo")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  // El copy lo reescribió E45: se avisa de que no está disponible todavía,
  // sin hablar de configuración de servidor.
  await expect(
    page.getByText("Entrar con Microsoft 365 no está disponible todavía"),
  ).toBeVisible();
});
