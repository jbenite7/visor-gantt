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
// Day 2: Saturday (Working)
// Finish: Saturday end (or Sunday start exclusive?)
// If addDuration returns Exclusive End Date:
// Fri -> Sat (1 day). Sat -> Sun (1 day).
// Result: Sunday (Start of). Or simple logic check.

$start = new DateTimeImmutable('2026-06-05 08:00:00'); // Friday
$durationMinutes = 2 * 8 * 60; // 2 Days

$end = $calendar->addDuration($start, $durationMinutes);

echo "Start: " . $start->format('Y-m-d l H:i') . "\n";
echo "End: " . $end->format('Y-m-d l H:i') . "\n";

// Verification
// 2 Days from Fri AM.
// Fri work. Sat work.
// Result should be Monday AM? 
// Wait. 
// Fri -> Sat (End of Fri).
// Sat -> Sun (End of Sat).
// Sun is Non Working. So skip to Mon?
// skipNonWorkingDays(Sun) -> Mon.
// So Result should be Monday.

$dow = $end->format('N');
$ymd = $end->format('Y-m-d');

if ($ymd === '2026-06-08') { // Monday
    echo "✅ TEST PASSED: Setup Fri-Sat Work -> Ends Mon AM (Exclusive).\n";
} elseif ($ymd === '2026-06-07') { // Sunday
    // If it returns Sunday, it means it didn't skip non-working at the end?
    // addDuration logic:
    // Loop days.
    // i=0: Fri->Sat. Skip? Sat is working. Current=Sat.
    // i=1: Sat->Sun. Skip? Sun is NON working. Skip->Mon. Current=Mon.
    // Result Mon.
    echo "❌ TEST FAILED: Result is Sunday. Did not skip non-working day? Or logic flaw?\n";
} else {
    echo "❌ TEST FAILED: Result is $ymd ($dow).\n";
}
