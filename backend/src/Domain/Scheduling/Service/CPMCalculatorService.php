<?php

declare(strict_types=1);

namespace Domain\Scheduling\Service;

use Domain\Scheduling\Entity\Task;
use Domain\Scheduling\ValueObject\Dependency;
use Domain\Scheduling\ValueObject\DependencyType;
use DateTimeImmutable;
use Domain\Scheduling\Service\CalendarService;

class CPMCalculatorService
{
    public function __construct(
        private CalendarService $calendar
    ) {}

    /**
     * @param Task[] $tasks Keyed by ID ideally, or we re-key them.
     * @param Dependency[] $dependencies
     * @param DateTimeImmutable $projectStart
     * @return Task[] Calculated Tasks
     */
    public function calculate(array $tasks, array $dependencies, DateTimeImmutable $projectStart): array
    {
        // 0. Ensure Tasks are Keyed by ID for O(1) Lookup
        // AND Capture Original Order (WBS)
        $originalOrder = [];
        $taskMap = [];
        foreach ($tasks as $task) {
            $taskMap[$task->id] = $task;
            $originalOrder[] = $task->id;
        }

        // 1. Build Graphs
        // successors: task_id => [Dependency, ...] (outgoing edges)
        // predecessors: task_id => [Dependency, ...] (incoming edges)
        $graph = $this->buildGraph($tasks, $dependencies);

        // 2. Topological Sort (Kahn's Algorithm)
        // Returns array of Task IDs in dependency order
        $sortedIds = $this->topologicalSort($taskMap, $graph['successors'], $graph['inDegree']);

        // 3. Forward Pass (Early Start/Finish)
        $calculatedTasks = $this->forwardPass($sortedIds, $taskMap, $graph['predecessors'], $projectStart);

        // 4. Backward Pass (Late Start/Finish)
        $projectFinish = $this->getProjectFinishDate($calculatedTasks);
        $calculatedTasks = $this->backwardPass($sortedIds, $calculatedTasks, $graph['successors'], $projectFinish);

        // 5. Float & Criticality
        foreach ($calculatedTasks as &$task) {
            $float = 0;
            $isCritical = false;

            if ($task->lateStart && $task->earlyStart) {
                // Calculate difference in MINUTES
                // We trust earlyStart/lateStart are on working days/times if calendar is good 
                // But strict Float is: how much can I delay without delaying project finish?

                // Simple float: LS timestamp - ES timestamp
                // This includes weekends in the "gap", which might be misleading or correct depending on definition.
                // "Working Float" would require counting working minutes between ES and LS.
                // For MVP: Simple timestamp diff is standard for identifying critical path (0 float).

                $diffSeconds = $task->lateStart->getTimestamp() - $task->earlyStart->getTimestamp();
                $diffMinutes = (int)($diffSeconds / 60);

                // Tolerance logic: Float < 15 mins = Critical
                $float = $diffMinutes;
                $isCritical = $float <= 15; // Small epsilon
            }

            // Re-create immutable task with new values
            $task = $task->withCalculation(
                $task->earlyStart,
                $task->earlyFinish,
                $task->lateStart,
                $task->lateFinish,
                $float,
                $isCritical
            );
        }
        unset($task); // Break reference

        // 6. Roll-up Summary Dates (Rule 1)
        // This must happen AFTER all standard tasks are calculated to ensure Min/Max is correct.
        // We pass $originalOrder to ensure hierarchy is reconstructed correctly.
        $calculatedTasks = $this->rollUpSummaryDates($calculatedTasks, $originalOrder);

        return $calculatedTasks;
    }

