<?php

declare(strict_types=1);

require_once __DIR__ . '/ProjectData.php';
require_once __DIR__ . '/Services/CalendarService.php';

class ProjectParser
{
    private CalendarService $calendar;

    public function __construct()
    {
        $this->calendar = new CalendarService();
    }

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
        $data->startDate = $this->parseDate((string)($xml->StartDate ?? ''));
        $data->finishDate = $this->parseDate((string)($xml->FinishDate ?? ''));
        $data->calendar = $this->parseCalendar($xml);

        // 2. Recursos
        if (isset($xml->Resources->Resource)) {
            foreach ($xml->Resources->Resource as $res) {
                if ((string)$res->Name === '') continue;
                $data->resources[] = [
                    'UID' => (int)$res->UID,
                    'Name' => (string)$res->Name,
                    'Type' => (int)$res->Type
                ];
            }
        }

        // 3. Tareas - Extraer TODOS los atributos
        $allColumns = [];
        // Ensure standard columns are always available
        $allColumns[] = 'predecessors';
        $allColumns[] = 'successors';

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

                    // Convertir valor y limpiar espacios
                    $value = trim((string)$child);

                    // Intentar tipificar
                    if (is_numeric($value) && strpos($value, '.') === false) {
                        $taskData[$nodeName] = (int)$value;
                    } elseif (is_numeric($value)) {
                        $taskData[$nodeName] = (float)$value;
                    } else {
                        $taskData[$nodeName] = $value;
                    }
                }

                // Procesar predecesoras con detalles completos
                $predecessorLinks = [];
                $simplePredecessors = []; // Array simple de IDs para compatibilidad

                if (isset($task->PredecessorLink)) {
                    foreach ($task->PredecessorLink as $link) {
                        $uid = (int)$link->PredecessorUID;
                        $simplePredecessors[] = $uid;

                        $predecessorLinks[] = [
                            'PredecessorUID' => $uid,
                            'Type' => (int)($link->Type ?? 1),
                            'LinkLag' => (int)($link->LinkLag ?? 0),
                            'LagFormat' => (int)($link->LagFormat ?? 7)
                        ];
                    }
                }

                $taskData['PredecessorLink'] = $predecessorLinks;
                $taskData['predecessors'] = $simplePredecessors;
                $taskData['successors'] = []; // Initialize successors

                // Campos calculados/normalizados para compatibilidad
                $taskData['id'] = $taskData['UID'] ?? 0;
                $taskData['name'] = $taskData['Name'] ?? '';
                $taskData['start'] = $this->parseDate($taskData['Start'] ?? '');
                $taskData['finish'] = $this->parseDate($taskData['Finish'] ?? '');

                // Duration Calculation
                $rawDuration = (string)($taskData['Duration'] ?? 'PT0H0M0S');
                $durationFormat = (int)($taskData['DurationFormat'] ?? 7); // Default to Days (7)
                $taskData['duration'] = $this->parseDuration($rawDuration, $durationFormat);

                // Recalculate Finish Date (Start + Duration) using CalendarService
                // Fixes discrepancy where XML Finish Date is inconsistent with Duration
                // EXCEPTION: Summary Tasks are calculated via Roll-Up in CPM Service, so we trust XML or wait for recalc.
                if ($taskData['start'] && $taskData['duration'] > 0 && !$taskData['isSummary']) {
                    $taskData['finish'] = $this->calculateFinishDate($taskData['start'], $taskData['duration']);
                } else {
                    $taskData['finish'] = $this->parseDate($taskData['Finish'] ?? '');
                }

                $taskData['percentComplete'] = $taskData['PercentComplete'] ?? 0;
                $taskData['isSummary'] = ($taskData['Summary'] ?? 0) === 1;

                // Constraint Dates
                $taskData['ConstraintType'] = (int)($taskData['ConstraintType'] ?? 0);
                $taskData['ConstraintDate'] = $this->parseDate((string)($taskData['ConstraintDate'] ?? ''));

                // Milestone Detection (Enhanced):
                // 1. Explicit Milestone flag from MPP
                // 2. OR if Start date == Finish date (duration 0) - compare DATE only, ignore TIME
                $explicitMilestone = ($taskData['Milestone'] ?? 0) === 1;
                $startDate = substr($taskData['start'], 0, 10); // Extract YYYY-MM-DD
                $finishDate = substr($taskData['finish'], 0, 10);
                $zeroDuration = ($startDate !== '' && $startDate === $finishDate);

                $taskData['isMilestone'] = $explicitMilestone || $zeroDuration;

                $taskData['outlineLevel'] = $taskData['OutlineLevel'] ?? 0;
                $taskData['wbs'] = $taskData['WBS'] ?? '';

                $data->tasks[] = $taskData;
            }
        }

        // 3.5 Calcular Sucesoras (Invertir Predecesoras)
        $successorsMap = []; // TaskUID -> [[UID, Type, Lag, Format], ...]

        // Build map using detailed PredecessorLink
        foreach ($data->tasks as $task) {
            if (isset($task['PredecessorLink']) && is_array($task['PredecessorLink'])) {
                foreach ($task['PredecessorLink'] as $link) {
                    $predId = $link['PredecessorUID'];

                    if (!isset($successorsMap[$predId])) {
                        $successorsMap[$predId] = [];
                    }

                    // Store detailed object for successor
                    $successorsMap[$predId][] = [
                        'id' => $task['id'],
                        'Type' => $link['Type'],
                        'LinkLag' => $link['LinkLag'],
                        'LagFormat' => $link['LagFormat']
                    ];
                }
            }
        }

        // Assign back to tasks
        // Since $data->tasks is an array of arrays, we need to iterate by reference
        foreach ($data->tasks as &$t) {
            if (isset($successorsMap[$t['id']])) {
                $t['successors'] = $successorsMap[$t['id']];
            }
        }
        unset($t); // break reference

        // 4. Recálculo de Fechas Reales del Proyecto (Ignorar Header XML)
        // La metadata del XML suele estar desactualizada. Calculamos los límites reales.
        if (!empty($data->tasks)) {
            $minStart = null;
            $maxFinish = null;

            foreach ($data->tasks as $t) {
                // Usamos las claves normalizadas 'start' y 'finish'
                $s = $t['start'] ?? '';
                $f = $t['finish'] ?? '';

                if ($s !== '') {
                    if ($minStart === null || $s < $minStart) {
                        $minStart = $s;
                    }
                }
                if ($f !== '') {
                    if ($maxFinish === null || $f > $maxFinish) {
                        $maxFinish = $f;
                    }
                }
            }

            if ($minStart !== null) $data->startDate = $minStart;
            if ($maxFinish !== null) $data->finishDate = $maxFinish;
        }

        // Guardar columnas disponibles
        $data->availableColumns = $allColumns;

        return $data;
    }

    /**
     * Parse duration to DAYS.
     * Handles ISO 8601 (PT8H0M0S) and numeric values with format codes.
     * Assumes 8-hour workday for conversion.
     */
    private function parseDuration(string $value, int $format): float
    {
        // 1. Handle ISO 8601 Strings (e.g. PT8H0M0S)
        if (strpos($value, 'PT') === 0) {
            try {
                $interval = new DateInterval($value);
                // Convert everything to Hours first
                $hours = ($interval->d * 24) + $interval->h + ($interval->i / 60) + ($interval->s / 3600);

                // Convert hours to work days (dividing by 8)
                // If the XML says "PT8H", that is 1 working day.
                return round($hours / 8, 2);
            } catch (Exception $e) {
                return 0;
            }
        }

        // 2. Handle Numeric Strings based on DurationFormat
        // Reference: https://learn.microsoft.com/en-us/office-vba/api/project.pjformatunit
        // 3=m, 4=em, 5=h, 6=eh, 7=d, 8=ed, 9=w, 10=ew, 11=mo, 12=emo, 19=%, 20=e%, 21=null, 35=m?, 36=em?, ...
        // We will simplify to standard work units

        $val = (float)$value;

        switch ($format) {
            case 3: // Minutes
            case 35:
                return round($val / 480, 2); // 480 mins = 8 hours = 1 day

            case 5: // Hours
            case 37:
                return round($val / 8, 2); // 8 hours = 1 day

            case 7: // Days
            case 39:
                return $val;

            case 9: // Weeks
            case 41:
                return $val * 5; // 5 days per week

            case 11: // Months
            case 43:
                return $val * 20; // 20 days per month (approx)

            default:
                // Fallback
                return $val;
        }
    }

    /**
     * Calculate Finish Date based on Start Date + Duration (Days).
     * Uses CalendarService to respect holidays and weekends.
     */
    private function calculateFinishDate(string $startDateStr, float $durationDays): string
    {
        try {
            $start = new DateTime(substr($startDateStr, 0, 10));
            return $this->calendar->addWorkingDays($start, $durationDays);
        } catch (Exception $e) {
            return $startDateStr; // Fallback
        }
    }

    /**
     * Parse date string to ISO 8601 (YYYY-MM-DDTH:H:i:s).
     * Supports ISO and US format (mm/dd/yyyy).
     */
    private function parseCalendar(SimpleXMLElement $xml): array
    {
        $config = ['weekDays' => [], 'exceptions' => []];
        if (!isset($xml->Calendar)) return $config;

        foreach ($xml->Calendar as $cal) {
            if ((int)$cal->IsBaseCalendar === 1 && isset($cal->WeekDays->WeekDay)) {
                foreach ($cal->WeekDays->WeekDay as $wd) {
                    $config['weekDays'][(int)$wd->DayType] = (int)$wd->DayWorking === 1;
                }
            }
        }
        return $config;
    }

    private function parseDate(string $dateStr): string
    {
        if (trim($dateStr) === '') return '';

        try {
            $dt = new DateTime($dateStr);
            // Request: "Convierte las fechas a días completos ... no tengas en cuenta la hora"
            $dt->setTime(0, 0, 0);
            return $dt->format('Y-m-d\TH:i:s');
        } catch (Exception $e) {
            return '';
        }
    }
}
