// holidays.js - Logic for managing non-working days

const HOLIDAYS_API = "holidays_api.php";

async function openHolidaysModal() {
  const modal = document.getElementById("custom-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalMessage = document.getElementById("modal-message");
  const modalActions = document.getElementById("modal-actions");

  modalTitle.textContent = "📅 Calendario de Días No Laborables";

  // Show Loading
  modalMessage.innerHTML =
    '<div class="loader"></div><p>Cargando festivos...</p>';
  modalActions.innerHTML =
    '<button class="modal-btn" onclick="closeModal()">Cerrar</button>';
  modal.classList.remove("hidden");

  try {
    const response = await fetch(HOLIDAYS_API);
    const result = await response.json();

    if (result.status === "success") {
      renderHolidaysList(result.data);
    } else {
      modalMessage.innerHTML = `<p class="error-msg">Error: ${result.message}</p>`;
    }
  } catch (e) {
    console.error(e);
    modalMessage.innerHTML = `<p class="error-msg">Error de conexión</p>`;
  }
}

function renderHolidaysList(holidays) {
  const modalMessage = document.getElementById("modal-message");

  let html = `
    <div class="holidays-manager">
        <div class="add-holiday-form">
            <input type="date" id="new-holiday-date" class="date-input">
            <input type="text" id="new-holiday-desc" placeholder="Descripción (opcional)" class="text-input">
            <button class="action-btn success" onclick="addHoliday()">➕ Agregar</button>
        </div>
        <div class="holidays-list-container">
            <table class="holidays-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Descripción</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
  `;

  if (holidays.length === 0) {
    html += `<tr><td colspan="3">No hay festivos registrados yet.</td></tr>`;
  } else {
    holidays.forEach((h) => {
      html += `
            <tr>
                <td>${h.date}</td>
                <td>${h.description}</td>
                <td>
                    <button class="delete-btn small" onclick="deleteHoliday('${h.date}')">🗑</button>
                </td>
            </tr>
          `;
    });
  }

  html += `
                </tbody>
            </table>
        </div>
        <p class="hint-text">* Los cambios afectarán los cálculos de fechas futuros o al recargar proyectos.</p>
    </div>
  `;

  modalMessage.innerHTML = html;
}

async function addHoliday() {
  const dateInput = document.getElementById("new-holiday-date");
  const descInput = document.getElementById("new-holiday-desc");

  const date = dateInput.value;
  const desc = descInput.value;

  if (!date) {
    alert("Selecciona una fecha");
    return;
  }

  try {
    const response = await fetch(HOLIDAYS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, description: desc }),
    });
    const result = await response.json();

    if (result.status === "success") {
      // Reload list
      openHolidaysModal();
    } else {
      alert("Error al guardar: " + result.message);
    }
  } catch (e) {
    alert("Error de red");
  }
}

async function deleteHoliday(date) {
  if (!confirm(`¿Eliminar festivo ${date}?`)) return;

  try {
    // Use JSON body for DELETE
    const response = await fetch(HOLIDAYS_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    const result = await response.json();

    if (result.status === "success") {
      openHolidaysModal(); // Reload
    } else {
      alert("Error al eliminar: " + result.message);
    }
  } catch (e) {
    alert("Error de red");
  }
}