    /**
     * Rule 1: Summary Tasks Date Calculation
     * Start = Min(Children Start)
     * Finish = Max(Children Finish)
     * Duration = Working Days between Start and Finish
     * 
     * @param Task[] $tasks Calculated tasks keyed by ID
     * @param int[] $originalOrder List of Task IDs in WBS/Document Order
     */
    private function rollUpSummaryDates(array $tasks, array $originalOrder): array
    {
        // 1. Restore WBS Order to build hierarchy correctly
        // We cannot rely on ID sorting matching WBS.
        $orderedTasks = [];
        foreach ($originalOrder as $id) {
            if (isset($tasks[$id])) {
                $orderedTasks[] = $tasks[$id];
            }
        }

        // Pass 1: Build Hierarchy
        $childrenOf = []; // parentId => [childId, childId...]
        $stack = []; // level => taskId

        foreach ($orderedTasks as $task) {
            $level = $task->outlineLevel; // Ensure Entity has this. If not, use 0.

            // Clear stack for deeper levels
            // e.g. if we are at Level 1, anything at Level 2,3,4 from previous branches is gone.
            // Actually, if we are at Level 1, looking for parent at Level 0.
            // If we are Level 2, parent is Level 1.

            // Valid parent is the last seen task at (Level - 1).
            if ($level > 1) {
                if (isset($stack[$level - 1])) {
                    $parentId = $stack[$level - 1];
                    $childrenOf[$parentId][] = $task->id;
                }
            }

            // Update stack for this level
            $stack[$level] = $task->id;
        }

        // Pass 2: Calculate Dates (Bottom-Up)
        // We need to process deepest level first.
        // Get all parents, sort by Level Descending.
        $parents = [];
        foreach ($orderedTasks as $task) {
            if (isset($childrenOf[$task->id])) {
                $parents[] = $task;
            }
        }

        // Close closures? No, simple sort.
        usort($parents, fn($a, $b) => $b->outlineLevel <=> $a->outlineLevel);

        foreach ($parents as $parent) {
            $minStart = null;
            $maxFinish = null;

            foreach ($childrenOf[$parent->id] as $childId) {
                $child = $tasks[$childId]; // Access current state (calculated subtasks)

                // Skip if child has no valid dates
                if (!$child->earlyStart || !$child->earlyFinish) continue;

                // If child is a summary itself, it should have been processed already (due to Bottom-Up sort)

                if ($minStart === null || $child->earlyStart < $minStart) {
                    $minStart = $child->earlyStart;
                }

                if ($maxFinish === null || $child->earlyFinish > $maxFinish) {
                    $maxFinish = $child->earlyFinish;
                }
            }

            if ($minStart && $maxFinish) {
                // Update Parent
                // Calculate new Duration in working days?
                // For Summary, Duration = Finish - Start (Calendar wise).
                // Or just keep it disjoint. Correct is: Finish - Start.

                // Since we are immutable, we replace in $tasks
                $tasks[$parent->id] = $parent->withCalculation(
                    $minStart,
                    $maxFinish,
                    $minStart, // For summary, ES=LS usually in simplified view or recalc
                    $maxFinish,
                    0,
                    $parent->isCritical // Keep original or logic? 
                    // Usually if a child is critical, parent becomes critical?
                    // Let's leave criticality as is from CPM or update?
                    // Rule 1 only mentions dates.
                );
            }
        }

        return $tasks;
    }

    private function buildGraph(array $tasks, array $dependencies): array
    {
        $successors = [];
        $predecessors = [];
        $inDegree = [];

        // Initialize empty arrays for all tasks
        foreach ($tasks as $task) {
            $successors[$task->id] = [];
            $predecessors[$task->id] = [];
            $inDegree[$task->id] = 0;
        }

        foreach ($dependencies as $dep) {
            // Guard: check if tasks exist
            if (!isset($successors[$dep->predecessorId]) || !isset($successors[$dep->successorId])) {
                continue; // Skip dependencies with missing tasks
            }

            $successors[$dep->predecessorId][] = $dep;
            $predecessors[$dep->successorId][] = $dep;
            $inDegree[$dep->successorId]++;
        }

        return [
            'successors' => $successors,
            'predecessors' => $predecessors,
            'inDegree' => $inDegree
        ];
    }

