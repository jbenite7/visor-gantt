document.addEventListener("DOMContentLoaded", () => {
  console.log("Visor MPP Inicializado");
  checkApiHealth();
  loadSavedProjects(); // Load saved projects on startup

  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () =>
    dropZone.classList.remove("dragover"),
  );
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

  // ==== Sidebar Logic ====
  const sidebar = document.getElementById("app-sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  const toggleBtnDesktop = document.getElementById("toggle-sidebar-desktop");
  const toggleBtnMobile = document.getElementById("toggle-sidebar-mobile");
  const closeBtn = document.getElementById("close-sidebar");

  function toggleSidebar(show) {
    if (show) {
      sidebar.classList.add("open");
      if (overlay) overlay.classList.add("active");
    } else {
      sidebar.classList.remove("open");
      if (overlay) overlay.classList.remove("active");
    }
  }

  if (toggleBtnDesktop) {
    toggleBtnDesktop.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
  }

  if (toggleBtnMobile) {
    toggleBtnMobile.addEventListener("click", () => {
      const isOpen = sidebar.classList.contains("open");
      toggleSidebar(!isOpen);
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      toggleSidebar(false);
    });
  }

  if (overlay) {
    overlay.addEventListener("click", () => {
      toggleSidebar(false);
    });
  }
});

// ==== Project Management ====
async function loadSavedProjects() {
  const container = document.getElementById("saved-projects");
  if (!container) return;

  try {
    const response = await fetch("api.php?action=projects");
    const result = await response.json();

    if (result.status === "success" && result.projects.length > 0) {
      container.innerHTML = "<h3>📁 Proyectos Guardados</h3>";
      const list = document.createElement("div");
      list.className = "project-list";

      // Group projects by versionGroup (or ID if no group)
      const groups = {};
      result.projects.forEach((p) => {
        const groupId = p.versionGroup || p.id;
        if (!groups[groupId]) groups[groupId] = [];
        groups[groupId].push(p);
      });

      // Sort groups by latest project date
      const sortedGroups = Object.values(groups).sort((a, b) => {
        const dateA = new Date(a[a.length - 1].createdAt);
        const dateB = new Date(b[b.length - 1].createdAt);
        return dateB - dateA;
      });

      list.innerHTML = sortedGroups
        .map((group) => {
          const isGroup = group.length > 1;

          if (isGroup) {
            // Sort versions in group (newest first)
            group.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const latest = group[0];

            return `
              <div class="project-group">
                <div class="project-card group-header">
                  <div class="group-toggle" onclick="toggleGroup(this, event)">▼</div>
                  <div class="project-info" onclick="loadProject(${latest.id})">
                    <strong>🗂 ${latest.name} (v${group.length})</strong>
                    <div class="project-meta">
                      <span>Última: ${formatDate(latest.createdAt)}</span> • 
                      <span>${latest.taskCount} tareas</span>
                    </div>
                  </div>
                  <div class="project-actions">
                      <button class="action-btn" title="Duplicar Última Versión" onclick="duplicateGroupLatest(${
                        latest.id
                      }, '${latest.name}', event)">📄</button>
                      <button class="delete-btn" title="Eliminar Grupo Completo" onclick="deleteProjectGroup('${
                        latest.versionGroup
                      }', ${group.length}, event)">💥</button>
                  </div>
                </div>
                <div class="group-items hidden">
                  ${group
                    .map(
                      (p) => `
                    <div class="project-card sub-card">
                      <div class="project-info" onclick="loadProject(${p.id})">
                        <strong>${p.name}</strong>
                        <div class="project-meta">
                            <span>${formatDate(p.createdAt)}</span> • 
                            <span>${p.taskCount} tareas</span>
                        </div>
                      </div>
                      <div class="project-actions">
                          <button class="action-btn" title="Renombrar" onclick="renameProject(${
                            p.id
                          }, '${p.name}', event)">✏️</button>
                          <button class="action-btn" title="Duplicar" onclick="duplicateProject(${
                            p.id
                          }, '${p.name}', event)">📄</button>
                          <button class="delete-btn" title="Eliminar" onclick="deleteProject(${
                            p.id
                          }, event)">🗑</button>
                      </div>
                    </div>
                  `,
                    )
                    .join("")}
                </div>
              </div>`;
          } else {
            // Single project
            const p = group[0];
            return `
              <div class="project-card">
                  <div class="project-info" onclick="loadProject(${p.id})">
                      <strong>${p.name}</strong>
                      <div class="project-meta">
                          <span>${formatDate(p.createdAt)}</span> • 
                          <span>${p.taskCount} tareas</span>
                      </div>
                  </div>
                  <div class="project-actions">
                      <button class="action-btn" title="Renombrar" onclick="renameProject(${
                        p.id
                      }, '${p.name}', event)">✏️</button>
                      <button class="action-btn" title="Duplicar/Versionar" onclick="duplicateProject(${
                        p.id
                      }, '${p.name}', event)">📄</button>
                      <button class="delete-btn" title="Eliminar" onclick="deleteProject(${
                        p.id
                      }, event)">🗑</button>
                  </div>
              </div>
            `;
          }
        })
        .join("");

      container.appendChild(list);
    } else {
      container.innerHTML =
        '<p class="no-projects">No hay proyectos guardados.</p>';
    }
  } catch (e) {
    console.error("Error loading projects:", e);
    container.innerHTML =
      '<p class="no-projects">Error al cargar proyectos</p>';
  }
}

function toggleGroup(toggleBtn, event) {
  if (event) event.stopPropagation();
  const header = toggleBtn.parentElement;
  const items = header.nextElementSibling;

  if (items) {
    if (items.classList.contains("hidden")) {
      items.classList.remove("hidden");
      toggleBtn.textContent = "▲";
    } else {
      items.classList.add("hidden");
      toggleBtn.textContent = "▼";
    }
  }
}

// ==== Actions Logic ====

function renameProject(id, currentName, event) {
  event.stopPropagation();
  const newName = prompt("Nuevo nombre:", currentName);
  if (newName && newName.trim() !== "" && newName !== currentName) {
    const formData = new FormData();
    formData.append("id", id);
    formData.append("name", newName);

    fetch("api.php?action=rename", { method: "POST", body: formData })
      .then((r) => r.json())
      .then((res) => {
        if (res.status === "success") {
          loadSavedProjects();
        } else {
          alert("Error: " + res.message);
        }
      })
      .catch(() => alert("Error de red"));
  }
}

function duplicateProject(id, currentName, event) {
  event.stopPropagation();
  showModal("Duplicar Proyecto", `¿Qué deseas hacer con '${currentName}'?`, [
    { label: "Cancelar", callback: null },
    {
      label: "Nueva Versión",
      class: "primary",
      callback: () => {
        performDuplicate(id, currentName, true);
      },
    },
    {
      label: "Copia Independiente",
      callback: () => {
        performDuplicate(id, currentName + " - Copia", false);
      },
    },
  ]);
}

function performDuplicate(id, defaultName, asVersion) {
  const newName = prompt(
    asVersion ? "Nombre de la versión:" : "Nombre de la copia:",
    defaultName,
  );
  if (newName && newName.trim() !== "") {
    const formData = new FormData();
    formData.append("id", id);
    formData.append("name", newName);
    formData.append("asVersion", asVersion);

    fetch("api.php?action=duplicate", { method: "POST", body: formData })
      .then((r) => r.json())
      .then((res) => {
        if (res.status === "success") {
          loadSavedProjects();
        } else {
          alert("Error: " + res.message);
        }
      })
      .catch(() => alert("Error de red"));
  }
}

