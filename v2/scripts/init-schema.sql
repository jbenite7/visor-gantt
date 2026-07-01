-- Drop tables if they exist to ensure clean state (optional, careful in prod, but safe for setup)
-- DROP TABLE IF EXISTS dependencies;
-- DROP TABLE IF EXISTS resources;
-- DROP TABLE IF EXISTS tasks;
-- DROP TABLE IF EXISTS projects;

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    project_data JSONB DEFAULT '{"tasks":[],"resources":[],"assignments":[],"budgetItems":[],"budgetMappings":[],"baselines":[]}',
    start_date TIMESTAMP,
    finish_date TIMESTAMP,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    uid INTEGER NOT NULL,
    name TEXT,
    start_date TIMESTAMP,
    finish_date TIMESTAMP,
    duration FLOAT,
    percent_complete INTEGER DEFAULT 0,
    outline_level INTEGER,
    is_summary BOOLEAN DEFAULT FALSE,
    is_milestone BOOLEAN DEFAULT FALSE,
    wbs TEXT,
    extra_data JSONB DEFAULT '{}',
    CONSTRAINT tasks_project_uid_unique UNIQUE (project_id, uid)
);

-- Dependencies Table
CREATE TABLE IF NOT EXISTS dependencies (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    successor_uid INTEGER NOT NULL,
    predecessor_uid INTEGER NOT NULL,
    type INTEGER DEFAULT 1,
    lag INTEGER DEFAULT 0,
    CONSTRAINT deps_unique UNIQUE (project_id, successor_uid, predecessor_uid)
);

-- Resources Table
CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    uid INTEGER NOT NULL,
    name TEXT,
    type INTEGER DEFAULT 0
);

-- Holidays Table (Hybrid System Support)
CREATE TABLE IF NOT EXISTS holidays (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    name TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    country_code TEXT DEFAULT 'CO' -- Default to Colombia
);

-- Create simple index for performance
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_project_id ON dependencies(project_id);

CREATE TABLE IF NOT EXISTS matrix_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_type TEXT,
    template_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auth + RBAC
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    description TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_members (
    project_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

INSERT INTO permissions (id, description) VALUES
    ('project:read', 'Ver proyectos'),
    ('project:create', 'Crear proyectos'),
    ('project:update', 'Editar proyectos'),
    ('project:delete', 'Eliminar proyectos'),
    ('auth:manage', 'Administrar usuarios'),
    ('rbac:manage', 'Administrar roles y permisos')
ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO roles (id, name) VALUES
    ('admin', 'Administrador'),
    ('member', 'Miembro'),
    ('viewer', 'Lector')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'admin', id FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('member', 'project:read'),
    ('member', 'project:create'),
    ('member', 'project:update'),
    ('viewer', 'project:read')
ON CONFLICT DO NOTHING;