    /**
     * @return array List of Task IDs sorted topologically
     */
    private function topologicalSort(array $taskMap, array $successors, array $inDegree): array
    {
        $queue = [];
        $sorted = [];

        // Find Start Nodes (inDegree 0)
        foreach ($inDegree as $id => $degree) {
            if ($degree === 0) {
                $queue[] = $id;
            }
        }

        while (!empty($queue)) {
            $u = array_shift($queue);
            $sorted[] = $u;

            if (isset($successors[$u])) {
                foreach ($successors[$u] as $dep) {
                    $v = $dep->successorId;
                    $inDegree[$v]--;
                    if ($inDegree[$v] === 0) {
                        $queue[] = $v;
                    }
                }
            }
        }

        if (count($sorted) !== count($taskMap)) {
            // Cycle detected! 
            // For MVP: Just return what we have sorted, remaining might be processed 
            // but dates won't propagate correctly for the cycle.
            // Or throw exception. For robustness, let's log/continue.
            // throw new \Exception("Circular Dependency Detected");
            // Return what we have to allow partial calc
        }

        return $sorted;
    }

    private function forwardPass(array $sortedIds, array $taskMap, array $predecessors, DateTimeImmutable $projectStart): array
    {
        $calculated = $taskMap; // Start with original tasks (copy)

        foreach ($sortedIds as $id) {
            $task = $calculated[$id];

            // Initial ES is Project Start
            $earlyStart = $projectStart;

            // Respect Manual Start (Start No Earlier Than) usually implied by XML Start
            if ($task->manualStart) {
                // Ensure date object is normalized to day start (00:00:00) 
                // Assumed done in Mapper/Parser, but safety check via calendar helper if needed
                if ($task->manualStart > $earlyStart) {
                    $earlyStart = $task->manualStart;
                }
            }

            // Check Predecessors to push Start Date
            if (isset($predecessors[$id]) && !empty($predecessors[$id])) {
                foreach ($predecessors[$id] as $dep) {
                    $predTask = $calculated[$dep->predecessorId];
                    if (!$predTask->earlyStart || !$predTask->earlyFinish) continue;

                    // Calculate Candidate Start based on Dependency Type
                    $candidateDate = null;

                    // Resolve actual minutes if lag is percentage
                    // MS Project: Lag % is based on PREDECESSOR duration.
                    $actualLagMinutes = $dep->lag;
                    if ($dep->isPercentage) {
                        // $dep->lag is the percentage value (e.g. 50).
                        // Duration is in minutes (e.g. 1 day = 480).
                        // 50% of 480 = 240 minutes.
                        $actualLagMinutes = (int)(($predTask->durationMinutes * $dep->lag) / 100);
                    }

                    switch ($dep->type) {
                        case DependencyType::FinishToStart: // Standard: ES = Pred.EF + Lag
                            // Pred EF is Inclusive Finish Date.
                            // Next Task Starts on Next Working Day.
                            $baseDate = $this->calendar->getNextWorkingDay($predTask->earlyFinish);
                            // addLag implies jumping working days if lag > 0
                            $candidateDate = $this->calendar->addLag($baseDate, $actualLagMinutes);
                            break;

                        case DependencyType::StartToStart: // SS: ES = Pred.ES + Lag
                            // Pred ES is Start. Succ ES is Start + Lag.
                            // Lag is offset, not duration.
                            $candidateDate = $this->calendar->addLag($predTask->earlyStart, $actualLagMinutes);
                            break;

                        case DependencyType::FinishToFinish: // FF: EF = Pred.EF + Lag => ES = EF - Duration
                            // Calc EF target.
                            // Pred.EF is Last Day of work.
                            // Succ.EF should be Last Day of work + Lag.
                            $targetEF = $this->calendar->addLag($predTask->earlyFinish, $actualLagMinutes);
                            // Subtract duration to get ES (inclusive subtract)
                            $candidateDate = $this->calendar->subtractDuration($targetEF, $task->durationMinutes);
                            break;

                        case DependencyType::StartToFinish: // SF: EF = Pred.ES + Lag => ES = EF - Duration
                            // Pred.ES is Start.
                            // Succ.EF = Pred.ES + Lag.
                            $targetEF = $this->calendar->addLag($predTask->earlyStart, $actualLagMinutes);
                            $candidateDate = $this->calendar->subtractDuration($targetEF, $task->durationMinutes);
                            break;
                    }

                    if ($candidateDate > $earlyStart) {
                        $earlyStart = $candidateDate;
                    }
                }
            }

            // Calculate EF = ES + Duration
            $earlyFinish = $this->calendar->addDuration($earlyStart, $task->durationMinutes);

            // Update Task in Map
            $calculated[$id] = $task->withCalculation(
                $earlyStart,
                $earlyFinish,
                new DateTimeImmutable(), // Temp placeholders
                new DateTimeImmutable(),
                0,
                false
            );
        }

        return $calculated;
    }