// ==== Modal Helper ====
function showModal(title, message, actions) {
  const modal = document.getElementById("custom-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalMessage = document.getElementById("modal-message");
  const modalActions = document.getElementById("modal-actions");

  modalTitle.textContent = title;
  modalMessage.innerHTML = message.replace(/\n/g, "<br>");
  modalActions.innerHTML = "";

  actions.forEach((action) => {
    const btn = document.createElement("button");
    btn.textContent = action.label;
    btn.className = `modal-btn ${action.class || ""}`;
    btn.onclick = () => {
      closeModal();
      if (action.callback) action.callback();
    };
    modalActions.appendChild(btn);
  });

  modal.classList.remove("hidden");
}

function closeModal() {
  const modal = document.getElementById("custom-modal");
  modal.classList.add("hidden");
}

async function loadProject(id) {
  // Mobile: Close sidebar on selection
  const sidebar = document.getElementById("app-sidebar");
  if (window.innerWidth <= 1024 && sidebar) {
    sidebar.classList.remove("open");
  }

  const dropZone = document.getElementById("drop-zone");
  dropZone.innerHTML = `<div class="loader"></div><p>Cargando proyecto...</p>`;

  try {
    const response = await fetch(`api.php?action=project&id=${id}`);
    const result = await response.json();

    if (result.status === "success") {
      renderProject(result.data);
    } else {
      alert("Error: " + result.message);
      resetDropZone();
    }
  } catch (e) {
    console.error("Error loading project:", e);
    alert("Error al cargar el proyecto");
    resetDropZone();
  }
}

async function deleteProject(id, event) {
  event.stopPropagation(); // Don't trigger loadProject

  if (!confirm("¿Estás seguro de que deseas eliminar este proyecto?")) {
    return;
  }

  try {
    const response = await fetch(`api.php?action=delete&id=${id}`, {
      method: "POST",
    });
    const result = await response.json();

    if (result.status === "success") {
      loadSavedProjects(); // Refresh list
    } else {
      alert("Error: " + result.message);
    }
  } catch (e) {
    console.error("Error deleting project:", e);
    alert("Error al eliminar el proyecto");
  }
}

async function checkApiHealth() {
  const statusEl = document.getElementById("api-status");
  try {
    const response = await fetch("api.php?action=health");
    const data = await response.json();
    if (data.status === "ok") {
      statusEl.textContent = "API Conectada: " + data.message;
      statusEl.style.color = "#16a34a";
    } else {
      statusEl.textContent = "Error en API";
      statusEl.style.color = "#dc2626";
    }
  } catch (e) {
    statusEl.textContent = "Backend no disponible";
    statusEl.style.color = "#dc2626";
  }
}

async function handleFiles(files) {
  if (files.length === 0) return;
  const file = files[0];
  uploadFile(file);
}

async function uploadFile(
  file,
  overwriteId = null,
  versionOf = null,
  forceNew = false,
) {
  const dropZone = document.getElementById("drop-zone");
  dropZone.innerHTML = `<div class="loader"></div><p>Procesando <strong>${file.name}</strong>...</p>`;

  const formData = new FormData();
  formData.append("file", file);
  if (overwriteId) {
    formData.append("overwriteId", overwriteId);
  }
  if (versionOf) {
    formData.append("versionOf", versionOf);
  }
  if (forceNew) {
    formData.append("forceNew", "true");
  }

  try {
    const response = await fetch("api.php?action=upload", {
      method: "POST",
      body: formData,
    });
    const result = await response.json();

    if (result.status === "duplicate") {
      showModal("Archivo Duplicado", result.message, [
        { label: "Cancelar", callback: resetDropZone },
        {
          label: "Guardar como Nuevo",
          callback: () => uploadFile(file, null, null, true),
        },
        {
          label: "Sobrescribir",
          class: "danger",
          callback: () => uploadFile(file, result.existingId),
        },
      ]);
      return;
    }

    if (result.status === "suggest_version") {
      const candidates = result.candidates;
      let modalMessage = result.message;
      let selectedVersionOf = candidates[0].versionGroup || candidates[0].id;

      // Logic for multiple candidates
      if (candidates.length > 1) {
        modalMessage =
          "<p>Este archivo es similar a varios proyectos. Selecciona a cuál pertenece:</p>";
        modalMessage += `<select id="version-select" class="modal-select" style="width: 100%; padding: 8px; margin: 10px 0; border: 1px solid #ccc; border-radius: 4px;">
                    ${candidates
                      .map(
                        (c) =>
                          `<option value="${c.id}">${c.name} (${c.similarity}%)</option>`,
                      )
                      .join("")}
                </select>`;
      } else {
        selectedVersionOf = candidates[0].versionGroup || candidates[0].id;
      }

      showModal("Versión Detectada", modalMessage, [
        { label: "Cancelar", callback: resetDropZone },

        {
          label: "Guardar como Nuevo",
          callback: () => uploadFile(file, null, null, true),
        },
        {
          label: "Sobrescribir",
          class: "danger",
          callback: () => {
            // If select exists, get ID from it (value is versionGroup, we might need actual ID to overwrite?)
            // Wait, versionGroup is for versioning. To OVERWRITE, we need the specific project ID.
            // The dropdown currently puts values as versionGroup||id.
            // For overwrite, we likely want to overwrite the specific match found.
            // But if there are multiple matches, which one do we overwrite?
            // Let's assume we overwrite the SELECTED one.
            // IMPORTANT: The dropdown as implemented puts versionGroup as value.
            // We need to change the dropdown to perhaps allow storing the project ID too?
            // Or simpler: To overwrite, we probably mean "Overwrite the HEAD of this group" or "The specific matched file"?
            // Let's check candidates structure.
            // Candidates have: id, name, versionGroup.

            let targetId = candidates[0].id;
            const select = document.getElementById("version-select");
            if (select) {
              // We need to find the candidate that corresponds to the selected versionGroup?
              // Actually, if we are overwriting, we are replacing an existing ID.
              // The dropdown logic was built for "Grouping".
              // If the user wants to overwrite, they probably want to overwrite the project that was found.
              // If there are multiple, it's ambiguous.
              // Let's use the ID from the dropdown if we can change the dropdown value to be just ID?
              // But wait, "Versioning" needs group ID. "Overwriting" needs project ID.
              // Let's imply that if you select from dropdown, you are selecting the TARGET context.

              // PROPOSAL: Change dropdown values to be the PROJECT ID.
              // Then for Versioning: find the project, get its versionGroup.
              // For Overwrite: use the project ID.

              targetId = select.value; // Pending: update dropdown values to be IDs
            }

            uploadFile(file, targetId);
          },
        },
        {
          label: "Guardar como Versión",
          class: "primary",
          callback: () => {
            let targetGroup = candidates[0].versionGroup || candidates[0].id;
            const select = document.getElementById("version-select");
            if (select) {
              // If we change dropdown to ID, we need to look up the group again
              const selectedId = select.value;
              const selectedCandidate =
                candidates.find((c) => String(c.id) === String(selectedId)) ||
                candidates[0];
              targetGroup =
                selectedCandidate.versionGroup || selectedCandidate.id;
            }
            uploadFile(file, null, targetGroup);
          },
        },
      ]);
      return;
    }

    if (response.ok && result.status === "success") {
      renderProject(result.data);
      loadSavedProjects(); // Refresh list
    } else {
      showError(result);
    }
  } catch (error) {
    console.error(error);
    showError({ message: "Error de red o servidor" });
  }
}

function duplicateGroupLatest(id, name, event) {
  event.stopPropagation();
  // Directly duplicate as new version of the group
  // Or ask user? Requirement says "tome siempre la versión más actualizada".
  // Assuming this means "Copy Latest as Independent" or "Copy Latest as New Version"?
  // Let's assume standard behavior: Ask user but pre-select "Duplicate".
  // Actually, user said: "Que se pueda duplicar desde la vista de un proyecto agrupado, y tome siempre la versión más actualizada."
  // So we just trigger the normal duplicate flow for that ID.
  duplicateProject(id, name, event);
}

function deleteProjectGroup(groupId, count, event) {
  event.stopPropagation();
  if (
    !confirm(
      `¿Estás seguro de que deseas eliminar TODO el grupo de ${count} proyectos/versiones?`,
    )
  ) {
    return;
  }

  const formData = new FormData();
  formData.append("groupId", groupId);

  fetch("api.php?action=delete_group", { method: "POST", body: formData })
    .then((r) => r.json())
    .then((res) => {
      if (res.status === "success") {
        loadSavedProjects();
      } else {
        alert("Error: " + res.message);
      }
    })
    .catch(() => alert("Error de red"));
}

function showError(error) {
  resetDropZone();
  alert("Error: " + (error.message || "Error desconocido"));
}

function resetDropZone() {
  const dropZone = document.getElementById("drop-zone");
  dropZone.innerHTML = `
    <div class="icon-container">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
      </svg>
    </div>
    <h3>Arrastra tu archivo XML aquí</h3>
    <p>Formato: XML de Microsoft Project (MSPDI)</p>
    <input type="file" id="file-input" accept=".xml" hidden>
  `;
  const fileInput = document.getElementById("file-input");
  fileInput.onchange = (e) => handleFiles(e.target.files);
}

// ==== Global State ====
let currentProjectData = null;
let visibleColumns = null; // Will be loaded from localStorage or default
let activeColumnsOrder = null; // New state for column order

// Default columns to show
const DEFAULT_COLUMNS = [
  "UID", // Unique ID
  "WBS", // EDT
  "name", // Nombre
  "Summary", // Resumen
  "start", // Inicio
  "finish", // Fin
  "Critical", // Tareas Críticas
];

// Spanish translations for MS Project column names
const COLUMN_TRANSLATIONS = {
  // IDs
  id: "ID",
  UID: "UID",
  ID: "ID",
  // Names
  name: "Nombre",
  Name: "Nombre",
  // Dates
  start: "Inicio",
  Start: "Inicio",
  finish: "Fin",
  Finish: "Fin",
  CreateDate: "Fecha de creación",
  Resume: "Reanudar",
  // Duration
  duration: "Duración",
  Duration: "Duración",
  RemainingDuration: "Duración restante",
  ActualDuration: "Duración real",
  // Progress
  percentComplete: "% completado",
  PercentComplete: "% completado",
  PercentWorkComplete: "% trabajo completado",
  // Structure
  WBS: "EDT",
  wbs: "EDT",
  OutlineLevel: "Nivel de esquema",
  outlineLevel: "Nivel de esquema",
  OutlineNumber: "Número de esquema",
  // Type flags
  Summary: "Resumen",
  isSummary: "Es resumen",
  Milestone: "Hito",
  isMilestone: "Es hito",
  Critical: "Crítica",
  Active: "Activa",
  Manual: "Manual",
  // Work
  Work: "Trabajo",
  ActualWork: "Trabajo real",
  RemainingWork: "Trabajo restante",
  // Costs
  Cost: "Costo",
  ActualCost: "Costo real",
  FixedCost: "Costo fijo",
  // Resources
  ResourceUID: "UID de recurso",
  // Dependencies
  predecessors: "Predecesoras",
  successors: "Sucesoras",
  PredecessorLink: "Vínculo predecesor",
  // Constraints
  ConstraintType: "Tipo de restricción",
  ConstraintDate: "Fecha de restricción",
  // Priority
  Priority: "Prioridad",
  // Other common fields
  Type: "Tipo",
  IsNull: "Es nulo",
  CalendarUID: "UID de calendario",
  Recurring: "Periódica",
  OverAllocated: "Sobreasignada",
  Estimated: "Estimada",
  EffortDriven: "Condicionada por el esfuerzo",
  EarnedValueMethod: "Método de valor ganado",
  HideBar: "Ocultar barra",
  Rollup: "Resumen",
  LevelingDelay: "Retraso por redistribución",
  IgnoreResourceCalendar: "Ignorar calendario de recursos",
  Notes: "Notas",
  Hyperlink: "Hipervínculo",
  ExternalTask: "Tarea externa",
  IsSubproject: "Es subproyecto",
};

// Get translated column name
function translateColumn(colName) {
  return COLUMN_TRANSLATIONS[colName] || colName;
}

function getVisibleColumns() {
  if (visibleColumns) return visibleColumns;
  const stored = localStorage.getItem("mpp_visible_columns");
  if (stored) {
    visibleColumns = JSON.parse(stored);
  } else {
    visibleColumns = [...DEFAULT_COLUMNS];
  }
  return visibleColumns;
}

function saveVisibleColumns(cols) {
  visibleColumns = cols;
  localStorage.setItem("mpp_visible_columns", JSON.stringify(cols));
}

// ==== Render Project ====
function renderProject(data) {
  currentProjectData = data;
  const resultsSection = document.getElementById("results-section");
  const dropZone = document.getElementById("drop-zone");

  dropZone.closest(".upload-section").style.display = "none";
  resultsSection.classList.remove("hidden");

  // Calculate max outline level for level buttons
  const maxLevel = Math.max(
    ...data.tasks.map((t) => t.outlineLevel || t.OutlineLevel || 1),
  );

  // Inject buttons into main-top-bar
  const topBarActions = document.getElementById("top-bar-actions");
  topBarActions.innerHTML = `
    <button class="btn-back" onclick="location.reload()">← Subir otro</button>
    <div class="view-toggle">
      <button id="btn-table" class="toggle-btn active" onclick="showView('table')">Tabla</button>
      <button id="btn-mixed" class="toggle-btn" onclick="showView('mixed')">Tabla + Gantt</button>
      <button id="btn-gantt-only" class="toggle-btn" onclick="showView('gantt')">Gantt</button>
      <button id="btn-columns" class="toggle-btn" onclick="toggleColumnSelector()">⚙ Columnas</button>
      <button class="toggle-btn btn-export" onclick="exportToExcel()" title="Descargar como Excel">📥 Descargar</button>
    </div>
  `;

  resultsSection.innerHTML = `

    <!-- [BLUE] Compact Project Header -->
    <div class="project-header-compact">
      <h3>${data.project.name || "Proyecto"}</h3>
      <div class="project-meta-compact">
        <span><strong>Inicio:</strong> ${formatDate(data.project.startDate)}</span>
        <span class="meta-divider">|</span>
        <span><strong>Fin:</strong> ${formatDate(data.project.finishDate)}</span>
        <span class="meta-divider">|</span>
        <span><strong>Tareas:</strong> ${data.tasks.length}</span>
      </div>
    </div>
    
    <div id="column-selector" class="column-selector hidden"></div>
    
    <div id="level-selector" class="level-selector">
      <span class="level-label">Mostrar nivel:</span>
      ${Array.from({ length: maxLevel }, (_, i) => i + 1)
        .map(
          (level) =>
            `<button class="level-btn" onclick="expandToLevel(${level})">${level}</button>`,
        )
        .join("")}
      <button class="level-btn level-btn-all" onclick="expandAll()">Todo</button>
    </div>
    
    <div id="table-view" class="view-container"></div>
    <div id="gantt-view" class="view-container hidden">
      <div class="gantt-controls">
        <div class="control-group">
            <label for="cutoff-date" style="font-size: 0.8rem; margin-right: 0.5rem;">Fecha Corte:</label>
            <input type="date" id="cutoff-date" class="date-input" onchange="renderCutoffLine()">
        </div>

        <div class="gantt-zoom-group">
            <button class="zoom-btn" onclick="zoomGantt(1)" title="Acercar (Ctrl +)">＋</button>
            <button class="zoom-btn" onclick="zoomGantt(-1)" title="Alejar (Ctrl -)">－</button>
        </div>
        <button class="fullscreen-btn" onclick="toggleGanttFullscreen()">⛶ Pantalla Completa</button>
      </div>
      <div id="gantt-chart"></div>
    </div>
  `;

  renderColumnSelector(data.availableColumns || []);
  renderTable();
}

// Expand to a specific outline level (collapse everything below)
function expandToLevel(maxVisibleLevel) {
  const tasks = currentProjectData.tasks;
  collapsedTasks.clear();

  // Collapse all tasks that have children AND are at or above the target level
  tasks.forEach((task) => {
    const level = task.outlineLevel || task.OutlineLevel || 0;
    if (level >= maxVisibleLevel && hasChildren(task, tasks)) {
      collapsedTasks.add(task.id);
    }
  });

  renderTable();
}

// Expand all tasks
function expandAll() {
  collapsedTasks.clear();
  renderTable();
}

// ==== Column Selector ====
function renderColumnSelector(availableColumns) {
  const container = document.getElementById("column-selector");
  const visible = getVisibleColumns();

  // Initialize order if null
  if (!activeColumnsOrder) {
    // Combine available from XML with default known columns
    const allCols = [...new Set([...DEFAULT_COLUMNS, ...availableColumns])];
    // Prioritize visible ones, then others
    activeColumnsOrder = [
      ...visible,
      ...allCols.filter((c) => !visible.includes(c)),
    ];
  }

  // Ensure any new columns from this project are added to the end
  const currentSet = new Set(activeColumnsOrder);
  availableColumns.forEach((c) => {
    if (!currentSet.has(c)) activeColumnsOrder.push(c);
  });

  container.innerHTML = `
    <div id="sortable-columns" class="column-grid">
      ${activeColumnsOrder
        .map(
          (col) => `
        <label class="column-checkbox" data-id="${col}">
          <span class="drag-handle">⋮⋮</span>
          <input type="checkbox" value="${col}" ${
            visible.includes(col) ? "checked" : ""
          } onchange="onColumnToggle()">
          <span>${translateColumn(col)}</span>
        </label>
      `,
        )
        .join("")}
    </div>
    <div class="column-actions">
      <button onclick="selectAllColumns()">Seleccionar todo</button>
      <button onclick="selectDefaultColumns()">Restablecer</button>
      <button class="btn-export" onclick="exportToExcel()">📥 Descargar XLSX</button>
    </div>
  `;

  // Init Sortable
  const el = document.getElementById("sortable-columns");
  Sortable.create(el, {
    handle: ".drag-handle",
    ghostClass: "sortable-ghost",
    animation: 150,
    onEnd: function (evt) {
      // Update order array based on DOM
      const checks = el.querySelectorAll('input[type="checkbox"]');
      activeColumnsOrder = Array.from(checks).map((cb) => cb.value);
      // Refresh table with new order
      renderTable();
    },
  });
}

function exportToExcel() {
  if (!currentProjectData || !currentProjectData.tasks) return;

  const visible = getVisibleColumns();
  // Filter activeColumnsOrder to only show visible ones, maintaining order
  const orderedVisible = activeColumnsOrder.filter((c) => visible.includes(c));

  // Track which columns are dates for later formatting
  const dateColumns = [];

  // Prepare data - keep dates as Date objects for Excel
  const dataToExport = currentProjectData.tasks.map((task) => {
    const row = {};
    orderedVisible.forEach((col) => {
      let val = task[col];
      const translatedCol = translateColumn(col);

      // Handle dates - keep as Date objects for Excel native format
      if (
        col === "start" ||
        col === "Start" ||
        col === "finish" ||
        col === "Finish"
      ) {
        if (!dateColumns.includes(translatedCol)) {
          dateColumns.push(translatedCol);
        }
        if (val) {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            val = d; // Keep as Date object
          } else {
            val = null;
          }
        } else {
          val = null;
        }
      } else if (
        col === "Summary" ||
        col === "isSummary" ||
        col === "Critical" ||
        col === "Milestone" ||
        col === "isMilestone" ||
        col === "Active" ||
        col === "Manual" ||
        col === "Recurring" ||
        col === "EffortDriven" ||
        col === "Estimated" ||
        col === "OverAllocated"
      ) {
        // Format Booleans: 0/1, true/false -> Sí/No
        val = val == 1 || val === "true" || val === true ? "Sí" : "No";
      }
      row[translatedCol] = val;
    });
    return row;
  });

  // Create workbook with date detection
  const worksheet = XLSX.utils.json_to_sheet(dataToExport, { cellDates: true });

  // Get the range of the worksheet
  const range = XLSX.utils.decode_range(worksheet["!ref"]);

  // Find column indices for EDT and date columns
  const columnIndices = {};
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: C })];
    if (cell) {
      columnIndices[cell.v] = C;
    }
  }

  // Apply date format (dd/mm/yyyy) to date columns
  dateColumns.forEach((colName) => {
    const colIndex = columnIndices[colName];
    if (colIndex === undefined) return;

    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: colIndex });
      if (!worksheet[cellRef] || worksheet[cellRef].v === null) {
        // Set empty cells to "-"
        worksheet[cellRef] = { t: "s", v: "-" };
        continue;
      }
      // Apply date format
      worksheet[cellRef].t = "d"; // Date type
      worksheet[cellRef].z = "dd/mm/yyyy"; // Date format
    }
  });

  // Force WBS/EDT column to Text format
  const edtColIndex = columnIndices[translateColumn("WBS")];
  if (edtColIndex !== undefined) {
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: edtColIndex });
      if (!worksheet[cellRef]) continue;
      // Force string type
      worksheet[cellRef].t = "s";
      worksheet[cellRef].z = "@"; // Text format code
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Proyecto");

  const fileName = `${
    currentProjectData.project.name || "Proyecto"
  }_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

function toggleColumnSelector() {
  const selector = document.getElementById("column-selector");
  selector.classList.toggle("hidden");
}

function onColumnToggle() {
  const checkboxes = document.querySelectorAll(
    '#column-selector input[type="checkbox"]:checked',
  );
  const selected = Array.from(checkboxes).map((cb) => cb.value);
  saveVisibleColumns(selected);
  renderTable();

  // If Gantt is visible, re-render it to update columns
  const ganttView = document.getElementById("gantt-view");
  if (ganttView && !ganttView.classList.contains("hidden")) {
    renderGantt(currentProjectData.tasks);
  }
}

function selectAllColumns() {
  const checkboxes = document.querySelectorAll(
    '#column-selector input[type="checkbox"]',
  );
  checkboxes.forEach((cb) => (cb.checked = true));
  onColumnToggle();
}

function selectDefaultColumns() {
  const checkboxes = document.querySelectorAll(
    '#column-selector input[type="checkbox"]',
  );
  checkboxes.forEach((cb) => (cb.checked = DEFAULT_COLUMNS.includes(cb.value)));
  onColumnToggle();
}

// ==== Collapse State ====
let collapsedTasks = new Set(); // Set of task IDs that are collapsed

// Toggle collapse state for a summary task
function toggleCollapse(taskId) {
  if (collapsedTasks.has(taskId)) {
    collapsedTasks.delete(taskId);
  } else {
    collapsedTasks.add(taskId);
  }
  renderTable();
}

// Check if a task should be hidden (any parent is collapsed)
function isTaskHidden(task, allTasks) {
  const taskIndex = allTasks.findIndex((t) => t.id === task.id);
  const taskLevel = task.outlineLevel || task.OutlineLevel || 0;

  // Look backwards for parent tasks
  for (let i = taskIndex - 1; i >= 0; i--) {
    const potentialParent = allTasks[i];
    const parentLevel =
      potentialParent.outlineLevel || potentialParent.OutlineLevel || 0;

    if (parentLevel < taskLevel) {
      // This is a parent - check if it's collapsed
      if (collapsedTasks.has(potentialParent.id)) {
        return true;
      }
      // Continue checking for higher-level parents
      if (parentLevel === 0) break;
    }
  }
  return false;
}

// Check if a task has children
function hasChildren(task, allTasks) {
  const taskIndex = allTasks.findIndex((t) => t.id === task.id);
  const taskLevel = task.outlineLevel || task.OutlineLevel || 0;

  // Look forward for children
  for (let i = taskIndex + 1; i < allTasks.length; i++) {
    const next = allTasks[i];
    const nextLevel = next.outlineLevel || next.OutlineLevel || 0;

    if (nextLevel > taskLevel) {
      return true; // Found a child
    }
    if (nextLevel <= taskLevel) {
      return false; // Back to same or higher level
    }
  }
  return false;
}

// ==== Render Dynamic Table ====
function renderTable() {
  const container = document.getElementById("table-view");
  const visible = getVisibleColumns();

  // Use activeColumnsOrder if it exists, otherwise visible default
  let cols;
  if (activeColumnsOrder) {
    // Intersect active order with visible toggle
    cols = activeColumnsOrder.filter((c) => visible.includes(c));
  } else {
    cols = visible;
  }

  const tasks = currentProjectData.tasks;

  if (cols.length === 0) {
    container.innerHTML =
      '<p class="no-data">Selecciona al menos una columna.</p>';
    return;
  }

  // Filter visible tasks (not hidden by collapsed parents)
  const visibleTasks = tasks.filter((task) => !isTaskHidden(task, tasks));

  container.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            ${cols.map((col) => `<th>${translateColumn(col)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${visibleTasks
            .map(
              (task) => `
            <tr class="${task.isSummary ? "summary-row" : ""} ${
              task.isMilestone ? "milestone-row" : ""
            }" data-task-id="${task.id}">
              ${cols
                .map(
                  (col) =>
                    `<td>${formatCellValue(task[col], col, task, tasks)}</td>`,
                )
                .join("")}
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function formatCellValue(value, colName, task, allTasks) {
  if (value === undefined || value === null) return "-";

  // Special formatting for name column - add expand/collapse icons
  if (colName === "name" || colName === "Name") {
    const indent = (task.outlineLevel || task.OutlineLevel || 0) * 20;
    const prefix = task.isMilestone ? "◆ " : "";

    // Check if this task has children (needs toggle icon)
    const taskHasChildren = allTasks ? hasChildren(task, allTasks) : false;

    if (taskHasChildren) {
      const isCollapsed = collapsedTasks.has(task.id);
      const icon = isCollapsed ? "▶" : "▼";
      return `<span style="display: inline-block; text-align: left; padding-left: ${indent}px">
        <button class="collapse-btn" onclick="toggleCollapse(${task.id})">${icon}</button>
        ${prefix}${value}
      </span>`;
    }

    return `<span style="display: inline-block; text-align: left; padding-left: ${
      indent + 20
    }px">${prefix}${value}</span>`;
  }
  if (
    colName === "start" ||
    colName === "Start" ||
    colName === "finish" ||
    colName === "Finish"
  ) {
    return formatDate(value);
  }
  if (colName === "duration" || colName === "Duration") {
    return formatDuration(value);
  }
  if (colName === "percentComplete" || colName === "PercentComplete") {
    return value + "%";
  }
  if (colName === "predecessors") {
    // Hide for summary tasks
    if (task.isSummary) return "-";

    // Check if we have detailed links in PredecessorLink
    if (task.PredecessorLink && Array.isArray(task.PredecessorLink)) {
      return formatDependencyList(task.PredecessorLink);
    }
    // Fallback to simple array
    return Array.isArray(value) ? value.join(", ") : "-";
  }
  if (colName === "successors") {
    // Hide for summary tasks
    if (task.isSummary) return "-";

    // Value for successors is now array of objects {id, Type, LinkLag ...}
    // But check if it's array of objects or simple IDs (backwards compat)
    if (Array.isArray(value) && value.length > 0) {
      if (typeof value[0] === "object") {
        return formatDependencyList(value);
      }
      return value.join(", ");
    }
    return "-";
  }
  // Handle binary/boolean fields: 0/1, true/false -> Sí/No
  if (
    colName === "Summary" ||
    colName === "isSummary" ||
    colName === "Critical" ||
    colName === "Milestone" ||
    colName === "isMilestone" ||
    colName === "Active" ||
    colName === "Manual" ||
    colName === "Recurring" ||
    colName === "EffortDriven" ||
    colName === "Estimated" ||
    colName === "OverAllocated"
  ) {
    return value == 1 || value === "true" || value === true ? "Sí" : "No";
  }
  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }
  return value;
}

