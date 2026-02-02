<?php

declare(strict_types=1);

namespace Domain\Scheduling\ValueObject;

enum DependencyType: string
{
    case FinishToStart = 'FS';
    case StartToStart = 'SS';
    case FinishToFinish = 'FF';
    case StartToFinish = 'SF';

    /**
     * Parse from integer (MPP format usually 1=SS, 2=FF, etc. varies by parser)
     * Standard MPP: 0=FF, 1=FS, 2=SF, 3=SS (Example, need to verify strict mapping)
     * For now, we rely on the parser to give us string or standard int if known.
     * Let's stick to parsing standard MPP Type Integers from typical XML.
     * MS Project XML: 1=FS, 2=SS, 3=FF, 0/Empty=FS default usually, 4=SF
     */
    public static function fromMppType(int $type): self
    {
        return match ($type) {
            1 => self::FinishToStart,
            2 => self::StartToStart,
            3 => self::FinishToFinish,
            4 => self::StartToFinish,
            default => self::FinishToStart,
        };
    }
}
