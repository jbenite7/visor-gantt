<?php

declare(strict_types=1);

require_once __DIR__ . '/ProjectData.php';

class ProjectParser
{
    public function parse(string $filePath): ProjectData
    {
        if (!file_exists($filePath)) {
            throw new Exception("Archivo no encontrado");
        }

        libxml_use_internal_errors(true);
        $xml = simplexml_load_file($filePath);

        if ($xml === false) {
            libxml_clear_errors();
            throw new Exception("El archivo no es un XML válido de Microsoft Project.");
        }

        $data = new ProjectData();

        // 1. Información General del Proyecto
        $data->name = (string)($xml->Title ?? $xml->Name ?? 'Proyecto Importado');
        $data->startDate = (string)($xml->StartDate ?? '');
        $data->finishDate = (string)($xml->FinishDate ?? '');

        // 2. Recursos
        if (isset($xml->Resources->Resource)) {
            foreach ($xml->Resources->Resource as $res) {
                if ((string)$res->Name === '') continue;
                $data->resources[] = [
                    'id' => (int)$res->UID,
                    'name' => (string)$res->Name,
                    'type' => (int)$res->Type
                ];
            }
        }

        // 3. Tareas - Extraer TODOS los atributos
        $allColumns = [];

        if (isset($xml->Tasks->Task)) {
            foreach ($xml->Tasks->Task as $task) {
                // Ignorar tarea raíz vacía
                if ((int)$task->UID === 0 && (string)$task->Name === '') continue;

                // Extraer TODOS los atributos del nodo Task
                $taskData = [];
                foreach ($task->children() as $child) {
                    $nodeName = $child->getName();

                    // Manejar nodos especiales
                    if ($nodeName === 'PredecessorLink') {
                        // Procesar predecesoras aparte
                        continue;
                    }

                    // Registrar columna disponible
                    if (!in_array($nodeName, $allColumns)) {
                        $allColumns[] = $nodeName;
                    }

                    // Convertir valor
                    $value = (string)$child;

                    // Intentar tipificar
                    if (is_numeric($value) && strpos($value, '.') === false) {
                        $taskData[$nodeName] = (int)$value;
                    } elseif (is_numeric($value)) {
                        $taskData[$nodeName] = (float)$value;
                    } else {
                        $taskData[$nodeName] = $value;
                    }
                }

                // Procesar predecesoras
                $predecessors = [];
                if (isset($task->PredecessorLink)) {
                    foreach ($task->PredecessorLink as $link) {
                        $predecessors[] = (int)$link->PredecessorUID;
                    }
                }
                $taskData['predecessors'] = $predecessors;

                // Campos calculados/normalizados para compatibilidad
                $taskData['id'] = $taskData['UID'] ?? 0;
                $taskData['name'] = $taskData['Name'] ?? '';
                $taskData['start'] = $taskData['Start'] ?? '';
                $taskData['finish'] = $taskData['Finish'] ?? '';
                $taskData['duration'] = $taskData['Duration'] ?? '';
                $taskData['percentComplete'] = $taskData['PercentComplete'] ?? 0;
                $taskData['isSummary'] = ($taskData['Summary'] ?? 0) === 1;
                $taskData['isMilestone'] = ($taskData['Milestone'] ?? 0) === 1;
                $taskData['outlineLevel'] = $taskData['OutlineLevel'] ?? 0;
                $taskData['wbs'] = $taskData['WBS'] ?? '';

                $data->tasks[] = $taskData;
            }
        }

        // Guardar columnas disponibles
        $data->availableColumns = $allColumns;

        return $data;
    }
}