// ==== View Switching ====
// ==== View Switching ====
function showView(view) {
  const tableView = document.getElementById("table-view");
  const ganttView = document.getElementById("gantt-view");

  const btnTable = document.getElementById("btn-table");
  const btnMixed = document.getElementById("btn-mixed");
  const btnGantt = document.getElementById("btn-gantt-only");

  // Reset active classes
  if (btnTable) btnTable.classList.remove("active");
  if (btnMixed) btnMixed.classList.remove("active");
  if (btnGantt) btnGantt.classList.remove("active");

  if (view === "table") {
    // HTML Table View
    tableView.classList.remove("hidden");
    ganttView.classList.add("hidden");
    if (btnTable) btnTable.classList.add("active");
  } else if (view === "mixed") {
    // Table + Gantt (Standard DHTMLX)
    tableView.classList.add("hidden");
    ganttView.classList.remove("hidden");
    if (btnMixed) btnMixed.classList.add("active");

    // Enable Grid
    gantt.config.show_grid = true;
    renderGantt(currentProjectData.tasks);
  } else if (view === "gantt") {
    // Pure Gantt (No Grid)
    tableView.classList.add("hidden");
    ganttView.classList.remove("hidden");
    if (btnGantt) btnGantt.classList.add("active");

    // Disable Grid
    gantt.config.show_grid = false;
    renderGantt(currentProjectData.tasks);
  }
}

