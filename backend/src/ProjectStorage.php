<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

class ProjectStorage
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Database::getInstance()->getConnection();
    }

    /**
     * Get list of all saved projects (metadata only)
     */
    public function listProjects(): array
    {
        $stmt = $this->pdo->query("
            SELECT 
                p.id, 
                p.name, 
                p.created_at as \"createdAt\",
                (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as \"taskCount\",
                (p.settings->>'versionGroup')::int as \"versionGroup\"
            FROM projects p
            ORDER BY p.updated_at DESC
        ");
        return $stmt->fetchAll();
    }

    /**
     * Find project by name, returns ID if found or null
     */
    public function findByName(string $name): ?int
    {
        $stmt = $this->pdo->prepare("SELECT id FROM projects WHERE name = :name LIMIT 1");
        $stmt->execute(['name' => $name]);
        $id = $stmt->fetchColumn();
        return $id ? (int)$id : null;
    }

    /**
     * Get a specific project by ID
     */
    public function getProject(int $id): ?array
    {
        // 1. Get Project Info
        $stmt = $this->pdo->prepare("SELECT * FROM projects WHERE id = :id");
        $stmt->execute(['id' => $id]);
        $project = $stmt->fetch();

        if (!$project) {
            return null;
        }

        // 2. Get Tasks
        $stmt = $this->pdo->prepare("
            SELECT * FROM tasks 
            WHERE project_id = :id 
            ORDER BY uid ASC
        ");
        $stmt->execute(['id' => $id]);
        $tasks = $stmt->fetchAll();

        // 3. Get Dependencies
        $depStmt = $this->pdo->prepare("SELECT successor_uid, predecessor_uid, type, lag FROM dependencies WHERE project_id = :id");
        $depStmt->execute(['id' => $id]);
        $allDeps = $depStmt->fetchAll();

        // Map deps by successor
        $depsMap = [];
        foreach ($allDeps as $dep) {
            $depsMap[$dep['successor_uid']][] = $dep;
        }

        // 4. Get Resources
        $stmt = $this->pdo->prepare("SELECT * FROM resources WHERE project_id = :id");
        $stmt->execute(['id' => $id]);
        $rawResources = $stmt->fetchAll();
        $resources = array_map(function ($r) {
            return [
                'UID' => $r['uid'],
                'Name' => $r['name'],
                'Type' => $r['type']
            ];
        }, $rawResources);

        // 5. Construct final array structure compatible with frontend
        $settings = json_decode($project['settings'] ?? '{}', true);
        $availableColumns = $settings['availableColumns'] ?? [];

        return [
            'project' => [
                'id' => $project['id'],
                'name' => $project['name'],
                'startDate' => $project['start_date'],
                'finishDate' => $project['finish_date'],
            ],
            'availableColumns' => $availableColumns,
            'tasks' => array_map(function ($t) use ($depsMap) {
                // Decode extra_data
                $extraData = !empty($t['extra_data']) ? json_decode($t['extra_data'], true) : [];
                if (!is_array($extraData)) $extraData = [];

                // Dependencies
                $predecessorsRaw = $depsMap[$t['uid']] ?? [];
                $predecessorsUIDs = array_map(fn($d) => $d['predecessor_uid'], $predecessorsRaw);

                // Construct PredecessorLink structure compatible with Parser output
                $predecessorLinks = array_map(function ($d) {
                    return [
                        'PredecessorUID' => $d['predecessor_uid'],
                        'Type' => $d['type'],
                        'LinkLag' => $d['lag']
                    ];
                }, $predecessorsRaw);

                // RECALCULATE isMilestone at runtime (fix for existing projects):
                // Milestone = true if:
                // 1. DB says is_milestone = true, OR
                // 2. Start date == Finish date (comparing DATE portion only, ignoring time)
                $dbMilestone = (bool)$t['is_milestone'];
                $startDate = substr($t['start_date'] ?? '', 0, 10);
                $finishDate = substr($t['finish_date'] ?? '', 0, 10);
                $zeroDurationMilestone = ($startDate !== '' && $startDate === $finishDate);
                $isMilestone = $dbMilestone || $zeroDurationMilestone;

                // Map DB columns to MSPDI/Frontend expected keys
                $baseData = [
                    // Uppercase keys (MSPDI/XML standard)
                    'UID' => $t['uid'],
                    'ID' => $t['uid'],
                    'Name' => $t['name'],
                    'WBS' => $t['wbs'],
                    'OutlineNumber' => $t['wbs'],
                    'OutlineLevel' => $t['outline_level'],
                    'Start' => $t['start_date'],
                    'Finish' => $t['finish_date'],
                    'Duration' => $t['duration'],
                    'PercentComplete' => $t['percent_complete'],
                    'Summary' => $t['is_summary'] ? 1 : 0,
                    'Critical' => $extraData['Critical'] ?? 0, // Fallback to extra_data or 0
                    'Milestone' => $isMilestone ? 1 : 0,

                    // Frontend compatibility
                    'id' => $t['uid'],
                    'name' => $t['name'],
                    'wbs' => $t['wbs'],
                    'outlineLevel' => $t['outline_level'],
                    'start' => $t['start_date'],
                    'finish' => $t['finish_date'],
                    'duration' => $t['duration'],
                    'percentComplete' => $t['percent_complete'],
                    'isSummary' => $t['is_summary'],
                    'isMilestone' => $isMilestone,
                    'predecessors' => $predecessorsUIDs,
                    'PredecessorLink' => $predecessorLinks
                ];

                // Merge extraData so all original XML attributes are available
                // BaseData overrides extraData if keys collide (updated DB values take precedence)
                return array_merge($extraData, $baseData);
            }, $tasks),
            'resources' => $resources,
        ];
    }

    /**
     * Find projects with >90% similarity in task UIDs
     */
    public function findSimilarProjects(array $newTasks): array
    {
        // This is complex to do purely in SQL efficiently without storing task signatures.
        // For now, we'll implement a simplified version or fetch lightweight signatures.

        // 1. Get all project IDs and their task UIDs
        // Warning: This could be heavy. Better approach: Check only recent projects?

        // Simplified Logic: 
        // We will just return empty for now to speed up migration, 
        // OR implement a specific SQL query if strictly needed.
        // Let's implement a basic check against names or file hash if we had it.

        return [];
    }

    /**
     * Save a project and return its ID
     */
    public function saveProject(array $data, string $name = '', ?int $overwriteId = null, ?int $versionOfId = null): int
    {
        $projectName = $name ?: ($data['project']['name'] ?? 'Proyecto Sin Nombre');

        try {
            $this->pdo->beginTransaction();

            $projectId = null;

            // Prepare base settings with available columns
            $settings = ['versionGroup' => null];
            if (isset($data['availableColumns']) && is_array($data['availableColumns'])) {
                $settings['availableColumns'] = $data['availableColumns'];
            }

            if ($overwriteId) {
                // Update existing project
                // 1. Fetch current settings to preserve versionGroup
                $currStmt = $this->pdo->prepare("SELECT settings FROM projects WHERE id = :id");
                $currStmt->execute(['id' => $overwriteId]);
                $currentSettings = json_decode($currStmt->fetchColumn() ?: '{}', true);

                if (isset($currentSettings['versionGroup'])) {
                    $settings['versionGroup'] = $currentSettings['versionGroup'];
                }

                $stmt = $this->pdo->prepare("
                        UPDATE projects SET 
                            name = :name, 
                            start_date = :start, 
                            finish_date = :finish,
                            settings = :settings,
                            updated_at = NOW()
                        WHERE id = :id
                    ");
                $stmt->execute([
                    'name' => $projectName,
                    'start' => $data['project']['startDate'] ?? null,
                    'finish' => $data['project']['finishDate'] ?? null,
                    'settings' => json_encode($settings),
                    'id' => $overwriteId
                ]);
                $projectId = $overwriteId;

                // Delete old related data to replace it
                $this->pdo->prepare("DELETE FROM tasks WHERE project_id = :id")->execute(['id' => $projectId]);
                $this->pdo->prepare("DELETE FROM resources WHERE project_id = :id")->execute(['id' => $projectId]);
                $this->pdo->prepare("DELETE FROM assignments WHERE project_id = :id")->execute(['id' => $projectId]);
                $this->pdo->prepare("DELETE FROM dependencies WHERE project_id = :id")->execute(['id' => $projectId]);
            } else {
                // Insert new project
                $stmt = $this->pdo->prepare("
                        INSERT INTO projects (name, start_date, finish_date, settings) 
                        VALUES (:name, :start, :finish, :settings) 
                        RETURNING id
                    ");

                if ($versionOfId) {
                    // Logic to set versionGroup...
                    // 1. Get parent's group
                    $pStmt = $this->pdo->prepare("SELECT settings FROM projects WHERE id = :id");
                    $pStmt->execute(['id' => $versionOfId]);
                    $parentSettings = json_decode($pStmt->fetchColumn() ?: '{}', true);

                    $groupId = $parentSettings['versionGroup'] ?? $versionOfId;

                    // If parent didn't have group, set it now (update parent)
                    if (!isset($parentSettings['versionGroup'])) {
                        $parentSettings['versionGroup'] = $groupId;
                        $this->pdo->prepare("
                                UPDATE projects SET settings = :settings WHERE id = :id
                            ")->execute(['settings' => json_encode($parentSettings), 'id' => $versionOfId]);
                    }

                    $settings['versionGroup'] = $groupId;
                }

                $stmt->execute([
                    'name' => $projectName,
                    'start' => $data['project']['startDate'] ?? null,
                    'finish' => $data['project']['finishDate'] ?? null,
                    'settings' => json_encode($settings)
                ]);
                $projectId = $stmt->fetchColumn();
            }

            // Insert Tasks
            // Insert Tasks
            $taskStmt = $this->pdo->prepare("
                INSERT INTO tasks (
                    project_id, uid, wbs, name, start_date, finish_date, 
                    duration, percent_complete, outline_level, 
                    is_summary, is_milestone, extra_data
                ) VALUES (
                    :pid, :uid, :wbs, :name, :start, :finish,
                    :dur, :pct, :level, :summary, :milestone, :extra
                )
            ");

            // Prepare dependency statement
            $depStmt = $this->pdo->prepare("
                INSERT INTO dependencies (project_id, successor_uid, predecessor_uid, type, lag)
                VALUES (:pid, :succ, :pred, :type, :lag)
            ");

            foreach ($data['tasks'] as $task) {
                // Sanitization of date fields handling potential empty values
                $start = !empty($task['Start']) ? $task['Start'] : null;
                $finish = !empty($task['Finish']) ? $task['Finish'] : null;

                // Prepare extra_data (all fields that are not in the main columns)
                $knownKeys = ['UID', 'WBS', 'Name', 'Start', 'Finish', 'Duration', 'PercentComplete', 'OutlineLevel', 'Summary', 'Milestone'];
                $extraData = array_diff_key($task, array_flip($knownKeys));

                $taskStmt->execute([
                    'pid' => $projectId,
                    'uid' => $task['UID'],
                    'wbs' => $task['WBS'] ?? '',
                    'name' => $task['Name'] ?? 'Tarea sin nombre',
                    'start' => $start,
                    'finish' => $finish,
                    'dur' => $task['duration'] ?? $task['Duration'] ?? 0,
                    'pct' => $task['PercentComplete'] ?? 0,
                    'level' => $task['OutlineLevel'] ?? 1,
                    'summary' => ($task['Summary'] ?? 0) == 1 ? 'true' : 'false',
                    'milestone' => ($task['Milestone'] ?? 0) == 1 ? 'true' : 'false',
                    'extra' => json_encode($extraData)
                ]);

                // Handle Dependencies (PredecessorLink)
                if (isset($task['PredecessorLink'])) {
                    $preds = $task['PredecessorLink'];
                    // If it's a single object (assoc array) coming from XML parser, wrap in array
                    // Check if keys are numeric (list) or string (single object)
                    if (array_keys($preds) !== range(0, count($preds) - 1)) {
                        $preds = [$preds];
                    }

                    foreach ($preds as $pred) {
                        if (!isset($pred['PredecessorUID'])) continue;
                        $depStmt->execute([
                            'pid' => $projectId,
                            'succ' => $task['UID'],
                            'pred' => $pred['PredecessorUID'],
                            'type' => $pred['Type'] ?? 1,
                            'lag' => $pred['LinkLag'] ?? 0
                        ]);
                    }
                }
            }

            // Insert Resources (Simplified for brevity)
            if (!empty($data['resources'])) {
                $resStmt = $this->pdo->prepare("INSERT INTO resources (project_id, uid, name) VALUES (:pid, :uid, :name)");
                foreach ($data['resources'] as $res) {
                    $resStmt->execute([
                        'pid' => $projectId,
                        'uid' => $res['UID'] ?? $res['uid'] ?? 0,
                        'name' => $res['Name'] ?? $res['name'] ?? ''
                    ]);
                }
            }

            $this->pdo->commit();
            return (int)$projectId;
        } catch (Exception $e) {
            $this->pdo->rollBack();
            error_log("Error saving project: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Delete a project by ID
     */
    public function deleteProject(int $id): bool
    {
        $stmt = $this->pdo->prepare("DELETE FROM projects WHERE id = :id");
        return $stmt->execute(['id' => $id]);
    }

    /**
     * Rename a project
     */
    public function renameProject(int $id, string $newName): bool
    {
        $stmt = $this->pdo->prepare("UPDATE projects SET name = :name, updated_at = NOW() WHERE id = :id");
        return $stmt->execute(['name' => $newName, 'id' => $id]);
    }

    /**
     * Duplicate a project
     */
    public function duplicateProject(int $sourceId, string $newName, bool $asVersion = false): ?int
    {
        // Fetch source project data
        $sourceData = $this->getProject($sourceId);
        if (!$sourceData) return null;

        $versionOfId = $asVersion ? $sourceId : null;

        // Adjust name in the data array just in case
        $sourceData['project']['name'] = $newName;

        return $this->saveProject($sourceData, $newName, null, $versionOfId);
    }

    /**
     * Delete an entire group of projects
     */
    public function deleteProjectGroup($groupId): bool
    {
        // Delete all projects where settings->versionGroup == groupId
        // Note: This requires the JSONB operator '@>' or similar check
        // Or we can select IDs first.

        // Simple approach: SELECT ids -> DELETE
        $stmt = $this->pdo->prepare("
            SELECT id FROM projects 
            WHERE settings->>'versionGroup' = :groupId 
               OR (id = :groupIdInt AND settings->>'versionGroup' IS NULL)
        ");
        $stmt->execute(['groupId' => $groupId, 'groupIdInt' => (int)$groupId]);
        $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($ids)) return false;

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $delStmt = $this->pdo->prepare("DELETE FROM projects WHERE id IN ($placeholders)");
        return $delStmt->execute($ids);
    }
}
