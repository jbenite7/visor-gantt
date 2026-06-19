-- Drop tables if they exist to ensure clean state (optional, careful in prod, but safe for setup)
-- DROP TABLE IF EXISTS dependencies;
-- DROP TABLE IF EXISTS resources;
-- DROP TABLE IF EXISTS tasks;
-- DROP TABLE IF EXISTS projects;

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
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