// ==== Render Gantt with Dependencies ====
function renderGantt(tasks) {
  const ganttContainer = document.getElementById("gantt-chart");
  ganttContainer.innerHTML = "";

  const validTasks = tasks.filter((t) => t.start && t.finish && t.name);

  if (validTasks.length === 0) {
    ganttContainer.innerHTML =
      '<p class="no-data">No hay tareas con fechas válidas.</p>';
    return;
  }

  // Transform to DHTMLX Format
  try {
    const dhtmlxTasks = validTasks.map((task) => {
      // Usar objetos Date directamente para mayor precisión en la visualización
      const startDate = new Date(task.start || task.Start);
      const endDate = new Date(task.finish || task.Finish);

      // Determine Type (Task, Project/Summary, Milestone)
      let type = "task";
      // Check for Summary flags (MS Project uses 'Summary'='1' or 'true')
      if (
        task.Summary === "1" ||
        task.Summary === true ||
        task.isSummary === true
      ) {
        type = "project";
      }
      // Check for Milestone flags OR Duration = 0
      const durationVal = parseFloat(task.duration || task.Duration || 0);
      if (
        task.Milestone === "1" ||
        task.Milestone === true ||
        task.isMilestone === true ||
        durationVal === 0
      ) {
        type = "milestone";
      }

      const isMilestone = type === "milestone";

      return {
        ...task, // Inherit all original properties for custom columns
        id: task.id || task.UID,
        text: task.name || task.Name,
        start_date: startDate,
        end_date: isMilestone ? startDate : endDate, // Snap finish to start for milestones
        type: type, // Set DHTMLX type
        progress: (task.percentComplete || task.PercentComplete || 0) / 100,
        parent: 0,
        original_duration: durationVal, // Store for display
        duration: isMilestone ? 0 : durationVal, // Force 0 for physics/arrows

        isCritical:
          String(task.isCritical) === "1" ||
          task.isCritical === true ||
          String(task.Critical) === "1" ||
          task.Critical === true,
        totalFloat: task.totalFloat,
        readonly: true,
      };
    });

    const dhtmlxLinks = [];
    validTasks.forEach((task) => {
      if (task.PredecessorLink && Array.isArray(task.PredecessorLink)) {
        task.PredecessorLink.forEach((link) => {
          dhtmlxLinks.push({
            id: task.id + "-" + link.PredecessorUID, // unique link id
            source: link.PredecessorUID,
            target: task.id,
            type: "0",
          });
        });
      }
    });

    const ganttData = {
      data: dhtmlxTasks,
      links: dhtmlxLinks,
    };

    // Initialize DHTMLX
    const container = document.getElementById("gantt-chart");
    container.innerHTML = ""; // Clear
    ganttContainer.style.opacity = 1; // Show

    // Config params (Apply BEFORE init/render)
    // Disable autofit to strictly honor column widths (prevent truncation)
    gantt.config.autofit = false;

    gantt.config.xml_date = "%Y-%m-%d %H:%i";
    gantt.config.readonly = true;
    gantt.config.duration_unit = "day";

    // Enforce Day View by default
    gantt.config.scale_unit = "day";
    gantt.config.date_scale = "%d %M";
    gantt.config.subscales = [];
    gantt.config.scale_height = 50;
    gantt.config.min_column_width = 50;

    // Dynamic Columns based on Visible Columns
    const visibleCols = getVisibleColumns();
    // Reorder based on activeColumnsOrder if available
    let orderedCols = visibleCols;
    if (activeColumnsOrder) {
      orderedCols = activeColumnsOrder.filter((c) => visibleCols.includes(c));
    }

    // Calculate Dynamic Width for "Name" column
    let maxNameLength = 20; // min base
    if (dhtmlxTasks && dhtmlxTasks.length > 0) {
      dhtmlxTasks.forEach((t) => {
        if (t.text && t.text.length > maxNameLength) {
          maxNameLength = t.text.length;
        }
      });
    }
    // Approx 8px per char + padding. Cap at 600px to overlap excessively long but allow reasonable read.
    const calculatedNameWidth = Math.min(Math.max(350, maxNameLength * 8), 600);

    gantt.config.columns = orderedCols.map((col) => {
      // Special mappings for DHTMLX reserved names
      if (col === "name" || col === "Name") {
        return {
          name: "text",
          label: translateColumn(col),
          tree: true,
          width: calculatedNameWidth, // Dynamic Width
          resize: true,
        };
      }
      if (col === "start" || col === "Start") {
        return {
          name: "start_date",
          label: translateColumn(col),
          align: "center",
          width: 120, // Increased from 90
        };
      }
      if (col === "finish" || col === "Finish") {
        return {
          name: "end_date",
          label: translateColumn(col),
          align: "center",
          width: 120, // Increased from 90
        };
      }
      if (col === "duration" || col === "Duration") {
        return {
          name: "duration",
          label: translateColumn(col),
          align: "center",
          width: 70,
          template: function (obj) {
            // Show original duration if available (preserve XML truth), else calculated
            const d =
              obj.original_duration !== undefined
                ? obj.original_duration
                : obj.duration;
            return Math.round(d * 10) / 10 + " días";
          },
        };
      }
      if (col === "percentComplete" || col === "PercentComplete") {
        return {
          name: "progress",
          label: "%",
          align: "center",
          width: 50,
          template: function (obj) {
            return Math.round((obj.progress || 0) * 100) + "%";
          },
        };
      }

      // Generic Columns
      return {
        name: col,
        label: translateColumn(col),
        align: "center",
        width: 80,
        resize: true,
        template: function (obj) {
          // Formatting for boolean/generic
          const val = obj[col];
          if (typeof val === "boolean" || val === "true" || val === "false") {
            return val === true || val === "true" ? "Sí" : "No";
          }
          return val !== undefined ? val : "-";
        },
      };
    });

    // Brand Language Styling (AIA)
    // Brand Language Styling (AIA)
    gantt.templates.task_class = function (start, end, task) {
      // Priority 1: Summary Tasks are ALWAYS Green (Corporate)
      // User Rule: "Actividad o hito resumen=Si, critica=Si: Verde Corporativo"
      if (
        task.type === "project" ||
        task.summary === true ||
        task.Summary === "1"
      ) {
        return "aia-summary"; // Green
      }

      // Priority 2: Critical Tasks are Red
      // User Rule: "Actividad o hito resumen=No, critica=Si: Roja"
      if (task.isCritical) {
        return "aia-critical"; // Red
      }

      // Priority 3: Standard Tasks / Milestones are Blue
      // User Rule: "Actividad o hito resumen=No, critica=No: Azul"
      if (task.type === "milestone") {
        return "aia-milestone"; // Blue (default style updated in CSS)
      }

      return "aia-task"; // Blue
    };

    // Label Positioning (Adaptive: inside if fits, right side if not)
    gantt.templates.rightside_text = function (start, end, task) {
      if (task.type === "milestone") return task.text;

      // Simple heuristic: 7px per character + some margin
      const columnWidth = gantt.config.min_column_width || 50;
      const barWidth = (task.duration || 1) * columnWidth;
      const estimatedTextWidth = task.text.length * 7;

      if (estimatedTextWidth > barWidth - 10) {
        return task.text;
      }
      return "";
    };

    // Alias for compatibility if needed elsewhere
    gantt.templates.right_side_text = gantt.templates.rightside_text;

    gantt.templates.task_text = function (start, end, task) {
      if (task.type === "milestone") return "";

      const columnWidth = gantt.config.min_column_width || 50;
      const barWidth = (task.duration || 1) * columnWidth;
      const estimatedTextWidth = task.text.length * 7;

      if (estimatedTextWidth <= barWidth - 10) {
        return task.text;
      }
      return "";
    };

    // Initialize
    gantt.init("gantt-chart");
    gantt.clearAll();
    gantt.parse(ganttData);
    gantt.render(); // Explicit render to fix layout/arrow shifts

    console.log("Renderizado DHTMLX completo");

    // Remove old Fix functions
    // setTimeout(() => { ... }, 300) removed.

    setupGanttEvents();
  } catch (e) {
    console.error("Error rendering Gantt:", e);
    ganttContainer.innerHTML =
      '<p class="error">Error al renderizar Gantt: ' + e.message + "</p>";
  }
}

// ==== Gantt Events: Zoom & Scroll ====
function setupGanttEvents() {
  const container = document.querySelector(".gantt-container");
  if (!container) return;

  // Cleanup old listeners if needed (not strictly necessary with fresh renders, but good practice)
  // Since we clear innerHTML of parent #gantt-chart, the container is new every time.

  let scrollLockAxis = null;
  let scrollLockTimeout = null;

  container.addEventListener(
    "wheel",
    function (e) {
      // 1. Zoom Logic (Ctrl or Cmd + Wheel)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const delta = e.deltaY > 0 ? -5 : 5; // Down = Zoom Out, Up = Zoom In
        const currentWidth = gantt.config.min_column_width || 50;
        let newWidth = currentWidth + delta;

        // Visual Limits
        if (newWidth < 10) newWidth = 10;
        if (newWidth > 200) newWidth = 200;

        if (newWidth !== currentWidth) {
          gantt.config.min_column_width = newWidth;
          gantt.render();
        }
        return;
      }

      // 2. Scroll Lock Logic (Diagonal Drift Prevention)
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      const threshold = 5;

      if (absX < threshold && absY < threshold) return;

      if (!scrollLockAxis) {
        scrollLockAxis = absY > absX ? "vertical" : "horizontal";
      }

      if (scrollLockAxis === "vertical" && absX > 0) {
        e.preventDefault();
        container.scrollTop += e.deltaY;
      } else if (scrollLockAxis === "horizontal" && absY > 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaX;
      }

      clearTimeout(scrollLockTimeout);
      scrollLockTimeout = setTimeout(() => {
        scrollLockAxis = null;
      }, 150);
    },
    { passive: false },
  );

  // 3. Keyboard Zoom Support (+ / -)
  window.addEventListener("keydown", function (e) {
    if (document.getElementById("gantt-view").classList.contains("hidden"))
      return;

    const isPlus =
      e.key === "+" || e.code === "Equal" || e.code === "NumpadAdd";
    const isMinus =
      e.key === "-" || e.code === "Minus" || e.code === "NumpadSubtract";

    if (e.ctrlKey || e.metaKey) {
      if (isPlus) {
        e.preventDefault();
        zoomGantt(1);
      } else if (isMinus) {
        e.preventDefault();
        zoomGantt(-1);
      }
    }
  });
}

