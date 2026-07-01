import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default pool;

/* ── Projects table management (called lazily from project.ts) ── */

export async function ensureProjectsTable(): Promise<void> {
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          project_data JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS matrix_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          project_type TEXT,
          template_data JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } finally {
      client.release();
    }
  } catch (err) {
    // Non-fatal: table may not exist yet, queries will fail gracefully
    console.warn("Could not ensure projects table:", (err as Error).message);
  }
}
