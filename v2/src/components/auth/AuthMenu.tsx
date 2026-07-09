import { LogOut, UserCircle } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AuthMenu() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <form action={logoutAction} className="flex items-center gap-3">
      <span className="apple-panel inline-flex max-w-56 items-center gap-1.5 rounded-[var(--radius-lg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)]">
        <UserCircle size={14} aria-hidden />
        <span className="truncate">
          {user.email}
        </span>
      </span>
      <button
        type="submit"
        className="apple-button-secondary inline-flex items-center gap-1.5 rounded-[var(--radius-lg)] px-3 py-1.5 text-xs font-semibold"
      >
        <LogOut size={13} aria-hidden />
        Salir
      </button>
    </form>
  );
}
