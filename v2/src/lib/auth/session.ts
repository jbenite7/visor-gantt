import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import pool from "@/lib/db";
import { hashPassword, verifyPassword } from "./password";
import { ensureAuthTables } from "./rbac";
import type { AuthUser } from "@/types/auth";

const SESSION_COOKIE = "vg_session";
const SESSION_DAYS = 7;

interface LoginResult {
  success: boolean;
  error?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function createSessionForUser(userId: string): Promise<void> {
  await ensureAuthTables();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hashToken(token), expiresAt],
  );
  await setSessionCookie(token, expiresAt);
}

async function userCount(): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM users`);
  return result.rows[0]?.count ?? 0;
}

async function assignRole(userId: string, roleId: string) {
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, roleId],
  );
}

export async function loginWithPassword(
  emailInput: string,
  password: string,
): Promise<LoginResult> {
  await ensureAuthTables();
  const email = normalizeEmail(emailInput);
  if (!email || !password) {
    return { success: false, error: "Ingresa correo y contraseña" };
  }

  const existingUsers = await userCount();
  if (existingUsers === 0) {
    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, provider)
       VALUES ($1, $2, $3, 'password')
       RETURNING id`,
      [email, emailInput.trim(), hashPassword(password)],
    );
    await assignRole(result.rows[0].id, "admin");
    await createSessionForUser(result.rows[0].id);
    return { success: true };
  }

  const result = await pool.query(
    `SELECT id, password_hash FROM users WHERE email = $1 LIMIT 1`,
    [email],
  );
  const user = result.rows[0] as { id: string; password_hash: string | null } | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { success: false, error: "Correo o contraseña inválidos" };
  }

  await createSessionForUser(user.id);
  return { success: true };
}

export async function upsertMicrosoftUser({
  email,
  name,
  microsoftOid,
}: {
  email: string;
  name: string;
  microsoftOid: string;
}): Promise<string> {
  await ensureAuthTables();
  const normalized = normalizeEmail(email);
  const existingUsers = await userCount();
  const result = await pool.query(
    `INSERT INTO users (email, name, provider, microsoft_oid)
     VALUES ($1, $2, 'microsoft', $3)
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           provider = CASE WHEN users.provider = 'password' THEN users.provider ELSE 'microsoft' END,
           microsoft_oid = COALESCE(users.microsoft_oid, EXCLUDED.microsoft_oid),
           updated_at = NOW()
     RETURNING id`,
    [normalized, name || normalized, microsoftOid],
  );
  const userId = result.rows[0].id as string;
  await assignRole(userId, existingUsers === 0 ? "admin" : "member");
  return userId;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  await ensureAuthTables();
  const result = await pool.query(
    `SELECT
       u.id,
       u.email,
       u.name,
       u.provider,
       COALESCE(array_agg(ur.role_id) FILTER (WHERE ur.role_id IS NOT NULL), '{}') AS roles
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()
     GROUP BY u.id`,
    [hashToken(token)],
  );

  const row = result.rows[0] as
    | { id: string; email: string; name: string; provider: string; roles: string[] }
    | undefined;
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    provider: row.provider === "microsoft" ? "microsoft" : "password",
    roles: row.roles,
  };
}

export async function logoutCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await ensureAuthTables();
    await pool.query(`DELETE FROM user_sessions WHERE token_hash = $1`, [
      hashToken(token),
    ]);
  }
  cookieStore.delete(SESSION_COOKIE);
}
