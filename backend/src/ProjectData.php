<?php

declare(strict_types=1);

class ProjectData implements JsonSerializable
{
    public string $name = 'Sin título';
    public string $startDate = '';
    public string $finishDate = '';
    public array $tasks = [];
    public array $resources = [];
    public array $availableColumns = [];

    public function jsonSerialize(): mixed
    {
        return [
            'project' => [
                'name' => $this->name,
                'startDate' => $this->startDate,
                'finishDate' => $this->finishDate,
            ],
            'tasks' => $this->tasks,
            'resources' => $this->resources,
            'availableColumns' => $this->availableColumns
        ];
    }
}
