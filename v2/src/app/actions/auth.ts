"use server";

import { redirect } from "next/navigation";
import { loginWithPassword, logoutCurrentSession } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/nextPath";
import type { LoginErrorCode } from "@/lib/auth/loginErrors";

function loginErrorUrl(
  code: LoginErrorCode,
  next: string,
  correo: string,
): string {
  const params = new URLSearchParams({ error: code });
  if (next) params.set("next", next);
  // El correo lo acaba de escribir quien entra: devolverlo ahorra teclearlo
  // otra vez, y no es un dato que la URL revele a nadie más.
  if (correo) params.set("correo", correo);
  return `/login?${params.toString()}`;
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));
  const result = await loginWithPassword(email, password);

  if (!result.success) {
    redirect(loginErrorUrl(result.code ?? "credenciales", next, email));
  }

  redirect(next || "/");
}

export async function logoutAction(): Promise<void> {
  await logoutCurrentSession();
  redirect("/login");
}
