"use server";

import { redirect } from "next/navigation";
import { loginWithPassword, logoutCurrentSession } from "@/lib/auth/session";

function loginErrorUrl(message: string): string {
  return `/login?error=${encodeURIComponent(message)}`;
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await loginWithPassword(email, password);

  if (!result.success) {
    redirect(loginErrorUrl(result.error ?? "No se pudo iniciar sesión"));
  }

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await logoutCurrentSession();
  redirect("/login");
}
