---
tipo: decision
estado: vigente
fecha: 2026-08-04
areas: [qa]
fuente: goals/correcciones-gantt-matriz-evidencia/goal.md
resumen: "playwright.config.ts fija workers: 1, solo Chromium, y traza/video/captura siempre activos"
---
`playwright.config.ts` fija `workers: 1` de forma permanente (no solo en CI), deja únicamente el
proyecto Chromium y activa traza, vídeo y captura de pantalla siempre, no solo en fallo. Antes
declaraba proyectos firefox/webkit pese a que el fact fija Chromium como navegador único, y no
forzaba `workers: 1` fuera de CI.

**Why:** los facts 106 y 112 piden una corrida de cierre reproducible y un solo navegador; correr
en paralelo o en varios motores hace que un fallo intermitente de UI (carreras de hidratación,
timing de navegación) sea indistinguible de un bug real.

**How to apply:** si necesitas acelerar una corrida local exploratoria, no cambies el config
compartido — pasa flags puntuales por línea de comandos y déjalo como estaba antes de cerrar.
