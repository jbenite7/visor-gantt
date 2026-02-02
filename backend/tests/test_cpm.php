<?php
// backend/tests/test_cpm.php

require_once __DIR__ . '/../src/bootstrap.php';

use Domain\Scheduling\Entity\Task;
use Domain\Scheduling\ValueObject\Dependency;
use Domain\Scheduling\ValueObject\DependencyType;
use Domain\Scheduling\Service\CPMCalculatorService;
use Domain\Scheduling\Service\CalendarService;

$calendar = new CalendarService();
$calculator = new CPMCalculatorService($calendar);
$projectStart = new DateTimeImmutable('2026-06-01 08:00:00');

echo "--- Iniciando Test CPM ---\n";

$tasks = [
    new Task(1, 'Task A', 5 * 8 * 60),
    new Task(2, 'Task B', 3 * 8 * 60),
    new Task(3, 'Task C', 2 * 8 * 60),
    new Task(4, 'Task D', 4 * 8 * 60),
];

$dependencies = [
    new Dependency(1, 2, DependencyType::FinishToStart),
    new Dependency(2, 3, DependencyType::FinishToStart),
    new Dependency(1, 4, DependencyType::StartToStart, 2 * 8 * 60),
    new Dependency(4, 3, DependencyType::FinishToStart)
];

