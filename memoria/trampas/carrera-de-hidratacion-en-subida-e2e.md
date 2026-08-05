---
tipo: trampa
estado: vigente
fecha: 2026-08-04
areas: [qa]
fuente: goals/cierre-auditoria-goals/cierre.md
resumen: "Un test E2E subia el archivo antes de que React estuviera escuchando el input"
---
Durante la reparación de specs desactualizados en la sesión del 2026-08-04 se encontró un test
que interactuaba con el input de subida de archivo antes de que React hubiera terminado de
hidratar y adjuntar sus listeners, produciendo fallos intermitentes. Se corrigió esperando a que
el navegador emita el evento `filechooser` y envolviendo la subida en `waitForRequest`.

**Why:** Playwright puede interactuar con un elemento del DOM en cuanto existe en el HTML del
servidor, pero un componente `"use client"` de React todavía no escucha eventos hasta que la
hidratación termina — el fallo es intermitente porque depende de qué tan rápido hidrata la
máquina que corre el test.

**How to apply:** en cualquier interacción E2E sobre un control que dependa de un componente
cliente recién montado (subida de archivo, primer clic tras navegar), espera una señal explícita
de que el listener ya está activo (`filechooser`, una petición de red esperada) en vez de asumir
que el DOM presente ya es interactivo.
