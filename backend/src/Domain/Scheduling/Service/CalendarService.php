<?php

declare(strict_types=1);

namespace Domain\Scheduling\Service;

use DateTimeImmutable;
use DateTime;
use DateTimeInterface;
use DateInterval;

class CalendarService
{
    private array $holidays = [];
    private int $hoursPerDay = 8;
    private int $startHour = 8;
    // private int $endHour = 17; // Implicit from start + duration

    public function __construct(array $holidays = [])
    {
        // Ensure holidays are formatted as Y-m-d strings
        $this->holidays = $holidays;
    }

    /**
     * Add duration (in minutes) to a start date, respecting working hours.
     * Simple implementation: 
     * - If duration % 8h == 0, treat as full days.
     * - If fractional, adds precision. 
     * For MVP/Migration, assuming tasks are mostly measured in days (MPP standard).
     */
    public function addDuration(DateTimeImmutable $start, int $minutes): DateTimeImmutable
    {
        // "Convierte las fechas a días completos ... no tengas en cuenta la hora"
        // Force normalization
        $current = $start->setTime(0, 0, 0);

        // Convert minutes to days (8h = 480m = 1 day)
        // If minutes > 0 but < 480, it counts as 1 day (or 0.x days)? 
        // Usually CPM rounding up to 1 day is safer if we ignore time. 
        // But user said "Convert always durations to days".
        // Let's assume input minutes are multiples of 8h or handled as floats?
        // Method signature is int $minutes.

        $days = (int)ceil($minutes / ($this->hoursPerDay * 60));

        // If 0 days (0 minutes), result is same day (Milestone)

        // Add Days logic:
        // Day 1 (Start) counts as 1 day of work.
        // So we add (days - 1).

        if ($days >= 1) {
            $loops = $days - 1;
            for ($i = 0; $i < $loops; $i++) {
                $current = $current->modify('+1 day');
                $current = $this->skipNonWorkingDays($current);
            }
        }

        return $current;
    }

    public function getNextWorkingDay(DateTimeInterface $date): DateTimeImmutable
    {
        $d = DateTime::createFromInterface($date);
        $d->setTime(0, 0, 0);
        $d->modify('+1 day');
        while (!$this->isWorkingDay(DateTimeImmutable::createFromMutable($d))) {
            $d->modify('+1 day');
        }
        return DateTimeImmutable::createFromMutable($d);
    }

    public function getPreviousWorkingDay(DateTimeInterface $date): DateTimeImmutable
    {
        $d = DateTime::createFromInterface($date);
        $d->setTime(0, 0, 0);
        $d->modify('-1 day');
        while (!$this->isWorkingDay(DateTimeImmutable::createFromMutable($d))) {
            $d->modify('-1 day');
        }
        return DateTimeImmutable::createFromMutable($d);
    }

    public function addLag(DateTimeImmutable $start, int $minutesLag): DateTimeImmutable
    {
        $current = $start->setTime(0, 0, 0);
        $days = (int)ceil($minutesLag / ($this->hoursPerDay * 60));

        // Lag is strictly additive. 1 Day Lag = Next Working Day (+1).
        // 0 Lag = Same Day.

        for ($i = 0; $i < $days; $i++) {
            $current = $current->modify('+1 day');
            $current = $this->skipNonWorkingDays($current);
        }
        return $current;
    }

    public function subtractLag(DateTimeImmutable $end, int $minutesLag): DateTimeImmutable
    {
        $current = $end->setTime(0, 0, 0);
        $days = (int)ceil($minutesLag / ($this->hoursPerDay * 60));

        for ($i = 0; $i < $days; $i++) {
            $current = $current->modify('-1 day');
            $current = $this->skipNonWorkingDaysBackwards($current);
        }
        return $current;
    }

    /**
     * Subtract duration (for Backward Pass)
     */
    public function subtractDuration(DateTimeImmutable $end, int $minutes): DateTimeImmutable
    {
        $current = $end->setTime(0, 0, 0);
        $days = (int)ceil($minutes / ($this->hoursPerDay * 60));

        if ($days >= 1) {
            $loops = $days - 1;
            for ($i = 0; $i < $loops; $i++) {
                $current = $current->modify('-1 day');
                $current = $this->skipNonWorkingDaysBackwards($current);
            }
        }
        return $current;
    }

    public function skipNonWorkingDays(DateTimeImmutable $date): DateTimeImmutable
    {
        while (!$this->isWorkingDay($date)) {
            $date = $date->modify('+1 day');
            // Normalize to start of day if we skipped? 
            // Better keep time unless we jumped.
        }
        return $date;
    }

    private function skipNonWorkingDaysBackwards(DateTimeImmutable $date): DateTimeImmutable
    {
        while (!$this->isWorkingDay($date)) {
            $date = $date->modify('-1 day');
        }
        return $date;
    }

    // 1=Mon, 7=Sun. Default non-working: 7 (Sun).
    private array $nonWorkingDays = [7];

    public function setHolidays(array $holidays): void
    {
        $this->holidays = $holidays;
    }

    public function setWeekDays(array $weekDaysConfig): void
    {
        // XML: 1=Sun, 7=Sat. PHP: 1=Mon, 7=Sun.
        // We need to map or just store what is non-working.
        // weekDaysConfig: KEY=Type (1-7), VALUE=bool isWorking.
        // Standard XML: 1=Sun (Non), 2-6 (Work), 7=Sat (Non).

        $this->nonWorkingDays = [];
        foreach ($weekDaysConfig as $type => $isWorking) {
            if (!$isWorking) {
                // Map XML DayType to PHP 'N' format?
                // XML: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
                // PHP N: 1=Mon, ..., 7=Sun

                $phpDay = match ($type) {
                    1 => 7, // Sun
                    2 => 1, // Mon
                    3 => 2,
                    4 => 3,
                    5 => 4,
                    6 => 5,
                    7 => 6, // Sat
                };
                $this->nonWorkingDays[] = $phpDay;
            }
        }
    }

    public function isWorkingDay(DateTimeImmutable $date): bool
    {
        $dow = (int)$date->format('N');
        if (in_array($dow, $this->nonWorkingDays, true)) {
            return false;
        }

        $ymd = $date->format('Y-m-d');
        if (in_array($ymd, $this->holidays, true)) {
            return false;
        }

        return true;
    }
}
