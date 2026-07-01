import { logoutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AuthMenu() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <form action={logoutAction} className="flex items-center gap-3">
      <span className="max-w-48 truncate text-xs font-medium text-[var(--gray-600)]">
        {user.email}
      </span>
      <button
        type="submit"
        className="rounded-md border border-[var(--gray-300)] px-3 py-1.5 text-xs font-semibold text-[var(--aia-corp-dark)] hover:bg-[var(--aia-corp-xlight)]"
      >
        Salir
      </button>
    </form>
  );
}
