<?php

// backend/api/holidays.php

header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");

require_once __DIR__ . '/../../backend/config/database.php';

try {
    $pdo = Database::getInstance()->getConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'OPTIONS') {
        exit(0);
    }

    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT * FROM holidays ORDER BY date ASC");
        echo json_encode(['status' => 'success', 'data' => $stmt->fetchAll()]);
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $date = $input['date'] ?? '';
        $desc = $input['description'] ?? 'Festivo';

        if (!$date) {
            throw new Exception("Fecha requerida");
        }

        $stmt = $pdo->prepare("INSERT INTO holidays (date, description) VALUES (:date, :desc) ON CONFLICT (date) DO UPDATE SET description = :desc");
        $stmt->execute(['date' => $date, 'desc' => $desc]);

        echo json_encode(['status' => 'success']);
    } elseif ($method === 'DELETE') {
        // Allow DELETE via query param or JSON input
        $date = $_GET['date'] ?? '';
        if (!$date) {
            $input = json_decode(file_get_contents('php://input'), true);
            $date = $input['date'] ?? '';
        }

        if (!$date) {
            throw new Exception("Fecha requerida");
        }

        $stmt = $pdo->prepare("DELETE FROM holidays WHERE date = :date");
        $stmt->execute(['date' => $date]);

        echo json_encode(['status' => 'success']);
    } else {
        throw new Exception("Método no permitido");
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
