<?php

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = Database::getInstance()->getConnection();

    $sql = file_get_contents(__DIR__ . '/../sql/create_holidays_table.sql');

    $pdo->exec($sql);

    echo "Migration successful: 'holidays' table created/verified.\n";

    // Seed from existing config if available and table is empty
    $configPath = __DIR__ . '/../config/holidays.php';
    if (file_exists($configPath)) {
        $holidays = require $configPath;
        if (is_array($holidays) && !empty($holidays)) {
            $stmt = $pdo->prepare("INSERT INTO holidays (date) VALUES (:date) ON CONFLICT DO NOTHING");
            foreach ($holidays as $date) {
                $stmt->execute(['date' => $date]);
            }
            echo "Seeded " . count($holidays) . " holidays from config file.\n";
        }
    }
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
