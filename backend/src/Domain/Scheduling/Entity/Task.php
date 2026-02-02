<?php

declare(strict_types=1);

namespace Domain\Scheduling\Entity;

use DateTimeImmutable;

readonly class Task
{
    public function __construct(
        public string|int $id,
        public string $name,
        public int $durationMinutes, // Normalized duration
        public ?DateTimeImmutable $earlyStart = null,
        public ?DateTimeImmutable $earlyFinish = null,
        public ?DateTimeImmutable $lateStart = null,
        public ?DateTimeImmutable $lateFinish = null,
        public int $totalFloat = 0,
        public bool $isCritical = false,
        public bool $isMilestone = false,
        public int $outlineLevel = 0,
        public bool $isSummary = false,
        public ?DateTimeImmutable $manualStart = null
    ) {}

    /**
     * Create a new instance with updated calculated values (since it's immutable)
     */
    public function withCalculation(
        DateTimeImmutable $earlyStart,
        DateTimeImmutable $earlyFinish,
        DateTimeImmutable $lateStart,
        DateTimeImmutable $lateFinish,
        int $totalFloat,
        bool $isCritical
    ): self {
        return new self(
            $this->id,
            $this->name,
            $this->durationMinutes,
            $earlyStart,
            $earlyFinish,
            $lateStart,
            $lateFinish,
            $totalFloat,
            $isCritical,
            $this->isMilestone,
            $this->outlineLevel,
            $this->isSummary,
            $this->manualStart
        );
    }
}
