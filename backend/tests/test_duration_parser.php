<?php

function parseDuration(string $value, int $format): float
{
    echo "Parsing '$value' with format $format\n";

    // 1. Handle ISO 8601 Strings (e.g. PT8H0M0S)
    if (strpos($value, 'PT') === 0) {
        try {
            $interval = new DateInterval($value);
            // Convert everything to Hours first
            $hours = ($interval->d * 24) + $interval->h + ($interval->i / 60) + ($interval->s / 3600);

            echo "  ISO Detected. Days: {$interval->d}, Hours: {$interval->h}, Mins: {$interval->i}\n";
            echo "  Total Hours: $hours\n";

            // Convert hours to work days (dividing by 8)
            // If the XML says "PT8H", that is 1 working day.
            return round($hours / 8, 2);
        } catch (Exception $e) {
            echo "  Exception: " . $e->getMessage() . "\n";
            return 0;
        }
    }

    echo "  Not ISO. Numeric fallback.\n";
    return (float)$value;
}

// Test Cases
$cases = [
    ['PT16H0M0S', 7],
    ['PT32H0M0S', 7],
    ['PT8H', 7],
    ['PT8H0M0S', 7],
    ['PT0H0M0S', 7],
    ['  PT16H0M0S  ', 7], // Test whitespace
];

foreach ($cases as $case) {
    $result = parseDuration($case[0], $case[1]);
    echo "  Result: $result days\n";
    echo "-------------------\n";
}
