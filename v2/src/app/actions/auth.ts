"use server";

import { redirect } from "next/navigation";
import { loginWithPassword, logoutCurrentSession } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/nextPath";

function loginErrorUrl(message: string, next: string): string {
  const params = new URLSearchParams({ error: message });
  if (next) params.set("next", next);
  return `/login?${params.toString()}`;
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));
  const result = await loginWithPassword(email, password);

  if (!result.success) {
    redirect(loginErrorUrl(result.error ?? "No se pudo iniciar sesión", next));
  }

  redirect(next || "/");
}

export async function logoutAction(): Promise<void> {
  await logoutCurrentSession();
  redirect("/login");
}
