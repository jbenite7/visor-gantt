<?php

declare(strict_types=1);

class ProjectStorage
{
    private string $dataDir;
    private string $indexFile;

    public function __construct()
    {
        $this->dataDir = __DIR__ . '/../data/projects';
        $this->indexFile = $this->dataDir . '/projects.json';
        $this->ensureDirectoryExists();
    }

    private function ensureDirectoryExists(): void
    {
        if (!is_dir($this->dataDir)) {
            mkdir($this->dataDir, 0755, true);
        }
        if (!file_exists($this->indexFile)) {
            file_put_contents($this->indexFile, json_encode([]));
        }
    }

    /**
     * Get list of all saved projects (metadata only)
     */
    public function listProjects(): array
    {
        $content = file_get_contents($this->indexFile);
        return json_decode($content, true) ?: [];
    }

    /**
     * Find project by name, returns ID if found or null
     */
    public function findByName(string $name): ?int
    {
        $projects = $this->listProjects();
        foreach ($projects as $p) {
            if (strcasecmp($p['name'], $name) === 0) {
                return $p['id'];
            }
        }
        return null;
    }

    /**
     * Save a project and return its ID
     * @param bool $overwriteId If set, overwrites project with this ID
     */
    // Old saveProject method removed


    /**
     * Get a specific project by ID
     */
    public function getProject(int $id): ?array
    {
        $projectFile = $this->dataDir . '/project_' . $id . '.json';

        if (!file_exists($projectFile)) {
            return null;
        }

        $content = file_get_contents($projectFile);
        return json_decode($content, true);
    }

    /**
     * Find projects with >90% similarity in task UIDs
     * @param array $newTasks List of tasks from the new file
     */
    public function findSimilarProjects(array $newTasks): array
    {
        $projects = $this->listProjects();
        $candidates = [];

        // Extract UIDs from new project for fast lookup
        $newUids = [];
        foreach ($newTasks as $task) {
            if (isset($task['UID'])) {
                $newUids[$task['UID']] = true;
            }
        }
        $totalNew = count($newUids);

        if ($totalNew === 0) return [];

        foreach ($projects as $p) {
            // Load full project data to compare tasks
            // Optimization: In a real DB we would query, here we must load JSON
            $fullProject = $this->getProject($p['id']);
            if (!$fullProject) continue;

            $existingTasks = $fullProject['tasks'] ?? [];
            $matchCount = 0;

            foreach ($existingTasks as $t) {
                if (isset($t['UID']) && isset($newUids[$t['UID']])) {
                    $matchCount++;
                }
            }

            // Calculate similarity percentage based on the new project's task count
            // (How many of the new tasks already exist in the old project?)
            $similarity = ($totalNew > 0) ? ($matchCount / $totalNew) * 100 : 0;

            if ($similarity >= 70) {
                $candidates[] = [
                    'id' => $p['id'],
                    'name' => $p['name'],
                    'similarity' => round($similarity, 1),
                    'versionGroup' => $p['versionGroup'] ?? null
                ];
            }
        }

        return $candidates;
    }

