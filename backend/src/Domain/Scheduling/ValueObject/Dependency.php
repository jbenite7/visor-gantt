<?php

declare(strict_types=1);

namespace Domain\Scheduling\ValueObject;

readonly class Dependency
{
    public function __construct(
        public string|int $predecessorId,
        public string|int $successorId,
        public DependencyType $type,
        public int $lag = 0, // Lag in minutes/hours depending on resolution. Standardize on Minutes? Or Days? Let's say Minutes for precision.
        public bool $isPercentage = false // New property
    ) {}
}
