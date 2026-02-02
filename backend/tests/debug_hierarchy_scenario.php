<?php

require_once __DIR__ . '/../src/bootstrap.php';

use Domain\Scheduling\Entity\Task;
use Domain\Scheduling\Service\CPMCalculatorService;
use Domain\Scheduling\Service\CalendarService;

$calendar = new CalendarService();
$calculator = new CPMCalculatorService($calendar);
$projectStart = new DateTimeImmutable('2026-06-01 08:00:00');

echo "--- Debugging Hierarchy Roll-Up ---\n";

// Scenario from User Screenshot:
// 8: Summary (Level 1). Should aggregate 9, 10, 11!
//   9: Normal (Level 2). Ends Jan.
//   10: Normal (Level 2). Ends Jan.
//   11: Summary (Level 2). Should aggregate 12. Ends Sept.
//     12: Normal (Level 3). Ends Sept.

$tasks = [
    // Task 8 (Grandparent)
    new Task(8, 'Task 8 (L1)', 0, null, null, null, null, 0, false, false, 1, true),

    // Task 9 (Child of 8)
    new Task(9, 'Task 9 (L2 Short)', 2 * 8 * 60, null, null, null, null, 0, false, false, 2, false),

    // Task 10 (Child of 8)
    new Task(10, 'Task 10 (L2 Short)', 2 * 8 * 60, null, null, null, null, 0, false, false, 2, false),

    // Task 11 (Child of 8, Parent of 12)
    new Task(11, 'Task 11 (L2 Summary)', 0, null, null, null, null, 0, false, false, 2, true),

    // Task 12 (Child of 11) - VERY LONG DURATION to push date to Sept
    new Task(12, 'Task 12 (L3 Long)', 60 * 8 * 60, null, null, null, null, 0, false, false, 3, false),
];

// No dependencies, just rely on Project Start for calc basis (Rollup validation)
$dependencies = [];

$results = $calculator->calculate($tasks, $dependencies, $projectStart);

$t8 = $results[8];
$t11 = $results[11];
$t12 = $results[12];

echo "Task 12 (L3) Finish: " . $t12->earlyFinish->format('Y-m-d') . "\n";
echo "Task 11 (L2) Finish: " . $t11->earlyFinish->format('Y-m-d') . "\n";
echo "Task 8 (L1) Finish: " . $t8->earlyFinish->format('Y-m-d') . "\n";

if ($t11->earlyFinish == $t12->earlyFinish) {
    echo "✅ T11 rolled up T12 correctly.\n";
} else {
    echo "❌ T11 failed to roll up T12.\n";
}

if ($t8->earlyFinish == $t11->earlyFinish) {
    echo "✅ T8 rolled up T11 correctly.\n";
} else {
    echo "❌ T8 failed to roll up T11 (Got " . $t8->earlyFinish->format('Y-m-d') . ", Expected " . $t11->earlyFinish->format('Y-m-d') . ")\n";
}