function zoomGantt(direction) {
  const delta = direction > 0 ? 5 : -5;
  const currentWidth = gantt.config.min_column_width || 50;
  let newWidth = currentWidth + delta;

  // Visual Limits
  if (newWidth < 10) newWidth = 10;
  if (newWidth > 200) newWidth = 200;

  if (newWidth !== currentWidth) {
    gantt.config.min_column_width = newWidth;
    gantt.render();
  }
}

// ==== Utilities ====
function formatDependencyList(links) {
  if (!links || links.length === 0) return "-";

  return links
    .map((link) => {
      // Determine ID (PredecessorUID or id from successor object)
      const id = link.PredecessorUID || link.id;

      // Determine Type String
      // 1=FF (FF), 2=FS (FC), 3=SF (CF), 4=SS (CC)?
      // MSPDI Standard: 0=FF, 1=FS, 2=SF, 3=SS.
      // DHTMLX: 0=FS, 1=SS, 2=FF, 3=SF
      // Let's assume standard MSPDI since parsing comes from XML

      let typeStr = "";
      const type = parseInt(link.Type || 1);
      switch (type) {
        case 0:
          typeStr = "FF";
          break; // Fin-Fin
        case 1:
          typeStr = "FC";
          break; // Fin-Comienzo (Standard)
        case 2:
          typeStr = "CF";
          break; // Start-Finish
        case 3:
          typeStr = "CC";
          break; // Start-Start
        default:
          typeStr = "FC";
      }

      // If Type is FC (Standard), usually we don't show it?
      // User asked "Ver el tipo de dependencia", so show it.

      // Format Lag
      let lagStr = "";
      const lag = parseInt(link.LinkLag || 0);
      const format = parseInt(link.LagFormat || 7);

      if (lag !== 0) {
        const sign = lag > 0 ? "+" : "";

        // Check for Percentage Formats (19, 20, 39, 57, etc.)
        // 19=%, 20=e%, 39=%, 57=e%
        if ([19, 20, 39, 57].includes(format)) {
          lagStr = `${sign}${lag}%`;
        } else {
          // EVERYTHING else converts to Days (d)
          // Standard MSPDI: LinkLag is in tenths of minutes.
          // 1 day = 8 hours = 480 minutes = 4800 units.

          // Calculate days with 1 decimal precision, or 2 if very small
          let days = lag / 4800;

          // If it's effectively an integer (e.g. 1.0, 5.0), show integer
          // If it has decimals, show up to 2 decimals.
          // Avoid scientific notation for very small numbers, just round.

          const rounded = Math.round(days * 100) / 100;

          // SANITY CHECK: Filter out absurd values (e.g. > 10,000 days)
          // These usually indicate data corruption or "null date" artifacts in the XML.
          // User reported values like 35490d which are nonsensical.
          if (Math.abs(rounded) > 10000) {
            lagStr = ""; // Hide the lag, just show the Type
          } else {
            lagStr = `${sign}${rounded}d`;
          }
        }
      }

      return `${id}${typeStr}${lagStr}`;
    })
    .join(", ");
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();

    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function formatDuration(value) {
  // If it's a number (minutes) from backend
  if (typeof value === "number") {
    const days = Math.round((value / 1440) * 10) / 10; // 24h days (Calendar Time)
    return days + " días";
  }
  // Legacy string handling (PT8H...)
  if (!value) return "-";
  const durStr = String(value);

  const match = durStr.match(/PT(\d+)H/);
  if (match) {
    const hours = parseInt(match[1]);
    const days = Math.round((hours / 24) * 10) / 10; // 24h days
    return days + " días";
  }
  return durStr.replace("PT", "").toLowerCase();
}

// ==== Gantt Controls ====
function changePViewMode(mode) {
  if (!gantt) return;

  // Map "Day", "Week", "Month" to DHTMLX scales
  if (mode === "Day") {
    gantt.config.scale_unit = "day";
    gantt.config.date_scale = "%d %M";
    gantt.config.subscales = [];
    gantt.config.scale_height = 50;
    // Adjust column width to make days readable
    gantt.config.min_column_width = 50;
  } else if (mode === "Week") {
    gantt.config.scale_unit = "week";
    gantt.config.date_scale = "Semana %W";
    gantt.config.step = 1;
    gantt.config.subscales = [{ unit: "day", step: 1, date: "%D %d" }];
    gantt.config.scale_height = 50;
    gantt.config.min_column_width = 40;
  } else if (mode === "Month") {
    gantt.config.scale_unit = "month";
    gantt.config.date_scale = "%F %Y";
    gantt.config.subscales = [{ unit: "week", step: 1, date: "Sem %W" }];
    gantt.config.scale_height = 50;
    gantt.config.min_column_width = 80;
  }

  gantt.render();

  // Update active button state
  document.querySelectorAll(".zoom-btn").forEach((btn) => {
    btn.classList.remove("active");
    const btnText = btn.textContent.trim();
    const modeMap = {
      Day: "Día",
      Week: "Semana",
      Month: "Mes",
    };

    if (btnText.includes(modeMap[mode])) {
      btn.classList.add("active");
    }
  });
}

function toggleGanttFullscreen() {
  const container = document.getElementById("gantt-view"); // This is the wrapper
  const btn = document.querySelector(".fullscreen-btn");

  if (!container.classList.contains("fullscreen-mode")) {
    container.classList.add("fullscreen-mode");
    if (btn) btn.textContent = "✕ Salir";

    // DHTMLX needs explicit resize call when container changes
    setTimeout(() => {
      gantt.setSizes();
      gantt.render();
    }, 100);
  } else {
    container.classList.remove("fullscreen-mode");
    if (btn) btn.textContent = "⛶ Pantalla Completa";

    setTimeout(() => {
      gantt.setSizes();
      gantt.render();
    }, 100);
  }
}

// ==== Cutoff Line Logic ====
function renderCutoffLine() {
  if (!window.ganttInstance) return;

  const dateInput = document.getElementById("cutoff-date");
  if (!dateInput || !dateInput.value) return;

  const cutoffDate = new Date(dateInput.value);
  const gantt = window.ganttInstance;

  // Find SVG container
  const svg = document.querySelector("#gantt-chart svg");
  if (!svg) return;

  // Remove existing line
  const existing = svg.querySelector(".cutoff-line-group");
  if (existing) existing.remove();

  // Calculate X position
  // Frappe Gantt stores column width and start date internally
  // We can infer X by using the built-in helper if available, or manual calc
  // gantt.gantt_start is the start date of the chart

  if (!gantt.gantt_start) return;

  const diff = cutoffDate - gantt.gantt_start;
  const diffHours = diff / (1000 * 60 * 60);

  // Column width depends on view mode.
  // Day: step 24, padding etc.
  // Simplified: Use the 'x' of a dummy task or internal props?
  // Proper way:
  let x = 0;

  // Frappe Gantt internal logic (reverse engineered basics)
  // It maps date to x.
  // We can try to rely on the date mapping of the chart if exposed,
  // or calculate manually:
  // x = (date - start) / step * column_width

  // Let's rely on mapping a known task date vs x? No, unreliable.
  // Let's look at options.step and options.column_width

  const step = gantt.options.step;
  const columnWidth = gantt.options.column_width;

  // Calculate X
  // View Mode factors:
  // Day: step = 24 (1 day = 24h)
  // Week: step = 24 * 7 ?? No, usually 'Week' view implies specific drawing.

  // Actually, Frappe Gantt creates ".grid-row" or ".grid-header".
  // Let's try to calculate relative to gantt_start.

  // Standard Frappe Calc:
  // Day: X per hour? Or X per day?
  // Usually: (date - gantt_start) / (1000*60*60*24) * column_width
  // But view_mode influences scale.

  // Let's try a simpler strategy:
  // In 'Day' view, column_width is per Day usually (or simplified).
  // In 'Week', column_width is per Week? Or per Day restricted?
  // Let's iterate tasks to find one close to date? No.

  // Let's use pure math based on typical Frappe config.
  // NOTE: Frappe Gantt 1.0.4 logic
  let scale = 24; // Hours per step
  if (gantt.options.view_mode === "Day") scale = 24; // column_width per day?
  // Actually in Frappe:
  // Day -> step 24, column_width 38
  // Week -> step 24*7, column_width 140
  // Month -> step 24*30, column_width 120

  // Wait, let's try to find the 'today' line and move it?
  // The 'today' line is a path with class 'today-highlight'.
  // If we can control 'today' date passed to Gantt, we win.
  // But we initialized it already.

  // PLAN B: Manual Draw with calibration
  // We will calculate Offset Days from gantt_start
  const daysFromStart = diffHours / 24;

  // Width per day - Use correct calendar calculation for Month view
  if (gantt.options.view_mode === "Month") {
    // Use calendar-accurate calculation for Month view
    x = getXForDateInMonthView(
      cutoffDate,
      gantt.gantt_start,
      gantt.options.column_width,
    );
  } else {
    let widthPerDay = 0;
    if (gantt.options.view_mode === "Day") {
      widthPerDay = gantt.options.column_width;
    } else if (gantt.options.view_mode === "Week") {
      widthPerDay = gantt.options.column_width / 7;
    }
    x = daysFromStart * widthPerDay;
  }

  // Adjust for padding usually in Frappe GS
  // Side padding is commonly applied to grid
  // But SVG 0,0 usually aligns with gantt_start in the grid area.

  // ==== Custom Tooltip Logic (Bypassing Library) ====
  // We manually attach hover events to the SVGs because the library ignores custom template
  function bindTooltipHover() {
    const bars = document.querySelectorAll(
      "#gantt-chart .bar-wrapper, #gantt-chart .bar-group",
    );

    bars.forEach((bar) => {
      // Clean previous listeners if any (simple approach: clone node or just add new ones)
      // Adding duplicates usually fine if logic is idempotent, but better to be safe
      // Since we re-render chart often, elements are normally new.

      bar.addEventListener("mouseenter", (e) => {
        const taskId = bar.getAttribute("data-id");
        if (taskId) {
          showCustomPopup(taskId, e);
        }
      });

      bar.addEventListener("mouseleave", () => {
        hideCustomPopup();
      });

      // Also track mouse move to follow cursor?
      // Frappe gantt usually follows cursor.
      bar.addEventListener("mousemove", (e) => {
        updatePopupPosition(e);
      });
    });
  }

  let customPopupEl = null;

  function showCustomPopup(taskId, event) {
    // 1. Get Data
    const task = window.ganttTaskCache[taskId];
    if (!task) return;

    // 2. Build HTML (Reusing the logic we wrote before)
    const durationText = task._duration_text || "-";
    const isCritical = task._is_critical || false;
    const predecessorsList = task._predecessors_list || "";

    // Theoretical Logic
    const dateInput = document.getElementById("cutoff-date");
    let theoretical = 0;
    let diffText = "";
    let theoreticalHtml = "";

    if (dateInput && dateInput.value) {
      const cutoff = new Date(dateInput.value);
      const start = new Date(task.start);
      const end = new Date(task.end);

      if (cutoff < start) {
        theoretical = 0;
      } else if (cutoff >= end) {
        theoretical = 100;
      } else {
        const totalDuration = end - start;
        const elapsed = cutoff - start;
        if (totalDuration > 0) {
          theoretical = Math.round((elapsed / totalDuration) * 100);
        }
      }

      // Calculate Difference
      const actual = parseFloat(task.progress);
      const diff = actual - theoretical;
      const diffColor = diff >= 0 ? "green" : "red";
      diffText = `<span>Desv: <strong style="color: ${diffColor}">${diff > 0 ? "+" : ""}${diff}%</strong></span>`;
      if (theoretical > 0) {
        theoreticalHtml = `<div class="popup-row theoretical"><small>Teórico: ${theoretical}%</small></div>`;
      }
    }

    const html = `
    <div class="popup-header">
        <h4>${task.name}</h4>
        ${isCritical ? '<span class="badge-critical">🔴 Crítica</span>' : ""}
    </div>
    <div class="popup-body">
        <div class="popup-row">
            <span>📅 ${formatDate(task.start)} - ${formatDate(task.end)}</span>
            <span class="popup-duration">(${durationText})</span>
        </div>
        ${predecessorsList ? `<div class="popup-row dependencies">🔗 Pre: ${predecessorsList}</div>` : ""}
        
        <div class="popup-progress-section">
            <div class="popup-row" style="justify-content: space-between; margin-bottom: 2px;">
                <span>Progreso: <strong>${task.progress}%</strong></span>
                ${diffText}
            </div>
            <div class="popup-progress-bar">
                <div class="popup-progress-fill" style="width: ${task.progress}%"></div>
            </div>
            ${theoreticalHtml}
        </div>
    </div>
  `;

    // 3. Create or Update Element
    if (!customPopupEl) {
      customPopupEl = document.createElement("div");
      customPopupEl.className = "gantt-popup";
      document.body.appendChild(customPopupEl);
    }

    customPopupEl.innerHTML = html;
    customPopupEl.style.display = "block";

    // 4. Position
    updatePopupPosition(event);
  }

  function hideCustomPopup() {
    if (customPopupEl) {
      customPopupEl.style.display = "none";
    }
  }

  function updatePopupPosition(e) {
    if (!customPopupEl) return;

    const width = 260; // From CSS
    const offset = 15;

    let left = e.pageX + offset;
    let top = e.pageY + offset;

    // Boundary check
    if (left + width > window.innerWidth) {
      left = e.pageX - width - offset;
    }

    // Bottom check (simple)
    if (top + 150 > window.innerHeight + window.scrollY) {
      top = e.pageY - 150;
    }

    customPopupEl.style.left = `${left}px`;
    customPopupEl.style.top = `${top}px`;
  }
  const height = svg.getAttribute("height");

  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.classList.add("cutoff-line-group");

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x);
  line.setAttribute("y1", 0);
  line.setAttribute("x2", x);
  line.setAttribute("y2", height);
  line.classList.add("cutoff-line");

  g.appendChild(line);
  svg.appendChild(g);
}

