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
    dropZone.classList.remove("dragover")
  );
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

  // ==== Sidebar Logic ====
  const sidebar = document.getElementById("app-sidebar");
  const toggleBtnDesktop = document.getElementById("toggle-sidebar-desktop");
  const toggleBtnMobile = document.getElementById("toggle-sidebar-mobile");
  const closeBtn = document.getElementById("close-sidebar");

  if (toggleBtnDesktop) {
    toggleBtnDesktop.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
  }

  if (toggleBtnMobile) {
    toggleBtnMobile.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      sidebar.classList.remove("open");
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
                  `
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
    defaultName
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
  forceNew = false
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
                          `<option value="${c.id}">${c.name} (${c.similarity}%)</option>`
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
      `¿Estás seguro de que deseas eliminar TODO el grupo de ${count} proyectos/versiones?`
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
    ...data.tasks.map((t) => t.outlineLevel || t.OutlineLevel || 1)
  );

  resultsSection.innerHTML = `
    <div class="results-header">
      <div class="header-left">
        <button class="btn-back" onclick="location.reload()">← Subir otro</button>
      </div>
      <div class="view-toggle">
        <button id="btn-table" class="toggle-btn active" onclick="showView('table')">Tabla</button>
        <button id="btn-gantt" class="toggle-btn" onclick="showView('gantt')">Gantt</button>
        <button id="btn-columns" class="toggle-btn" onclick="toggleColumnSelector()">⚙ Columnas</button>
        <button class="toggle-btn btn-export" onclick="exportToExcel()" title="Descargar como Excel">📥 Descargar</button>
      </div>
    </div>
    <div class="project-header">
      <h2>${data.project.name || "Proyecto"}</h2>
      <div class="project-meta">
        <span>Inicio: ${formatDate(data.project.startDate)}</span>
        <span>Fin: ${formatDate(data.project.finishDate)}</span>
        <span>Tareas: ${data.tasks.length}</span>
      </div>
    </div>
    
    <div id="column-selector" class="column-selector hidden"></div>
    
    <div id="level-selector" class="level-selector">
      <span class="level-label">Mostrar nivel:</span>
      ${Array.from({ length: maxLevel }, (_, i) => i + 1)
        .map(
          (level) =>
            `<button class="level-btn" onclick="expandToLevel(${level})">${level}</button>`
        )
        .join("")}
      <button class="level-btn level-btn-all" onclick="expandAll()">Todo</button>
    </div>
    
    <div id="table-view" class="view-container"></div>
    <div id="gantt-view" class="view-container hidden">
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
      `
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

  // Prepare data
  const dataToExport = currentProjectData.tasks.map((task) => {
    const row = {};
    orderedVisible.forEach((col) => {
      let val = task[col];
      // Format dates strictly to dd/mm/yyyy HH:mm
      if (col === "start" || col === "finish") {
        if (val) {
          const d = new Date(val);
          const day = String(d.getDate()).padStart(2, "0");
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const year = d.getFullYear();
          val = `${day}/${month}/${year}`;
        } else {
          val = "-";
        }
      } else if (col === "Summary" || col === "Critical") {
        // Format Booleans
        val = val == 1 || val === "true" || val === true ? "Sí" : "No";
      }
      row[translateColumn(col)] = val;
    });
    return row;
  });

  // Create workbook
  const worksheet = XLSX.utils.json_to_sheet(dataToExport);

  // Force WBS/EDT column to Text format
  const range = XLSX.utils.decode_range(worksheet["!ref"]);
  const encodedEDT = translateColumn("WBS");

  // Find column index for EDT
  let edtColIndex = -1;
  // Check headers (first row)
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: C })];
    if (cell && cell.v === encodedEDT) {
      edtColIndex = C;
      break;
    }
  }

  if (edtColIndex !== -1) {
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
    '#column-selector input[type="checkbox"]:checked'
  );
  const selected = Array.from(checkboxes).map((cb) => cb.value);
  saveVisibleColumns(selected);
  renderTable();
}

function selectAllColumns() {
  const checkboxes = document.querySelectorAll(
    '#column-selector input[type="checkbox"]'
  );
  checkboxes.forEach((cb) => (cb.checked = true));
  onColumnToggle();
}

function selectDefaultColumns() {
  const checkboxes = document.querySelectorAll(
    '#column-selector input[type="checkbox"]'
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
                    `<td>${formatCellValue(task[col], col, task, tasks)}</td>`
                )
                .join("")}
            </tr>
          `
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
      return `<span style="padding-left: ${indent}px">
        <button class="collapse-btn" onclick="toggleCollapse(${task.id})">${icon}</button>
        ${prefix}${value}
      </span>`;
    }

    return `<span style="padding-left: ${
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
    return Array.isArray(value) ? value.join(", ") : "-";
  }
  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }
  return value;
}

// ==== View Switching ====
function showView(view) {
  const tableView = document.getElementById("table-view");
  const ganttView = document.getElementById("gantt-view");
  const btnTable = document.getElementById("btn-table");
  const btnGantt = document.getElementById("btn-gantt");

  if (view === "table") {
    tableView.classList.remove("hidden");
    ganttView.classList.add("hidden");
    btnTable.classList.add("active");
    btnGantt.classList.remove("active");
  } else {
    tableView.classList.add("hidden");
    ganttView.classList.remove("hidden");
    btnTable.classList.remove("active");
    btnGantt.classList.add("active");
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

  // Transform to Frappe Gantt format WITH dependencies
  const ganttTasks = validTasks.map((task) => ({
    id: String(task.id || task.UID),
    name: task.name || task.Name,
    start: (task.start || task.Start).split("T")[0],
    end: (task.finish || task.Finish).split("T")[0],
    progress: task.percentComplete || task.PercentComplete || 0,
    dependencies: (task.predecessors || []).join(", "), // Frappe Gantt expects comma-separated IDs
    custom_class: task.isSummary
      ? "bar-summary"
      : task.isMilestone
      ? "bar-milestone"
      : "",
  }));

  try {
    new Gantt("#gantt-chart", ganttTasks, {
      view_mode: "Week",
      date_format: "YYYY-MM-DD",
      language: "es",
      custom_popup_html: function (task) {
        return `
          <div class="gantt-popup">
            <h4>${task.name}</h4>
            <p>Inicio: ${formatDate(task.start)}</p>
            <p>Fin: ${formatDate(task.end)}</p>
            <p>Progreso: ${task.progress}%</p>
            ${task.dependencies ? `<p>Pred: ${task.dependencies}</p>` : ""}
          </div>
        `;
      },
    });

    applyScrollLock();
  } catch (e) {
    console.error("Error rendering Gantt:", e);
    ganttContainer.innerHTML =
      '<p class="error">Error al renderizar Gantt: ' + e.message + "</p>";
  }
}

// ==== Scroll Lock (prevents diagonal drift) ====
function applyScrollLock() {
  const container = document.querySelector(".gantt-container");
  if (!container) return;

  let scrollLockAxis = null;
  let scrollLockTimeout = null;

  container.addEventListener(
    "wheel",
    function (e) {
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
    { passive: false }
  );
}

// ==== Utilities ====
function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const opts = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    // Use browser's locale (navigator.language) to detect user's region/preference
    return new Date(dateStr).toLocaleString(navigator.language, opts);
  } catch {
    return dateStr;
  }
}

function formatDuration(durStr) {
  if (!durStr) return "-";
  // PT8H0M0S -> 8h, PT160H0M0S -> 20d
  const match = durStr.match(/PT(\d+)H/);
  if (match) {
    const hours = parseInt(match[1]);
    if (hours >= 8) {
      const days = Math.round(hours / 8);
      return days + "d";
    }
    return hours + "h";
  }
  return durStr.replace("PT", "").toLowerCase();
}
