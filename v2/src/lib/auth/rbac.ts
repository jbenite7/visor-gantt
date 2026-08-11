import pool from "@/lib/db";
import type { PermissionKey } from "@/types/auth";

const PERMISSIONS: Array<{ id: PermissionKey; description: string }> = [
  { id: "project:read", description: "Ver proyectos" },
  { id: "project:create", description: "Crear proyectos" },
  { id: "project:update", description: "Editar proyectos" },
  { id: "project:delete", description: "Eliminar proyectos" },
  { id: "auth:manage", description: "Administrar usuarios" },
  { id: "rbac:manage", description: "Administrar roles y permisos" },
];

const ROLES = [
  {
    id: "admin",
    name: "Administrador",
    permissions: PERMISSIONS.map((permission) => permission.id),
  },
  {
    id: "member",
    name: "Miembro",
    permissions: ["project:read", "project:create", "project:update"] satisfies PermissionKey[],
  },
  {
    id: "viewer",
    name: "Lector",
    permissions: ["project:read"] satisfies PermissionKey[],
  },
];

let schemaPromise: Promise<void> | null = null;

export function ensureAuthTables(): Promise<void> {
  schemaPromise ??= createAuthSchema();
  return schemaPromise;
}

async function createAuthSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT,
        provider TEXT NOT NULL DEFAULT 'password',
        microsoft_oid TEXT UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT ''
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        description TEXT DEFAULT ''
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, role_id)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_members (
        project_id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (project_id, user_id)
      );
    `);
    // La home filtra por `user_id`, que es la **segunda** columna de la clave
    // primaria, y un índice compuesto no sirve para buscar por su segunda
    // columna. Lo pone también la migración 006, para las bases que ya existen;
    // aquí porque en una instalación nueva esa migración corre antes de que
    // esta tabla exista y se quedaría sin efecto y sin avisar.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_project_members_user
        ON project_members (user_id);
    `);

    for (const permission of PERMISSIONS) {
      await client.query(
        `INSERT INTO permissions (id, description)
         VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description`,
        [permission.id, permission.description],
      );
    }

    for (const role of ROLES) {
      await client.query(
        `INSERT INTO roles (id, name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [role.id, role.name],
      );
      for (const permission of role.permissions) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [role.id, permission],
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    schemaPromise = null;
    throw error;
  } finally {
    client.release();
  }
}

export async function userHasPermission(
  userId: string,
  permission: PermissionKey,
): Promise<boolean> {
  await ensureAuthTables();
  const result = await pool.query(
    `SELECT 1
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     WHERE ur.user_id = $1 AND rp.permission_id = $2
     LIMIT 1`,
    [userId, permission],
  );
  return (result.rowCount ?? 0) > 0;
}