try {
    // Add Milestone Critical
    $tasks[] = new Task(5, 'Milestone End (Critical)', 0, null, null, null, null, 0, false, true);
    $dependencies[] = new Dependency(3, 5, DependencyType::FinishToStart);

    // Add Milestone Non-Critical (Linked to D)
    $tasks[] = new Task(6, 'Milestone Internal', 0, null, null, null, null, 0, false, true);
    $dependencies[] = new Dependency(4, 6, DependencyType::FinishToStart);

    $results = $calculator->calculate($tasks, $dependencies, $projectStart);

    // --- HTML Generator ---

    $minTime = $projectStart->getTimestamp();
    $maxTime = $minTime;
    foreach ($results as $t) {
        if ($t->earlyFinish) {
            $maxTime = max($maxTime, $t->earlyFinish->getTimestamp());
        }
    }
    $maxTime += 86400 * 2;
    $totalSeconds = $maxTime - $minTime;
    if ($totalSeconds === 0) $totalSeconds = 1;

    $html = '<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Test Visual Motor CPM (Avanzado)</title>
    <style>
        body { font-family: "Inter", sans-serif; margin: 0; background: #f8fafc; display: flex; flex-direction: column; height: 100vh; }
        header { background: #fff; padding: 15px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
        h1 { margin: 0; font-size: 1.2rem; color: #0f172a; }
        .legend { display: flex; gap: 15px; font-size: 0.9rem; }
        .legend span { display: flex; align-items: center; gap: 6px; }
        .dot { width: 10px; height: 10px; border-radius: 50%; }
        
        #workspace { display: flex; flex: 1; overflow: hidden; }
        
        /* TABLE SIDE */
        .table-view { width: 300px; background: #fff; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; z-index: 2; box-shadow: 2px 0 5px rgba(0,0,0,0.05); }
        .table-header { height: 40px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; padding-left: 10px; font-weight: 600; font-size: 0.85rem; color: #475569; }
        .table-row { height: 40px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; padding-left: 15px; font-size: 0.9rem; color: #334155; }
        .table-row:hover { background: #f8fafc; }
        .t-id { width: 30px; color: #94a3b8; font-size: 0.8rem; }
        .t-name { flex: 1; font-weight: 500; }
        .t-date { width: 80px; font-size: 0.75rem; color: #64748b; }

        /* GANTT SIDE */
        .gantt-view { flex: 1; overflow: auto; position: relative; background: #fff; }
        .timeline-header { height: 40px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; z-index: 10; }
        .grid-bg { position: absolute; top: 40px; left: 0; bottom: 0; right: 0; background-image: linear-gradient(to right, #f1f5f9 1px, transparent 1px); background-size: 100px 100%; pointer-events: none; }
        
        .task-bar-wrapper { position: absolute; height: 40px; display: flex; align-items: center; pointer-events: none; }
        .task-bar { 
            height: 20px; 
            background: #3b82f6; 
            border-radius: 4px; 
            position: relative; 
            pointer-events: auto; 
            box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
            transition: transform 0.2s;
        }
        .task-bar:hover { transform: scaleY(1.1); }
        
        .task-bar.critical { 
            background: #ef4444; 
            box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
            background-image: repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px);
        }

        .milestone {
            width: 16px; height: 16px;
            background: #f59e0b;
            transform: rotate(45deg);
            border: 2px solid #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            margin-left: -8px; /* Center diamond */
        }
        .milestone.critical { background: #dc2626; border-color: #fee2e2; }

        /* ARROWS */
        svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; z-index: 1; }
        path { fill: none; stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 4; }
        path.critical-link { stroke: #ef4444; stroke-width: 2; stroke-dasharray: 0; }
    </style>
</head>
<body>
    <header>
        <h1>💎 Visor CPM Estático</h1>
        <div class="legend">
            <span><div class="dot" style="background:#3b82f6"></div> Tarea Normal</span>
            <span><div class="dot" style="background:#ef4444"></div> Tarea Crítica</span>
            <span><div class="dot" style="background:#f59e0b"></div> Hito</span>
            <span><div class="dot" style="background:#dc2626; transform:rotate(45deg)"></div> Hito Crítico</span>
        </div>
    </header>
    <div id="workspace">
        <div class="table-view">
            <div class="table-header">Nombre de Tarea</div>';

    foreach ($results as $index => $t) {
        $startStr = $t->earlyStart ? $t->earlyStart->format('d/m H:i') : '';
        $html .= "<div class='table-row'>
                    <div class='t-id'>{$t->id}</div>
                    <div class='t-name'>{$t->name}</div>
                    <div class='t-date'>{$startStr}</div>
                  </div>";
    }

    $html .= '</div>
        <div class="gantt-view">
            <div class="timeline-header"></div>
            <div class="grid-bg"></div>
            <svg id="arrows-layer">';

    // ARROWS
    foreach ($dependencies as $dep) {
        $fromTask = null;
        $toTask = null;
        $fromIdx = 0;
        $toIdx = 0;
        foreach ($results as $idx => $r) {
            if ($r->id == $dep->predecessorId) {
                $fromTask = $r;
                $fromIdx = $idx;
            }
            if ($r->id == $dep->successorId) {
                $toTask = $r;
                $toIdx = $idx;
            }
        }

        if ($fromTask && $toTask && $fromTask->earlyFinish && $toTask->earlyStart) {
            $scale = 1000;
            $x1 = ($fromTask->earlyFinish->getTimestamp() - $minTime) / $totalSeconds * $scale;
            $y1 = ($fromIdx * 40) + 20 + 40;

            $x2 = ($toTask->earlyStart->getTimestamp() - $minTime) / $totalSeconds * $scale;
            $y2 = ($toIdx * 40) + 20 + 40;

            $isCriticalLink = $fromTask->isCritical && $toTask->isCritical;
            $cls = $isCriticalLink ? "critical-link" : "";

            // Simple Bezier
            $html .= "<path d='M {$x1} {$y1} C {$x1} {$y1}, {$x1} {$y2}, {$x2} {$y2}' class='{$cls}' vector-effect='non-scaling-stroke' />";
        }
    }

    $html .= '</svg>';

    // BARS
    foreach ($results as $index => $t) {
        if (!$t->earlyStart || !$t->earlyFinish) continue;

        $startPct = (($t->earlyStart->getTimestamp() - $minTime) / $totalSeconds) * 100;
        $durPct = (($t->earlyFinish->getTimestamp() - $t->earlyStart->getTimestamp()) / $totalSeconds) * 100;

        $top = ($index * 40) + 40;

        $barHtml = '';
        if ($t->isMilestone) {
            $cls = $t->isCritical ? 'milestone critical' : 'milestone';
            $barHtml = "<div class='{$cls}'></div>";
        } else {
            $cls = $t->isCritical ? 'task-bar critical' : 'task-bar';
            $width = max($durPct, 0.2);
            $barHtml = "<div class='{$cls}' style='width: {$width}%;'> 
                            <span style='margin-left: 5px; color: white;'>{$t->totalFloat}m</span>
                        </div>";
        }

        $html .= "<div class='task-bar-wrapper' style='top: {$top}px; left: {$startPct}%; width: 100%;'>
                    {$barHtml}
                  </div>";
    }

    $html .= '</div></div>
    <script>
        const svg = document.querySelector("svg");
        const gantt = document.querySelector(".gantt-view");
        svg.setAttribute("viewBox", "0 0 1000 " + gantt.scrollHeight);
        svg.setAttribute("preserveAspectRatio", "none");
    </script>
</body>
</html>';

    $outputPath = __DIR__ . '/../../frontend/public/cpm_test.html';
    file_put_contents($outputPath, $html);

    echo "--- Enhanced Visual Generated ---\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