    /**
     * Save a project and return its ID
     * @param bool $overwriteId If set, overwrites project with this ID
     * @param int|null $versionOfId If set, marks this project as a version of another
     */
    public function saveProject(array $data, string $name = '', ?int $overwriteId = null, ?int $versionOfId = null): int
    {
        $projects = $this->listProjects();
        $projectName = $name ?: ($data['project']['name'] ?? 'Proyecto Sin Nombre');

        // If overwriting existing project
        if ($overwriteId !== null) {
            // ... (existing overwrite logic) ...
            $projectFile = $this->dataDir . '/project_' . $overwriteId . '.json';
            file_put_contents($projectFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            foreach ($projects as &$p) {
                if ($p['id'] === $overwriteId) {
                    $p['taskCount'] = count($data['tasks'] ?? []);
                    $p['updatedAt'] = date('c');
                    break;
                }
            }
            file_put_contents($this->indexFile, json_encode($projects, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            return (int)$overwriteId;
        }

        // Generate new ID
        $maxId = 0;
        foreach ($projects as $p) {
            if ($p['id'] > $maxId) $maxId = $p['id'];
        }
        $newId = $maxId + 1;

        // Determine Version Group
        $versionGroup = null;
        if ($versionOfId) {
            // Inherit group from parent, or create new group if parent has none
            foreach ($projects as $p) {
                if ($p['id'] === $versionOfId) {
                    $versionGroup = $p['versionGroup'] ?? $p['id']; // Group ID is the ID of the first version (root)

                    // If the parent didn't have a group, we must update it to be the root of its own group
                    if (!isset($p['versionGroup'])) {
                        $this->updateProjectMetadata($p['id'], ['versionGroup' => $p['id']]);
                    }
                    break;
                }
            }
        }

        // Save project data
        $projectFile = $this->dataDir . '/project_' . $newId . '.json';
        file_put_contents($projectFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        // Update index with version info
        $newProjectMeta = [
            'id' => $newId,
            'name' => $projectName,
            'taskCount' => count($data['tasks'] ?? []),
            'createdAt' => date('c'),
            'versionGroup' => $versionGroup
        ];

        $projects = $this->listProjects(); // Reload in case updateProjectMetadata changed something
        $projects[] = $newProjectMeta;

        file_put_contents($this->indexFile, json_encode($projects, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return $newId;
    }

    private function updateProjectMetadata(int $id, array $updates): void
    {
        $projects = $this->listProjects();
        foreach ($projects as &$p) {
            if ($p['id'] === $id) {
                foreach ($updates as $k => $v) {
                    $p[$k] = $v;
                }
                break;
            }
        }
        file_put_contents($this->indexFile, json_encode($projects, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    /**
     * Delete a project by ID
     */
    public function deleteProject(int $id): bool
    {
        $projects = $this->listProjects();

        // Find and remove from index
        $found = false;
        $newProjects = [];
        foreach ($projects as $p) {
            if ($p['id'] === $id) {
                $found = true;
            } else {
                $newProjects[] = $p;
            }
        }

        if (!$found) {
            return false;
        }

        // Delete project file
        $projectFile = $this->dataDir . '/project_' . $id . '.json';
        if (file_exists($projectFile)) {
            unlink($projectFile);
        }

        // Update index
        file_put_contents($this->indexFile, json_encode($newProjects, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return true;
    }

    /**
     * Rename a project
     */
    public function renameProject(int $id, string $newName): bool
    {
        $projects = $this->listProjects();
        $updated = false;

        foreach ($projects as &$p) {
            if ($p['id'] === $id) {
                $p['name'] = $newName;
                $updated = true;
                break;
            }
        }

        if ($updated) {
            // Update index
            file_put_contents($this->indexFile, json_encode($projects, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            // Update project file content as well
            $projectFile = $this->dataDir . '/project_' . $id . '.json';
            if (file_exists($projectFile)) {
                $data = json_decode(file_get_contents($projectFile), true);
                if (isset($data['project'])) {
                    $data['project']['name'] = $newName;
                }
                // Also update root name/title if present
                if (isset($data['title'])) {
                    $data['title'] = $newName;
                }
                file_put_contents($projectFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            }
            return true;
        }
        return false;
    }

    /**
     * Duplicate a project
     * @param bool $asVersion If true, keeps the same versionGroup. If false, creates new group.
     */
    public function duplicateProject(int $sourceId, string $newName, bool $asVersion = false): ?int
    {
        $sourceData = $this->getProject($sourceId);
        if (!$sourceData) {
            return null;
        }

        // Update name in data
        if (isset($sourceData['project'])) {
            $sourceData['project']['name'] = $newName;
        }

        $versionOfId = null;
        if ($asVersion) {
            // If duplicating as version, we pass the source ID to inherit its group
            $versionOfId = $sourceId;
        }

        return $this->saveProject($sourceData, $newName, null, $versionOfId);
    }

    /**
     * Delete an entire group of projects
     */
    public function deleteProjectGroup($groupId): bool
    {
        $projects = $this->listProjects();
        $newProjects = [];
        $idsToDelete = [];

        foreach ($projects as $p) {
            $pGroup = $p['versionGroup'] ?? $p['id'];
            // Check loosely because groupId might verify against string/int
            if ((string)$pGroup === (string)$groupId) {
                $idsToDelete[] = $p['id'];
            } else {
                $newProjects[] = $p;
            }
        }

        if (empty($idsToDelete)) {
            return false;
        }

        // Delete files
        foreach ($idsToDelete as $id) {
            $projectFile = $this->dataDir . '/project_' . $id . '.json';
            if (file_exists($projectFile)) {
                unlink($projectFile);
            }
        }

        // Update index
        file_put_contents($this->indexFile, json_encode($newProjects, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return true;
    }
}
