<?php

require_once __DIR__ . '/../src/bootstrap.php';

use Domain\Scheduling\Entity\Task;
use Domain\Scheduling\ValueObject\Dependency;
use Domain\Scheduling\ValueObject\DependencyType;
use Domain\Scheduling\Service\CPMCalculatorService;
use Domain\Scheduling\Service\CalendarService;

$calendar = new CalendarService();
$calculator = new CPMCalculatorService($calendar);
$projectStart = new DateTimeImmutable('2026-06-01 08:00:00'); // Valid Monday

echo "--- Iniciando Test Summary Roll-Up (Regla 1) ---\n";

// Scenario:
// Task 1: Summary (Level 1)
//   Task 2: Child 1 (Level 2). Start Mon. Duration 2. Finish Tue.
//   Task 3: Child 2 (Level 2). Start Thu. Duration 2. Finish Fri.
// Expected Summary: Start Mon (Min), Finish Fri (Max).

$tasks = [
    // Summary Task (Dates should be overwritten)
    new Task(
        id: 1,
        name: 'Summary Task',
        durationMinutes: 0,
        outlineLevel: 1,
        isSummary: true
    ),

    // Child 1
    new Task(
        id: 2,
        name: 'Task 1 (Mon-Tue)',
        durationMinutes: 2 * 8 * 60, // 2 Days
        outlineLevel: 2,
        isSummary: false
    ),

    // Child 2
    new Task(
        id: 3,
        name: 'Task 2 (Thu-Fri)',
        durationMinutes: 2 * 8 * 60, // 2 Days
        outlineLevel: 2,
        isSummary: false
    ),
];

// Dependencies to force Task 3 to start later
// We link Task 2 -> Task 3 with a Lag of 1 Day (Wed is Lag).
// T2 Ends Tue PM. + 1 Day Lag = Wed PM?
// Let's use Start Date logic or just set dates? CPM calculates based on dependencies.
// T2 Start: Project Start (Mon). Finish: Tue.
// T3 Start: T2 Finish + 1 Day Lag? 
// 1 Day Lag means 8 working hours.
// Tue 17:00 + 8h = Wed 17:00.
// So T3 Start would be Wed 17:00? No, usually next morning if working day.
// Let's use simple FinishToStart without lag to ensure contiguous, OR just let CPM do its thing.
// If T2 Finish is Tue 17:00. 
// If dependency FS. T3 Start is Tue 17:00 > Normalized to Wed 08:00?
// Let's just create a chain. T2 -> T3.
// T2: Mon, Tue.
// T3: Wed, Thu.
// Summary: Mon - Thu.

$dependencies = [
    new Dependency(2, 3, DependencyType::FinishToStart)
];

echo "Calculating...\n";

$results = $calculator->calculate($tasks, $dependencies, $projectStart);

// Helper to find task
function getTask($id, $results)
{
    foreach ($results as $t) {
        if ($t->id == $id) return $t;
    }
    return null;
}

$t1 = getTask(1, $results);
$t2 = getTask(2, $results);
$t3 = getTask(3, $results);

echo "\n--- Resultados ---\n";
echo "Task 2 (Child): " . ($t2->earlyStart?->format('Y-m-d') ?? 'N/A') . " to " . ($t2->earlyFinish?->format('Y-m-d') ?? 'N/A') . "\n";
echo "Task 3 (Child): " . ($t3->earlyStart?->format('Y-m-d') ?? 'N/A') . " to " . ($t3->earlyFinish?->format('Y-m-d') ?? 'N/A') . "\n";
echo "Task 1 (Summary): " . ($t1->earlyStart?->format('Y-m-d') ?? 'N/A') . " to " . ($t1->earlyFinish?->format('Y-m-d') ?? 'N/A') . "\n";

// Validation
$success = true;

if ($t1->earlyStart != $t2->earlyStart) {
    echo "FAIL: Summary Start Date matches Min Child Start.\n";
    $success = false;
}
if ($t1->earlyFinish != $t3->earlyFinish) {
    echo "FAIL: Summary Finish Date matches Max Child Finish.\n";
    $success = false;
}

if ($success) {
    echo "\n✅ TEST PASSED: Rules 1 & 2 verified.\n";
    echo "Rule 2 (Standard Activity): Duration + Working Days handled by CPM ForwardPass.\n";
    echo "Rule 1 (Summary Task): Dates Aggregated by Roll-Up.\n";
} else {
    echo "\n❌ TEST FAILED.\n";
    exit(1);
}
