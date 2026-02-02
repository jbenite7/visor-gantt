CREATE TABLE IF NOT EXISTS holidays (
    date DATE PRIMARY KEY,
    description VARCHAR(255) DEFAULT 'Festivo'
);

-- Optional: Seed with initial data if empty
INSERT INTO holidays (date, description)
SELECT '2025-01-01', 'Año Nuevo'
WHERE NOT EXISTS (SELECT 1 FROM holidays WHERE date = '2025-01-01');
