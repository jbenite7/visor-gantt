<?php
// Aumentar límites para archivos XML grandes
ini_set('upload_max_filesize', '64M');
ini_set('post_max_size', '64M');
ini_set('memory_limit', '256M');
ini_set('max_execution_time', '120');

header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS, DELETE");

ini_set('display_errors', 0);
error_reporting(E_ALL);

$baseDir = dirname(__DIR__, 2);
require_once $baseDir . '/backend/src/ProjectParser.php';
require_once $baseDir . '/backend/src/ProjectStorage.php';

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Health check
if ($action === 'health') {
    echo json_encode(['status' => 'ok', 'message' => 'Servidor MPP activo (XML only)']);
    exit;
}

// List all saved projects
if ($action === 'projects' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $storage = new ProjectStorage();
        $projects = $storage->listProjects();
        echo json_encode([
            'status' => 'success',
            'projects' => $projects
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

// Get a specific project
if ($action === 'project' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            throw new Exception("ID de proyecto inválido");
        }

        $storage = new ProjectStorage();
        $data = $storage->getProject($id);

        if (!$data) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Proyecto no encontrado']);
            exit;
        }

        echo json_encode([
            'status' => 'success',
            'data' => $data
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

// Delete a project
if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);
        if ($id <= 0) {
            throw new Exception("ID de proyecto inválido");
        }

        $storage = new ProjectStorage();
        $deleted = $storage->deleteProject($id);

        if (!$deleted) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Proyecto no encontrado']);
            exit;
        }

        echo json_encode(['status' => 'success', 'message' => 'Proyecto eliminado']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

// Rename a project
if ($action === 'rename' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $id = (int)($_POST['id'] ?? 0);
        $newName = trim($_POST['name'] ?? '');

        if ($id <= 0 || empty($newName)) {
            throw new Exception("Datos inválidos");
        }

        $storage = new ProjectStorage();
        if ($storage->renameProject($id, $newName)) {
            echo json_encode(['status' => 'success']);
        } else {
            throw new Exception("No se pudo renombrar");
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

// Delete a project GROUP
if ($action === 'delete_group' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $groupId = $_POST['groupId'] ?? null;
        if (!$groupId) {
            throw new Exception("ID de grupo inválido");
        }

        $storage = new ProjectStorage();
        // Passing groupId as string/int is handled by method
        if ($storage->deleteProjectGroup($groupId)) {
            echo json_encode(['status' => 'success']);
        } else {
            throw new Exception("No se encontró el grupo o no se pudo eliminar");
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

// Save/Update an existing project
if ($action === 'save' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);

        if (!$data || !isset($data['id'])) {
            throw new Exception("Datos inválidos");
        }

        $id = (int)$data['id'];
        $storage = new ProjectStorage();

        // Use saveProject with overwriteId to update
        // The data structure received from frontend must match what saveProject expects
        // Frontend sends: { id: ..., project: ..., tasks: ..., resources: ... }
        // saveProject expects: { project: ..., tasks: ..., resources: ... }

        // We might need to fetch the existing name if not provided in data['project']['name']
        // valid since my saveProject handles name extraction

        $storage->saveProject($data, '', $id);

        echo json_encode(['status' => 'success']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

// Duplicate a project (Copy or Version)
if ($action === 'duplicate' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $id = (int)($_POST['id'] ?? 0);
        $newName = trim($_POST['name'] ?? '');
        $asVersion = isset($_POST['asVersion']) && $_POST['asVersion'] === 'true';

        if ($id <= 0 || empty($newName)) {
            throw new Exception("Datos inválidos");
        }

        $storage = new ProjectStorage();
        $newId = $storage->duplicateProject($id, $newName, $asVersion);

        if ($newId) {
            echo json_encode(['status' => 'success', 'newId' => $newId]);
        } else {
            throw new Exception("No se pudo duplicar");
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

// Upload and save a new project
if ($action === 'upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $tempPath = null;
    try {
        if (!isset($_FILES['file'])) {
            throw new Exception("No se ha enviado ningún archivo");
        }

        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new Exception("Error al subir archivo: " . $file['error']);
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $originalName = pathinfo($file['name'], PATHINFO_FILENAME);

        // Solo aceptamos XML
        if ($ext === 'mpp') {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'error' => 'MPP_NOT_SUPPORTED',
                'message' => 'Este visor solo acepta archivos XML. Para convertir tu .mpp a XML: Abre el archivo en ProjectLibre (gratis) o MS Project y guárdalo como "XML".'
            ]);
            exit;
        }

        if ($ext !== 'xml') {
            throw new Exception("Formato no soportado. Solo archivos .xml");
        }

        // Mover archivo temporalmente
        $uploadDir = $baseDir . '/backend/uploads/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        $tempPath = $uploadDir . uniqid('proj_') . '.xml';
        if (!move_uploaded_file($file['tmp_name'], $tempPath)) {
            throw new Exception("Error interno al guardar archivo");
        }

        // Parsear XML
        $parser = new ProjectParser();
        $data = $parser->parse($tempPath);

        // --- CPM CALCULATION ENGINE INTEGRATION ENABLED ---
        // Se ha corregido la lógica de mapeo y calendario.
        try {
            require_once __DIR__ . '/../../backend/src/bootstrap.php';

            $mapper = new \Domain\Scheduling\Mapper\TaskDataMapper();
            $calendar = new \Domain\Scheduling\Service\CalendarService(); // Domain Service (Saturdays OK)
            $calculator = new \Domain\Scheduling\Service\CPMCalculatorService($calendar);

            $domainData = $mapper->toDomain($data->tasks);
            $startDateStr = $data->startDate ?: date('Y-m-d 08:00:00');
            $projectStart = new DateTimeImmutable($startDateStr);

            $calculatedTasks = $calculator->calculate(
                $domainData['tasks'],
                $domainData['dependencies'],
                $projectStart
            );

            $data->tasks = $mapper->mergeCalculation($data->tasks, $calculatedTasks);
            file_put_contents($baseDir . '/backend/debug_log.txt', date('Y-m-d H:i:s') . " - CPM Calculation Success for: {$originalName}\n", FILE_APPEND);
        } catch (Exception $cpmEx) {
            file_put_contents($baseDir . '/backend/debug_log.txt', date('Y-m-d H:i:s') . " - CPM Error: " . $cpmEx->getMessage() . "\n", FILE_APPEND);
        }
        // ------------------------------------------

        // Guardar proyecto persistentemente
        $storage = new ProjectStorage();
        $dataArray = json_decode(json_encode($data), true); // Convert to array

        // Check for duplicates if NOT overwriting
        $overwriteId = isset($_POST['overwriteId']) ? (int)$_POST['overwriteId'] : null;
        $versionOfId = isset($_POST['versionOf']) ? (int)$_POST['versionOf'] : null;
        $forceNew = isset($_POST['forceNew']) && $_POST['forceNew'] === 'true';

        // DEBUG LOGGING
        file_put_contents($baseDir . '/backend/debug_log.txt', date('Y-m-d H:i:s') . " - Upload: overwriteId=" . var_export($overwriteId, true) . ", versionOf=" . var_export($versionOfId, true) . "\n", FILE_APPEND);

        if (!$overwriteId && !$versionOfId && !$forceNew) {
            // 1. Similarity check (>90%) - Check versions FIRST
            $candidates = $storage->findSimilarProjects($dataArray['tasks'] ?? []);
            if (count($candidates) > 0) {
                echo json_encode([
                    'status' => 'suggest_version',
                    'candidates' => $candidates,
                    'message' => "Este archivo es muy similar ({$candidates[0]['similarity']}%) al proyecto '{$candidates[0]['name']}'. ¿Desea guardarlo como una nueva versión?"
                ]);
                exit;
            }

            // 2. Exact duplicate check - Check overwrite SECOND
            $existingId = $storage->findByName($originalName);
            if ($existingId !== null) {
                // Return duplicate status so frontend can ask user
                echo json_encode([
                    'status' => 'duplicate',
                    'existingId' => $existingId,
                    'message' => "El proyecto '{$originalName}' ya existe. ¿Desea sobrescribirlo?"
                ]);
                exit; // Stop here
            }
        }

        $projectId = $storage->saveProject($dataArray, $originalName, $overwriteId, $versionOfId);

        echo json_encode([
            'status' => 'success',
            'projectId' => $projectId,
            // Inject ID into data so frontend has it immediately
            'data' => array_merge($dataArray, ['project' => array_merge($dataArray['project'], ['id' => $projectId])])
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'status' => 'error',
            'message' => $e->getMessage()
        ]);
    } finally {
        if ($tempPath && file_exists($tempPath)) {
            unlink($tempPath);
        }
    }
    exit;
}

echo json_encode(['error' => 'Acción no válida']);