// ==== Milestone Diamond Fix (Deep Analysis) ====
// Frappe Gantt renders bars as Rects. Rotating a non-square rect looks like a tilted bar.
// We must force milestones to be perfect squares and re-center them.
function fixMilestoneShapes() {
  // 1. Find all milestone bars
  const milestones = document.querySelectorAll(
    ".bar-milestone .bar, .bar-critical-milestone .bar",
  );

  milestones.forEach((rect) => {
    // 2. Get current geometry
    const x = parseFloat(rect.getAttribute("x"));
    const y = parseFloat(rect.getAttribute("y"));
    const width = parseFloat(rect.getAttribute("width"));
    const height = parseFloat(rect.getAttribute("height"));

    // 3. Define diamond size (e.g., 16px)
    // Reduced from 18 to 16 to ensure rotation fits comfortably in 38px row
    const size = 16;

    // 4. Calculate center of original bar
    const cx = x + width / 2;
    const cy = y + height / 2;

    // 5. New coordinates to center the square
    const newX = cx - size / 2;
    const newY = cy - size / 2;

    // 6. Apply new attributes
    rect.setAttribute("width", size);
    rect.setAttribute("height", size);
    rect.setAttribute("x", newX);
    rect.setAttribute("y", newY);
    rect.setAttribute("rx", "0");
    rect.setAttribute("ry", "0");
    rect.style.transformBox = "fill-box";
    rect.style.transformOrigin = "center";
    rect.style.transform = "rotate(45deg)";

    // Mark as fixed
    rect.setAttribute("data-diamond-fixed", "true");

    // The CSS rule '.bar-milestone .bar { transform: rotate(45deg); transform-origin: center; }'
    // handles the rotation. The JS just ensures it's a square centered on the correct spot.
  });
}

// ==== Enable Hover Tooltips (Custom Implementation) ====
function bindTooltipHover() {
  const gantt = window.ganttInstance;
  if (!gantt) return;

  const bars = document.querySelectorAll(".bar-group");
  bars.forEach((bar) => {
    // Find task ID usually stored in data attribute or derive from index
    // Frappe usually stores task info bound to the element or reachable via ID
    // Simplified: use the bar-group click handler logic if possible, OR
    // Use the index from the list if they are in order (risky).

    // Better: Frappe attaches the task object to the bar element in some versions.
    // If not, we can rely on the fact that `gantt.tasks` matches the DOM order usually.
    // Or look for `data-id` on `.task-bar`.

    const taskBar = bar.querySelector(".bar, .progress-bar, .test");
    // We can just trigger the existing click handler? No, that might toggle/lock.

    bar.addEventListener("mouseover", (e) => {
      // Find the task based on the index or data-id
      // Let's rely on Frappe's internal method if accessible,
      // OR find the closest .bar-wrapper data-id.
      const wrapper = bar.closest(".bar-wrapper");
      const taskId = wrapper ? wrapper.getAttribute("data-id") : null;
      if (taskId) {
        // CRITICAL: show_popup expects the BAR object, not the TASK object!
        const barObj = gantt.get_bar(taskId);
        if (barObj) {
          // Cancel any pending hide
          if (window._popupHideTimeout) {
            clearTimeout(window._popupHideTimeout);
            window._popupHideTimeout = null;
          }
          gantt.show_popup(barObj);
        }
      }
    });

    // Hide popup when mouse leaves the bar (with delay to allow popup hover)
    bar.addEventListener("mouseleave", () => {
      window._popupHideTimeout = setTimeout(() => {
        gantt.hide_popup();
      }, 150); // Small delay to allow cursor to reach popup
    });
  });

  // Also keep popup open if hovering over the popup itself
  const popupWrapper = document.querySelector(".popup-wrapper");
  if (popupWrapper) {
    popupWrapper.addEventListener("mouseenter", () => {
      if (window._popupHideTimeout) {
        clearTimeout(window._popupHideTimeout);
        window._popupHideTimeout = null;
      }
    });
    popupWrapper.addEventListener("mouseleave", () => {
      gantt.hide_popup();
    });
  }
}

// Initial Listener to set date input default
document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0"); // Months start at 0!
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const dateInput = document.getElementById("cutoff-date");
  if (dateInput) {
    // dateInput.value = todayStr; // Disable default today
    dateInput.addEventListener("change", renderCutoffLine);
  }
});

// ==== Helper: Cross-Browser Date Parsing ====
function parseSafeDate(dateStr) {
  if (!dateStr) return new Date(); // Fallback
  // Handle "YYYY-MM-DD HH:mm:ss" (common in SQL/MPP exports)
  // Edge/Safari fail on space separator, Chrome accepts it.
  if (typeof dateStr === "string" && dateStr.includes(" ")) {
    dateStr = dateStr.replace(" ", "T");
  }
  return new Date(dateStr);
}

// ==== Fix Gantt Date Range (Universal Alignment) ====
// DISABLED: This function was causing bars to render at incorrect dates
// by forcefully overriding gantt_start/gantt_end.
// Frappe Gantt handles date calculation correctly on its own.
function fixGanttDateRange() {
  // DISABLED - Let Frappe Gantt calculate dates naturally
  return;

  /* ORIGINAL CODE COMMENTED OUT:
  const gantt = window.ganttInstance;
  if (!gantt || !gantt.tasks || gantt.tasks.length === 0) return;

  // Find actual min/max task dates
  let minDate = null;
  let maxDate = null;

  gantt.tasks.forEach((task) => {
    const start = task._start || parseSafeDate(task.start);
    const end = task._end || parseSafeDate(task.end);

    if (!minDate || start < minDate) minDate = start;
    if (!maxDate || end > maxDate) maxDate = end;
  });

  if (!minDate || !maxDate) return;

  // Add padding: Start from 1 month before min task, aligned to 1st
  const paddedStart = new Date(minDate);
  paddedStart.setMonth(paddedStart.getMonth() - 1);
  paddedStart.setDate(1);
  paddedStart.setHours(0, 0, 0, 0);

  const paddedEnd = new Date(maxDate);
  paddedEnd.setMonth(paddedEnd.getMonth() + 2);
  paddedEnd.setDate(0);

  // Compare with current start
  const currentStart = gantt.gantt_start;
  const diffTime = Math.abs(currentStart.getTime() - paddedStart.getTime());
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  // We enforce this if the difference is significant (> 2 days)
  // This ensures we don't re-render if it's already aligned.
  if (diffDays > 2) {
    console.log(
      `[fixGanttDateRange] Aligning chart start to: ${paddedStart.toISOString()}`,
    );
    gantt.gantt_start = paddedStart;
    gantt.gantt_end = paddedEnd;

    try {
      // Trigger Single Render
      gantt.render();
    } catch (err) {
      console.error("[fixGanttDateRange] Render failed:", err);
      return;
    }

    // Re-schedule post-render fixes
    // We do this immediately after render trigger
    setTimeout(() => {
      if (gantt.options.view_mode === "Month") {
        fixMonthViewBarPositions();
      } else {
        fixDependencyArrows();
      }
      bindTooltipHover();
    }, 100);
  }
  */
}

// ==== Helper: Calculate X Position for Month View (Uses Real Calendar Days) ====
// This function calculates accurate X positions for Month view by using
// actual days in each month instead of Frappe's fixed 30-day assumption.
function getXForDateInMonthView(targetDate, ganttStart, columnWidth) {
  if (!targetDate || isNaN(targetDate.getTime())) return 0;
  if (!ganttStart || isNaN(ganttStart.getTime())) return 0;

  // Calculate months difference
  let monthsDiff =
    (targetDate.getFullYear() - ganttStart.getFullYear()) * 12 +
    (targetDate.getMonth() - ganttStart.getMonth());

  // Calculate fraction within the target month
  const daysInTargetMonth = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth() + 1,
    0,
  ).getDate();

  const dayOfMonth = targetDate.getDate() - 1; // 0-indexed day within month
  const fractionOfMonth = dayOfMonth / daysInTargetMonth;

  // Handle first month offset (if gantt_start is not on the 1st)
  let firstMonthOffset = 0;
  if (ganttStart.getDate() > 1) {
    const daysInGanttStartMonth = new Date(
      ganttStart.getFullYear(),
      ganttStart.getMonth() + 1,
      0,
    ).getDate();
    firstMonthOffset = (ganttStart.getDate() - 1) / daysInGanttStartMonth;
  }

  // Total X = (complete_months * column_width) + (fraction * column_width) - first_month_offset
  const x = (monthsDiff + fractionOfMonth - firstMonthOffset) * columnWidth;

  return Math.max(0, x);
}