    private function backwardPass(array $sortedIds, array $calculatedTasks, array $successors, DateTimeImmutable $projectFinish): array
    {
        // Reverse Topological Sort
        $reverseIds = array_reverse($sortedIds);

        foreach ($reverseIds as $id) {
            $task = $calculatedTasks[$id];

            // Initial Late Finish is Project Finish
            // Unless it is a sink node (no successors), then it *is* Project Finish.
            // If it has successors, LF is dictated by them.
            // Default initialization:
            $lateFinish = $projectFinish;

            $hasSuccessors = isset($successors[$id]) && !empty($successors[$id]);

            if ($hasSuccessors) {
                // Find MIN Late Finish allowed by successors
                $minVal = null;

                foreach ($successors[$id] as $dep) {
                    $succTask = $calculatedTasks[$dep->successorId];
                    // If cycle prevented calc, skip
                    if (!$succTask->lateStart) continue;

                    $candidateLF = null;

                    // Resolve actual minutes if lag is percentage
                    // Lag % is based on PREDECESSOR duration.
                    // Here, $task is the predecessor (we are processing Predecessors in reverse order? No.)
                    // Backward Pass iterates tasks in Reverse Topological Order.
                    // We are at task 'id'. Usage: Determine LF based on Successors.
                    // Relationships: Task(id) -> Successor.
                    // Task(id) is the Predecessor in this relationship.
                    // So Lag is based on Task(id)'s duration.

                    $actualLagMinutes = $dep->lag;
                    if ($dep->isPercentage) {
                        $actualLagMinutes = (int)(($task->durationMinutes * $dep->lag) / 100);
                    }

                    switch ($dep->type) {
                        case DependencyType::FinishToStart:
                            // FS: Task.LF = PrevWorking(Succ.LS - Lag)
                            $baseDate = $this->calendar->subtractLag($succTask->lateStart, $actualLagMinutes);
                            $candidateLF = $this->calendar->getPreviousWorkingDay($baseDate);
                            break;

                        case DependencyType::StartToStart:
                            // SS: Task.LS <= Succ.LS - Lag
                            $limitLS = $this->calendar->subtractLag($succTask->lateStart, $actualLagMinutes);
                            $candidateLF = $this->calendar->addDuration($limitLS, $task->durationMinutes);
                            break;

                        case DependencyType::FinishToFinish:
                            // FF: Task.LF <= Succ.LF - Lag
                            $candidateLF = $this->calendar->subtractLag($succTask->lateFinish, $actualLagMinutes);
                            break;

                        case DependencyType::StartToFinish:
                            // SF: Task.LS <= Succ.LF - Lag
                            $limitLS = $this->calendar->subtractLag($succTask->lateFinish, $actualLagMinutes);
                            $candidateLF = $this->calendar->addDuration($limitLS, $task->durationMinutes);
                            break;
                    }

                    if ($minVal === null || $candidateLF < $minVal) {
                        $minVal = $candidateLF;
                    }
                }

                if ($minVal !== null) {
                    $lateFinish = $minVal;
                }
            } else {
                // If it's a loose end but finishes way before project end, strictly speaking in CPM 
                // its LF is Project Finish (yielding huge float). This is correct.
            }

            // Calculate LS = LF - Duration
            $lateStart = $this->calendar->subtractDuration($lateFinish, $task->durationMinutes);

            // Preserve Early Dates
            $calculatedTasks[$id] = $task->withCalculation(
                $task->earlyStart,
                $task->earlyFinish,
                $lateStart,
                $lateFinish,
                0, // Float calculated later
                false
            );
        }

        return $calculatedTasks;
    }

    private function getProjectFinishDate(array $tasks): DateTimeImmutable
    {
        $max = null;
        foreach ($tasks as $t) {
            if (!$t->earlyFinish) continue;
            if ($max === null || $t->earlyFinish > $max) {
                $max = $t->earlyFinish;
            }
        }
        return $max ?? new DateTimeImmutable();
    }
}
