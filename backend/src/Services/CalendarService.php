<?php

declare(strict_types=1);

require_once __DIR__ . '/../../config/database.php';

class CalendarService
{
    private array $holidays = [];
    private PDO $pdo;

    public function __construct()
    {
        // Connect to DB
        $this->pdo = Database::getInstance()->getConnection();
        $this->loadHolidays();
    }

    private function loadHolidays(): void
    {
        try {
            $stmt = $this->pdo->query("SELECT date FROM holidays");
            $this->holidays = $stmt->fetchAll(PDO::FETCH_COLUMN);
        } catch (Exception $e) {
            // Fallback to empty array or log error
            error_log("Error loading holidays: " . $e->getMessage());
            $this->holidays = [];
        }
    }

    /**
     * Refresh holidays from DB (useful after updates)
     */
    public function refresh(): void
    {
        $this->loadHolidays();
    }

    public function isWorkingDay(DateTimeInterface $date): bool
    {
        $dayOfWeek = (int)$date->format('N'); // 1 (Mon) - 7 (Sun)
        $dateString = $date->format('Y-m-d');

        // Rule 1: Sundays are non-working (Saturdays ARE working)
        if ($dayOfWeek === 7) {
            return false;
        }

        // Rule 2: Holidays are non-working
        if (in_array($dateString, $this->holidays, true)) {
            return false;
        }

        // Default: Monday-Saturday are working days unless holiday
        return true;
    }

    public function addWorkingDays(DateTime $startDate, float $durationDays): string
    {
        $current = clone $startDate;

        // Normalize to start of day for calculation consistency
        $current->setTime(0, 0, 0);

        // If duration is 0, we still need to check if start date is working day?
        // Usually 0 duration = milestone. If it falls on Sunday, does it move?
        // MS Project moves milestones to next working day.

        // Step 1: Ensure we start on a working day.
        while (!$this->isWorkingDay($current)) {
            $current->modify('+1 day');
        }

        // Step 2: Add duration
        // We consider the start day as Day 1 of work if it has duration.
        // So we add (duration - 1) days, but skipping non-working days.

        $daysToAdd = $durationDays;

        // If we have duration > 0, we consume the current day as the first working day.
        // So we decrement remaining days by 1 (or by fractional amount if we supported hours, but here we treat in days)
        // Actually, simple loop approach:
        // While we have > 0 days remaining...
        //   Move to next day
        //   If that day is working, decrement counter.

        // Optimization: "End Date" logic is tricky.
        // If task is 1 day: Start Monday -> End Monday.
        // If task is 2 days: Start Monday -> End Tuesday.
        // So we should loop ($daysToAdd - 1) times to find the End Date.

        // Integer part loop
        $fullDays = floor($daysToAdd);

        // If duration is exactly integers (e.g. 5.0), we subtract 1 because "Start Date" covers the first day.
        // Example: 1 Day duration. Start Mon. End Mon. Loop 0 times.
        // Example: 2 Day duration. Start Mon. End Tue. Loop 1 time.
        // But if duration is 0, loop 0 times.
        if ($fullDays >= 1) {
            $loops = $fullDays - 1;
            for ($i = 0; $i < $loops; $i++) {
                $current->modify('+1 day');
                while (!$this->isWorkingDay($current)) {
                    $current->modify('+1 day');
                }
            }
        }

        // Fractional handling (if any, e.g. 0.5 days)
        // If we have 0.5 days, and we started Monday. Monday is the day.
        // We don't advance date for fractional parts that fit in the same day.
        // We only care about the DATE component for the Gantt Chart usually.
        // However, if the logic requires "Finish Date", usually it's End of Day.

        return $current->format('Y-m-d') . 'T17:00:00';
    }
    public function addDuration(DateTimeImmutable $start, int $minutes): DateTimeImmutable
    {
        $days = $minutes / 480.0;
        // Reuse existing logic. Note: This forces 17:00 end time currently.
        $resStr = $this->addWorkingDays(DateTime::createFromImmutable($start), $days);
        return new DateTimeImmutable($resStr);
    }

    public function subtractDuration(DateTimeImmutable $end, int $minutes): DateTimeImmutable
    {
        $days = $minutes / 480.0;
        $current = DateTime::createFromImmutable($end);

        $fullDays = floor($days);
        if ($fullDays >= 1) {
            $loops = $fullDays - 1;
            for ($i = 0; $i < $loops; $i++) {
                $current->modify('-1 day');
                while (!$this->isWorkingDay($current)) {
                    $current->modify('-1 day');
                }
            }
        }
        return DateTimeImmutable::createFromMutable($current)->setTime(8, 0, 0);
    }
}