// ==== Fix Month View Bar Positions (Critical Bug Fix) ====
// Frappe Gantt calculates X positions using 30 fixed days per month,
// but months have 28-31 days. This causes progressive misalignment.
// This function recalculates bar X and width using actual calendar days.
function fixMonthViewBarPositions() {
  const gantt = window.ganttInstance;
  if (!gantt || gantt.options.view_mode !== "Month") return;

  const columnWidth = gantt.options.column_width || 120;
  const ganttStart = gantt.gantt_start;

  if (!ganttStart || isNaN(ganttStart.getTime())) return;

  // Use global helper for X position calculation
  const getXPositionForDate = (date) =>
    getXForDateInMonthView(date, ganttStart, columnWidth);

  // Initialize/Reset the global position map
  window._monthViewBarPositions = {};

  // Process all bar wrappers
  const barWrappers = document.querySelectorAll(
    "#gantt-chart .bar-wrapper[data-id]",
  );

  barWrappers.forEach((wrapper) => {
    const taskId = wrapper.getAttribute("data-id");
    const task = gantt.tasks.find((t) => String(t.id) === taskId);
    if (!task) return;

    const bar = wrapper.querySelector(".bar");
    const progressBar = wrapper.querySelector(".bar-progress");
    if (!bar) return;

    // Get task dates
    const taskStart = task._start || parseSafeDate(task.start);
    const taskEnd = task._end || parseSafeDate(task.end);

    if (!taskStart || !taskEnd || isNaN(taskStart.getTime())) return;

    // Calculate correct positions
    const newX = getXPositionForDate(taskStart);
    const endX = getXPositionForDate(taskEnd);
    const newWidth = Math.max(5, endX - newX); // Minimum 5px width

    // Apply corrections
    bar.setAttribute("x", newX);
    bar.setAttribute("width", newWidth);

    // Update progress bar position
    if (progressBar) {
      progressBar.setAttribute("x", newX);
      const progress = task.progress || 0;
      progressBar.setAttribute("width", (newWidth * progress) / 100);
    }

    // Update handles if present
    const leftHandle = wrapper.querySelector(".handle.left");
    const rightHandle = wrapper.querySelector(".handle.right");
    if (leftHandle) {
      leftHandle.setAttribute("x", newX - 1.5);
    }
    if (rightHandle) {
      rightHandle.setAttribute("x", newX + newWidth - 1.5);
    }

    // Update progress handle
    const progressHandle = wrapper.querySelector(".handle.progress");
    if (progressHandle && progressBar) {
      const progressWidth = parseFloat(progressBar.getAttribute("width")) || 0;
      progressHandle.setAttribute("cx", newX + progressWidth);
    }

    // Update label position (using improved logic)
    const label = wrapper.querySelector(".bar-label");
    if (label) {
      fixSingleLabel(label, newX, newWidth);
    }

    // Store corrected positions for arrow recalculation
    window._monthViewBarPositions[taskId] = {
      x: newX,
      width: newWidth,
      endX: newX + newWidth,
      y: parseFloat(bar.getAttribute("y")) || 0,
      height: parseFloat(bar.getAttribute("height")) || 20,
    };
  });

  // Fix dependency arrows
  fixDependencyArrows();

  console.log(
    "[fixMonthViewBarPositions] Corrected bar positions, labels, and arrows for Month view",
  );
}

// ==== General Label Operations ====

// Helper to fix a single label based on position X and Width
function fixSingleLabel(label, x, width) {
  const labelText = label.textContent || "";
  // Estimate text width: ~7px per character average
  const estimatedTextWidth = labelText.length * 7;
  const padding = 12; // 6px on each side

  // Label fits inside if bar is wide enough for text + padding
  const fitsInside = width > estimatedTextWidth + padding;

  if (fitsInside) {
    // Position inside: at start of bar + small padding
    label.setAttribute("x", x + 5);
    label.classList.add("big");
    label.classList.remove("small");
  } else {
    // Position outside: after end of bar
    label.setAttribute("x", x + width + 5);
    label.classList.add("small");
    label.classList.remove("big");
  }
}

// Fix labels for ALL views (Day, Week, Month)
function fixBarLabels() {
  const gantt = window.ganttInstance;
  // If Month view, we let fixMonthViewBarPositions handle it to avoid conflicts
  if (gantt && gantt.options.view_mode === "Month") return;

  const barWrappers = document.querySelectorAll(".bar-wrapper");

  barWrappers.forEach((wrapper) => {
    const bar = wrapper.querySelector(".bar");
    const label = wrapper.querySelector(".bar-label");

    if (bar && label) {
      const x = parseFloat(bar.getAttribute("x")) || 0;
      const width = parseFloat(bar.getAttribute("width")) || 0;
      fixSingleLabel(label, x, width);
    }
  });
  console.log("[fixBarLabels] Updated label classes for current view");
}

// ==== Fix Arrows for ALL Views (Dependency Lines) ====
// Recalculates arrow paths using:
// 1. Corrected Month positions (if available)
// 2. DOM positions (for Day/Week views)
function fixDependencyArrows() {
  const gantt = window.ganttInstance;
  if (!gantt) return;

  // Position Helper
  const getTaskPosition = (taskId) => {
    // Priority 2: DOM Reading (Standard for All Views now)
    const bar = document.querySelector(
      `#gantt-chart .bar-wrapper[data-id="${taskId}"] .bar`,
    );
    if (bar) {
      // Use getBBox for safer dimension reading if available, fallback to attributes
      let x = parseFloat(bar.getAttribute("x"));
      let y = parseFloat(bar.getAttribute("y"));
      let width = parseFloat(bar.getAttribute("width"));
      let height = parseFloat(bar.getAttribute("height"));

      return {
        x: x || 0,
        y: y || 0,
        width: width || 0,
        height: height || 0, // Ensure we have a height
        endX: (x || 0) + (width || 0),
      };
    }
    return null;
  };

  // Selector robusto: incluye .arrow y path con atributo data-from
  const arrows = document.querySelectorAll(
    "#gantt-chart .arrow, #gantt-chart path[data-from]",
  );

  let fixedCount = 0;

  arrows.forEach((arrow) => {
    // Ensure it has the arrow class for styling
    arrow.classList.add("arrow");

    const fromId = arrow.getAttribute("data-from");
    const toId = arrow.getAttribute("data-to");

    if (!fromId || !toId) return;

    const fromPos = getTaskPosition(fromId);
    const toPos = getTaskPosition(toId);

    if (!fromPos || !toPos) {
      return;
    }

    // Detect Dependency Type
    // We need to look at the Target Task's _rawPredecessors to find the suffix for this fromId
    let depType = "FS"; // Default Finish-to-Start

    const targetTask = gantt.tasks.find((t) => String(t.id) === toId);
    if (targetTask && targetTask._rawPredecessors) {
      // Find the raw predecessor string that matches fromId
      const predString = targetTask._rawPredecessors.find((p) => {
        // p could be "10" or "10SS" or "10FF+3d"
        // Regex to match ID at start
        const match = p.match(/^(\d+)/);
        return match && match[1] === fromId;
      });

      if (predString) {
        if (predString.includes("SS")) depType = "SS";
        else if (predString.includes("FF")) depType = "FF";
        else if (predString.includes("SF")) depType = "SF";
        else if (predString.includes("FC"))
          depType = "FS"; // Spanish FC = FS
        else depType = "FS";
      }
    }

    // Determine Start and End coordinates based on Type
    let startX, startY, endX, endY;

    // Source Point
    if (depType === "SS" || depType === "SF") {
      // Start of Predecessor
      startX = fromPos.x;
      startY = fromPos.y + fromPos.height / 2;
    } else {
      // Finish of Predecessor (FS, FF)
      startX = fromPos.endX;
      startY = fromPos.y + fromPos.height / 2;
    }

    // Target Point
    if (depType === "FF" || depType === "SF") {
      // Finish of Successor
      endX = toPos.endX;
      endY = toPos.y + toPos.height / 2;
    } else {
      // Start of Successor (FS, SS)
      endX = toPos.x;
      endY = toPos.y + toPos.height / 2;
    }

    // Adjust margins
    if (depType === "FS" || depType === "FF") startX += 0; // Predecessor right side
    if (depType === "SS" || depType === "SF") startX -= 2; // Predecessor left side

    if (depType === "FS" || depType === "SS") endX -= 2; // Successor left side
    if (depType === "FF" || depType === "SF") endX += 2; // Successor right side

    // Path Logic with SMOOTH CURVES
    let newPath = "";
    const curveRadius = 8; // Radius for curve smoothness

    // Standard FS (Finish to Start)
    if (depType === "FS") {
      if (endX > startX + 20) {
        // Standard forward with smooth curve
        const midX = startX + 15;

        if (Math.abs(endY - startY) < curveRadius * 2) {
          // Nearly horizontal - simple path
          newPath = `M ${startX} ${startY} L ${endX} ${endY}`;
        } else {
          // Vertical distance is significant - use smooth corner
          const direction = endY > startY ? 1 : -1;
          newPath = `M ${startX} ${startY} 
                     H ${midX - curveRadius}
                     Q ${midX} ${startY} ${midX} ${startY + curveRadius * direction}
                     V ${endY - curveRadius * direction}
                     Q ${midX} ${endY} ${midX + curveRadius} ${endY}
                     L ${endX} ${endY}`;
        }
      } else {
        // Backwards or tight - multiple smooth curves
        const midY = startY + (endY - startY) / 2;
        const h1 = startX + 10;
        const h2 = endX - 10;
        const dir1 = midY > startY ? 1 : -1;
        const dir2 = endY > midY ? 1 : -1;

        newPath = `M ${startX} ${startY} 
                   H ${h1 - curveRadius} 
                   Q ${h1} ${startY} ${h1} ${startY + curveRadius * dir1}
                   V ${midY - curveRadius * dir1}
                   Q ${h1} ${midY} ${h1 + curveRadius} ${midY}
                   H ${h2 - curveRadius}
                   Q ${h2} ${midY} ${h2} ${midY + curveRadius * dir2}
                   V ${endY - curveRadius * dir2}
                   Q ${h2} ${endY} ${h2 + curveRadius} ${endY}
                   L ${endX} ${endY}`;
      }
    }
    // SS (Start to Start) - Circuit to Left with smooth curves
    else if (depType === "SS") {
      const backX = Math.min(startX, endX) - 15;
      const direction = endY > startY ? 1 : -1;

      newPath = `M ${startX} ${startY} 
                 H ${backX + curveRadius}
                 Q ${backX} ${startY} ${backX} ${startY + curveRadius * direction}
                 V ${endY - curveRadius * direction}
                 Q ${backX} ${endY} ${backX + curveRadius} ${endY}
                 L ${endX} ${endY}`;
    }
    // FF (Finish to Finish) - Circuit to Right with smooth curves
    else if (depType === "FF") {
      const fwdX = Math.max(startX, endX) + 15;
      const direction = endY > startY ? 1 : -1;

      newPath = `M ${startX} ${startY} 
                 H ${fwdX - curveRadius}
                 Q ${fwdX} ${startY} ${fwdX} ${startY + curveRadius * direction}
                 V ${endY - curveRadius * direction}
                 Q ${fwdX} ${endY} ${fwdX - curveRadius} ${endY}
                 L ${endX} ${endY}`;
    }
    // SF (Start to Finish) with smooth curves
    else if (depType === "SF") {
      const backX = startX - 15;
      const direction = endY > startY ? 1 : -1;

      newPath = `M ${startX} ${startY} 
                 H ${backX - curveRadius}
                 Q ${backX} ${startY} ${backX} ${startY + curveRadius * direction}
                 V ${endY - curveRadius * direction}
                 Q ${backX} ${endY} ${backX + curveRadius} ${endY}
                 L ${endX} ${endY}`;
    }

    arrow.setAttribute("d", newPath);
    // [Fix] Ensure the arrowhead marker is always applied
    if (!arrow.getAttribute("marker-end")) {
      arrow.setAttribute("marker-end", "url(#arrow)");
    }
    fixedCount++;
  });

  // [Fix] Maintain arrowheads even after refresh
  ensureArrowMarker();

  console.log(
    `[fixDependencyArrows] Adjusted ${fixedCount} dependency arrows (Types enabled).`,
  );
}

