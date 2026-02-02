<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visor MPP</title>
    <link rel="icon" type="image/png" href="favicon.png">
    <link rel="stylesheet" href="css/style.css?v=<?php echo time(); ?>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap" rel="stylesheet">
    <!-- DHTMLX Gantt (Standard/GPL) -->
    <link rel="stylesheet" href="https://cdn.dhtmlx.com/gantt/edge/dhtmlxgantt.css">
    <style>
        /* DHTMLX Custom Overrides */
        .gantt_task_line.critical-task {
            background-color: #ef4444;
            border-color: #b91c1c;
        }

        .gantt_task_line.critical-task .gantt_task_progress {
            background-color: #991b1b;
        }
    </style>
</head>

<body>
    <div class="app-layout">
        <!-- Sidebar -->
        <aside id="app-sidebar" class="sidebar">
            <div class="sidebar-header">
                <h2>Proyectos</h2>
                <!-- Desktop Toggle (Inside Sidebar) -->
                <button id="toggle-sidebar-desktop" class="icon-btn sidebar-toggle-btn" aria-label="Alternar menú">☰</button>
                <!-- Mobile Close -->
                <button id="close-sidebar" class="icon-btn closed-sidebar-btn" aria-label="Cerrar menú">✕</button>
            </div>
            <!-- Container for saved projects list -->
            <section id="saved-projects" class="saved-projects-list">
                <!-- Populated by JS -->
            </section>
        </aside>

        <!-- Main Content -->
        <div class="main-content">
            <!-- Top Bar with Logo -->
            <header class="main-top-bar">
                <button id="toggle-sidebar-mobile" class="icon-btn mobile-hamburger-btn" aria-label="Abrir menú" style="color: var(--color-text-main); font-size: 1.5rem;">☰</button>
                <div id="top-bar-actions" class="top-bar-actions">
                    <!-- Dynamic Actions Injected Here -->
                    <button class="toggle-btn" onclick="openHolidaysModal()" title="Gestionar Días No Laborables" style="margin-right: 10px;">📅 Calendario</button>
                </div>
                <a href="https://www.aia.com.co" target="_blank" rel="noopener noreferrer" class="brand-logo" title="AIA - Construimos por Naturaleza">
                    <img src="logo.png" alt="AIA">
                </a>
            </header>

            <div id="sidebar-overlay" class="sidebar-overlay"></div>

            <main class="container-fluid">
                <section class="upload-section">
                    <div id="drop-zone" class="drop-zone">
                        <div class="icon-container">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                            </svg>
                        </div>
                        <h3>Arrastra tu archivo XML aquí</h3>
                        <p>O haz clic para seleccionar</p>
                        <input type="file" id="file-input" accept=".xml" hidden>
                    </div>
                </section>

                <section id="results-section" class="results-section hidden">
                    <!-- Gantt/Table Rendered Here -->
                </section>
            </main>

            <footer class="app-footer">
                <div class="container">
                    <p>&copy; 2026 Visor MPP - Mobile First</p>
                    <div id="api-status" class="status-indicator">Verificando API...</div>
                </div>
            </footer>
        </div>
    </div>

    <!-- Custom Modal -->
    <div id="custom-modal" class="modal-overlay hidden">
        <div class="modal-content">
            <h3 id="modal-title">Título Modal</h3>
            <p id="modal-message">Mensaje del modal...</p>
            <div id="modal-actions" class="modal-actions">
                <!-- Buttons will be injected here -->
            </div>
        </div>
    </div>

    <!-- DHTMLX Gantt JS -->
    <script src="https://cdn.dhtmlx.com/gantt/edge/dhtmlxgantt.js"></script>
    <!-- SheetJS (Excel) -->
    <script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>
    <!-- SortableJS (Drag & Drop) -->
    <script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>

    <script src="js/app.js?v=<?php echo time(); ?>"></script>
    <script src="js/holidays.js?v=<?php echo time(); ?>"></script>
</body>

</html>