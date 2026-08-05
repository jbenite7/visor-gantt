---
tipo: trampa
estado: vigente
fecha: 2026-08-04
areas: [gantt, ui]
fuente: goals/paridad-visor-10/goal.md
resumen: "La auditoria busco la palabra 'banner' en el codigo en vez de la funcionalidad y genero un falso positivo"
---
La auditoría del 2026-08-04 reportó el fact 34 de `paridad-visor-10` ("banner informativo sutil
entre toolbar y SplitPane") como incumplido porque la palabra "banner" no aparecía en el código.
El elemento existía desde antes con otro nombre: `gantt-project-meta-strip`
(`v2/src/components/views/GanttView.tsx:1155`), exactamente entre la barra de herramientas y el
contenido, mostrando nombre del proyecto, inicio, fin, duración, avance, número de tareas y de
dependencias. Se llegó a implementar un componente `ProjectSummaryBanner` nuevo y se revirtió al
detectar que duplicaba esa franja.

**Why:** verificar contra código real evita autoreporte falso, pero buscar por nombre de variable
en vez de por comportamiento observable produce el error inverso: un falso negativo que casi
provoca trabajo duplicado.

**How to apply:** al auditar un fact de UI, primero míralo renderizado o describe el
comportamiento esperado y búscalo por efecto (posición, contenido mostrado), no solo por el
nombre textual que usa el fact. `grep` de una palabra es un indicio, no una prueba.