// Helper to ensure the SVG Arrow Marker exists (Robust check)
function ensureArrowMarker() {
  // Target generic SVG container or specific gantt class
  const svg =
    document.querySelector(".gantt-container svg") ||
    document.querySelector("svg");
  if (!svg) return;

  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.insertBefore(defs, svg.firstChild);
  }

  let marker = defs.querySelector("#arrow");
  if (!marker) {
    marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "arrow");
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "5");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("orient", "auto-start-reverse");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    path.setAttribute("fill", "#a3a3ff"); // Match arrow color
    marker.appendChild(path);
    defs.appendChild(marker);
  }
}

// Check where to scroll (Project Start)
function scrollToStart() {
  if (!window.ganttInstance || !window.ganttInstance.tasks) return;

  const gantt = window.ganttInstance;
  const svg = document.querySelector(".gantt-container svg");
  if (!svg) return;

  // Logic: Instead of scraping DOM for X (which might be virtualized or tricky),
  // Calculate X based on the Start Date of the first task.
  const firstTask = gantt.tasks[0];
  if (!firstTask) return;

  // Calculate Diff in Hours from Chart Start to First Task Start
  // Use helper for robust cross-browser parsing
  const firstTaskStart = parseSafeDate(firstTask._start);
  const ganttStart = parseSafeDate(gantt.gantt_start);

  const diff = firstTaskStart - ganttStart;
  const diffHours = diff / (1000 * 60 * 60);

  // Determine Width Per Day based on View Mode
  let x = 0;
  let bufferPixels = 0;
  const colWidth = gantt.options.column_width;

  if (gantt.options.view_mode === "Month") {
    // Use calendar-accurate calculation for Month view
    x = getXForDateInMonthView(firstTaskStart, ganttStart, colWidth || 120);
    // Buffer: about 1 week worth (approximately 1/4 of a column)
    bufferPixels = (colWidth || 120) / 4;
  } else {
    let widthPerDay = 38;
    if (gantt.options.view_mode === "Week") {
      widthPerDay = (colWidth || 140) / 7;
    } else {
      widthPerDay = colWidth || 38;
    }
    // Calculated X positions of the First Task
    x = (diffHours / 24) * widthPerDay;
    // Desired Buffer: 1 Week (7 days worth of pixels)
    bufferPixels = 7 * widthPerDay;
  }

  const container = document.querySelector(".gantt-container");

  // Scroll target = Task X - Buffer
  // This ensures the first task isn't hugging the left edge.
  const targetScroll = Math.max(0, x - bufferPixels);

  // Use scrollTo for smooth behavior
  container.scrollTo({
    left: targetScroll,
    behavior: "smooth",
  });

  console.log(
    `Scrolled to ${targetScroll} (FirstTaskX=${x} - Buffer=${bufferPixels})`,
  );
}
// ==== Align Labels Left ====
function alignTaskLabels() {
  const labels = document.querySelectorAll(".bar-label");
  labels.forEach((label) => {
    // We only want to align standard/summary bars, usually milestones are fine or handled separately
    // But user asked for "bars", implying rectangular ones.

    // Find parent group
    const group = label.closest(".bar-wrapper");
    if (!group) return;

    const bar = group.querySelector(".bar");
    if (!bar) return;

    // Get bar's X position
    const barX = parseFloat(bar.getAttribute("x"));
    const barWidth = parseFloat(bar.getAttribute("width"));

    if (isNaN(barX) || isNaN(barWidth)) return;

    // Check if label fits inside?
    // Frappe usually puts it inside if it fits, outside if not.
    // However, SVG text length calculation is expensive.
    // Simplest approach: Always try to put it at start + padding.

    const padding = 10;
    const newX = barX + padding;

    // Force Left Alignment
    label.setAttribute("x", newX);
    label.setAttribute("text-anchor", "start");

    // Optional: Check if text overflows bar width?
    // If so, maybe move it back outside?
    // User asked "Manteniendolas adentro, si caben".
    // Frappe's default logic already decides "big" vs "small" class.
    // If it has class "big", it means it's inside.

    if (label.classList.contains("big")) {
      label.setAttribute("x", newX);
      label.setAttribute("text-anchor", "start");
    }
  });
}

// ==== Pre-Start Zone (Gray Out) ====
function renderPreStartZone() {
  if (
    !window.ganttInstance ||
    !currentProjectData ||
    !currentProjectData.project.startDate
  )
    return;

  const gantt = window.ganttInstance;

  // Parse project start (Robust Cross-Browser)
  const projectStart = parseSafeDate(currentProjectData.project.startDate);

  // Fallback if still invalid
  if (isNaN(projectStart.getTime())) {
    console.warn(
      "Invalid Project Start detected:",
      currentProjectData.project.startDate,
    );
    return;
  }

  const svg = document.querySelector("#gantt-chart svg");

  if (!svg || !gantt.gantt_start) return;

  // Remove ALL existing pre-start zones from the CONTAINER (not SVG!)
  // This prevents stacking of multiple overlays on view switches
  const container = document.querySelector(".gantt-container");
  if (container) {
    container.querySelectorAll(".pre-start-zone").forEach((el) => el.remove());
  }

  // SAFEGUARDS
  if (!gantt.gantt_start || isNaN(new Date(gantt.gantt_start).getTime())) {
    // Silent return or retry
    return;
  }

  // Check if project start is AFTER gantt start
  if (projectStart <= gantt.gantt_start) return; // No gray zone needed

  // Calculate X
  const diff = projectStart - gantt.gantt_start;
  const diffHours = diff / (1000 * 60 * 60);

  let x = 0;
  const colWidth = gantt.options.column_width;

  if (gantt.options.view_mode === "Month") {
    // Use calendar-accurate calculation for Month view
    x = getXForDateInMonthView(
      projectStart,
      gantt.gantt_start,
      colWidth || 120,
    );
  } else {
    let widthPerDay = 38;
    if (gantt.options.view_mode === "Day") {
      widthPerDay = colWidth || 38;
    } else if (gantt.options.view_mode === "Week") {
      widthPerDay = (colWidth || 140) / 7;
    }
    // Days from start * width per day
    x = (diffHours / 24) * widthPerDay;
  }

  // container already declared at line 1826 (for overlay removal), reuse it
  if (!container) return;

  // Force relative positioning
  container.style.position = "relative";

  // Get full chart height from SVG to ensure overlay covers all rows
  const fullHeight = svg.getAttribute("height") || container.scrollHeight;

  const overlay = document.createElement("div");
  overlay.classList.add("pre-start-zone");
  overlay.style.position = "absolute";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.height = `${fullHeight}px`; // Match full content height
  overlay.style.width = `${Math.max(0, x)}px`;

  // Robust Visuals
  overlay.style.backgroundColor = "rgba(100, 100, 100, 0.1)";
  overlay.style.backgroundImage = `repeating-linear-gradient(
    45deg,
    rgba(0,0,0,0.1),
    rgba(0,0,0,0.1) 10px,
    transparent 10px,
    transparent 20px
  )`;

  overlay.style.zIndex = "50";
  overlay.style.pointerEvents = "none";
  overlay.style.borderRight = "2px dashed #666";

  container.appendChild(overlay);

  // Safe logging
  try {
    console.log(`Pre-Start Zone Rendered: X=${x}px from Diff=${diffHours}h`);
  } catch (e) {}
}

// ==== Custom Tooltip Logic (Bypassing Library) ====
// We manually attach hover events to the SVGs because the library ignores custom template
function bindTooltipHover() {
  const bars = document.querySelectorAll(
    "#gantt-chart .bar-wrapper, #gantt-chart .bar-group",
  );

  bars.forEach((bar) => {
    // Clean previous listeners if any
    bar.onmouseenter = (e) => {
      const taskId = bar.getAttribute("data-id");
      if (taskId) showCustomPopup(taskId, e);
    };

    bar.onmouseleave = () => {
      hideCustomPopup();
    };

    bar.onmousemove = (e) => {
      updatePopupPosition(e);
    };
  });
}

let customPopupEl = null;

function showCustomPopup(taskId, event) {
  // 1. Get Data
  const task = window.ganttTaskCache[taskId];
  if (!task) return;

  // 2. Build HTML (Reusing the logic we wrote before)
  const durationText = task._duration_text || "-";
  const isCritical = task._is_critical || false;
  const predecessorsList = task._predecessors_list || "";

  // Theoretical Logic
  const dateInput = document.getElementById("cutoff-date");
  let theoretical = 0;
  let diffText = "";
  let theoreticalHtml = "";

  if (dateInput && dateInput.value) {
    const cutoff = new Date(dateInput.value);
    const start = new Date(task.start);
    const end = new Date(task.end);

    if (cutoff < start) {
      theoretical = 0;
    } else if (cutoff >= end) {
      theoretical = 100;
    } else {
      const totalDuration = end - start;
      const elapsed = cutoff - start;
      if (totalDuration > 0) {
        theoretical = Math.round((elapsed / totalDuration) * 100);
      }
    }

    // Calculate Difference
    const actual = parseFloat(task.progress);
    const diff = actual - theoretical;
    const diffColor =
      diff >= 0 ? "var(--aia-corp-main)" : "var(--aia-alert-main)";
    diffText =
      '<span>Dedv: <strong style="color: ' +
      diffColor +
      '">' +
      (diff > 0 ? "+" : "") +
      diff +
      "%</strong></span>";

    if (theoretical > 0) {
      theoreticalHtml =
        '<div class="popup-row theoretical"><small>Teórico: ' +
        theoretical +
        "%</small></div>";
    }
  }

  const html = `
    <div class="popup-header">
        <h4>${task.name}</h4>
        ${isCritical ? '<span class="badge-critical">🔴 Crítica</span>' : ""}
    </div>
    <div class="popup-body">
        <div class="popup-row">
            <span>📅 ${formatDate(task.start)} - ${formatDate(task.end)}</span>
            <span class="popup-duration">(${durationText})</span>
        </div>
        ${predecessorsList ? `<div class="popup-row dependencies">🔗 Pre: ${predecessorsList}</div>` : ""}
        
        <div class="popup-progress-section">
            <div class="popup-row" style="justify-content: space-between; margin-bottom: 2px;">
                <span>Progreso: <strong>${task.progress}%</strong></span>
                ${diffText}
            </div>
            <div class="popup-progress-bar">
                <div class="popup-progress-fill" style="width: ${task.progress}%"></div>
            </div>
            ${theoreticalHtml}
        </div>
    </div>
  `;

  // 3. Create or Update Element
  if (!customPopupEl) {
    customPopupEl = document.createElement("div");
    customPopupEl.className = "gantt-popup";
    document.body.appendChild(customPopupEl);
  }

  customPopupEl.innerHTML = html;
  customPopupEl.style.display = "block";

  // 4. Position
  updatePopupPosition(event);
}

function hideCustomPopup() {
  if (customPopupEl) {
    customPopupEl.style.display = "none";
  }
}

function updatePopupPosition(e) {
  if (!customPopupEl) return;

  const width = 260; // From CSS
  const offset = 15;

  let left = e.pageX + offset;
  let top = e.pageY + offset;

  // Boundary check
  if (left + width > window.innerWidth) {
    left = e.pageX - width - offset;
  }

  // Bottom check (simple)
  if (top + 150 > window.innerHeight + window.scrollY) {
    top = e.pageY - 150;
  }

  customPopupEl.style.left = left + "px";
  customPopupEl.style.top = top + "px";
}
