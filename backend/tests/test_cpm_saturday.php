<?php

require_once __DIR__ . '/../src/bootstrap.php';

use Domain\Scheduling\Entity\Task;
use Domain\Scheduling\Service\CalendarService;

// Create Calendar with NO holidays
// Service defaults: Sun=7 is non-working. Sat=6 IS working.
$calendar = new Domain\Scheduling\Service\CalendarService([]);

echo "--- Iniciando Test Saturday Work ---\n";

// Scenario:
// Start Friday. Duration 2 Days (16 hours).
// Expected:
// Day 1: Friday
// Day 2: Saturday (working in this project)
// Finish: Saturday

$start = new DateTimeImmutable('2026-06-05 08:00:00'); // Friday
$durationMinutes = 2 * 8 * 60; // 2 Days

$end = $calendar->addDuration($start, $durationMinutes);

echo "Start: " . $start->format('Y-m-d l H:i') . "\n";
echo "End: " . $end->format('Y-m-d l H:i') . "\n";

// Verification
$dow = $end->format('N');
$ymd = $end->format('Y-m-d');

if ($ymd === '2026-06-06') { // Saturday
    echo "✅ TEST PASSED: Setup Fri-Sat Work -> Ends Saturday.\n";
} else {
    echo "❌ TEST FAILED: Result is $ymd ($dow).\n";
    exit(1);
}
