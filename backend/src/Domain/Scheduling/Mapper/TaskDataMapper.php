<?php

declare(strict_types=1);

namespace Domain\Scheduling\Mapper;

use Domain\Scheduling\Entity\Task;
use Domain\Scheduling\ValueObject\Dependency;
use Domain\Scheduling\ValueObject\DependencyType;
use DateTimeImmutable;

class TaskDataMapper
{
    /**
     * Converts raw task data from ProjectParser into Domain Entities.
     * 
     * @param array $tasksData Array of tasks from ProjectParser
     * @return array{tasks: Task[], dependencies: Dependency[]}
     */
    public function toDomain(array $tasksData): array
    {
        $domainTasks = [];
        $domainDependencies = [];

        foreach ($tasksData as $t) {
            $id = (int)$t['id'];
            $name = (string)$t['name'];

            // Duration is usually in format "PT8H0M0S" from XML or minutes.
            // ProjectParser normalizes it? Let's check. 
            // ProjectParser just passes raw 'Duration' string usually "PT..."
            // We need to parse duration format: PT8H, PT480M, etc.
            $durationMinutes = $this->parseDuration($t['duration'] ?? '');

            $isMilestone = (bool)($t['isMilestone'] ?? false);

            // Create Task Entity (Initial state)
            $domainTasks[] = new Task(
                $id,
                $name,
                $durationMinutes,
                null,
                null,
                null,
                null, // Dates will be calculated
                0, // Float
                false, // Critical
                $isMilestone,
                (int)($t['outlineLevel'] ?? 0),
                (bool)($t['isSummary'] ?? false),
                isset($t['start']) && $t['start'] !== '' ? new DateTimeImmutable($t['start']) : null
            );

            // Create Dependencies
            // ProjectParser provides 'PredecessorLink' array with 'PredecessorUID' and 'Type'
            if (isset($t['PredecessorLink']) && is_array($t['PredecessorLink'])) {
                foreach ($t['PredecessorLink'] as $link) {
                    $predId = (int)$link['PredecessorUID'];
                    $typeInt = (int)$link['Type'];
                    $rawLag = (int)($link['LinkLag'] ?? 0);
                    $lagFormat = (int)($link['LagFormat'] ?? 0);

                    // Logic for Lag:
                    // If Format is Percentage (57?), LinkLag is Percentage * 10? No.
                    // MS Project: If LagFormat=57 (%), LinkLag=25 means 25%.
                    // Actually LinkLag is usually Tenths unless Percentage.
                    // Let's defer calculation or resolving?
                    // Best is to resolve it NOW if possible or later.
                    // We don't have convenient access to predecessor duration yet (might be not parsed yet).
                    // So we should enhance Dependency object to store "IsPercentage" and "Value".
                    // But for now, let's just fix the "LinkLag / 10" assumption which is wrong for %.

                    $lag = 0;
                    $isPercentage = false;

                    // LagFormat 57 = Percentage? Need to confirm MS constants. 
                    // Usually 39 = Days, 57 = Percent.
                    if ($lagFormat === 57) {
                        $lag = $rawLag; // e.g. 50 means 50%.
                        $isPercentage = true;
                    } else {
                        // Standard time units (tenths of minute)
                        $lag = (int)($rawLag / 10);
                        $isPercentage = false;
                    }

                    $depType = DependencyType::fromMppType($typeInt);

                    $domainDependencies[] = new Dependency(
                        $predId,
                        $id,
                        $depType,
                        $lag,
                        $isPercentage // New argument
                    );
                }
            }
        }

        return [
            'tasks' => $domainTasks,
            'dependencies' => $domainDependencies
        ];
    }

    /**
     * Merges calculated domain values back into the raw task array.
     */
    public function mergeCalculation(array $originalTasks, array $calculatedTasks): array
    {
        // Map calculated tasks by ID
        $calcMap = [];
        foreach ($calculatedTasks as $ct) {
            $calcMap[$ct->id] = $ct;
        }

        foreach ($originalTasks as &$t) {
            $id = (int)$t['id'];
            if (isset($calcMap[$id])) {
                /** @var Task $ct */
                $ct = $calcMap[$id];

                // Inject CPM fields
                $t['earlyStart'] = $ct->earlyStart ? $ct->earlyStart->format('Y-m-d H:i:s') : null;
                $t['earlyFinish'] = $ct->earlyFinish ? $ct->earlyFinish->format('Y-m-d H:i:s') : null;
                $t['lateStart'] = $ct->lateStart ? $ct->lateStart->format('Y-m-d H:i:s') : null;
                $t['lateFinish'] = $ct->lateFinish ? $ct->lateFinish->format('Y-m-d H:i:s') : null;
                $t['totalFloat'] = $ct->totalFloat;
                $t['isCritical'] = $ct->isCritical;

                // Also update the main 'start'/'finish' to reflected calculated types?
                // DHTMLX expects 'start_date' and 'duration'.
                // If we want Auto-Scheduling, we should overwrite 'start' and 'finish'.
                if ($ct->earlyStart) {
                    $t['start'] = $ct->earlyStart->format('Y-m-d\TH:i:s'); // ISO like
                }
                if ($ct->earlyFinish) {
                    $t['finish'] = $ct->earlyFinish->format('Y-m-d\TH:i:s');
                }

                // Recalculate duration in DAYS to ensure consistency with new dates in the JSON.
                // Duration = DurationMinutes / (8 * 60)?
                // We use 8 hours per day setting in CalendarService (private).
                // Hardcoded 8 here or pass config?
                // Let's rely on task duration minutes which is what we used for calc.
                $days = $ct->durationMinutes / 480; // 8 * 60
                // Store as float, let frontend format it.
                $t['duration'] = $days;
            }
        }

        return $originalTasks;
    }

    /**
     * Parse duration to MINUTES.
     * Input from ProjectParser is already FLOAT DAYS (e.g. 2.5).
     * We need to convert to Minutes for the Domain.
     */
    private function parseDuration($value): int
    {
        // 1. If it's numeric, assume it is DAYS (from ProjectParser)
        if (is_numeric($value)) {
            $days = (float)$value;
            return (int)round($days * 8 * 60);
        }

        // 2. If it's a string, try ISO 8601 (Fallback if raw XML passed)
        if (is_string($value) && strpos($value, 'PT') === 0) {
            try {
                $interval = new \DateInterval($value);
                $days = $interval->d;
                $hours = $interval->h;
                $mins = $interval->i;
                return ($days * 8 * 60) + ($hours * 60) + $mins;
            } catch (\Exception $e) {
                return 0;
            }
        }

        return 0;
    }
}
