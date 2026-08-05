---
tipo: trampa
estado: vigente
fecha: 2026-08-04
areas: [qa]
fuente: goals/AUDITORIA-FACT-BY-FACT-2026-08-04.md
resumen: "9 de 12 specs E2E ejecutaban DELETE FROM projects pese a que los facts exigian conservarlos"
---
Los facts 8 y 111 dicen explícitamente que la suite E2E conserva los proyectos creados/importados
para revisión posterior y que no se borrarán al finalizar. La verificación directa del código
encontró que 9 de 12 specs (`dependency-visual-persistence`, `final-visual-audit`,
`hierarchy-visual-persistence`, `matrix-deep-project-evidence`, `matrix-new-project`,
`mpp-import-matrix-runtime`, `planning-assistant-runtime`, `ui-settings-persistence`,
`what-if-persistence`) ejecutaban `DELETE FROM projects WHERE name LIKE ...` en su limpieza —
una contradicción directa entre lo prometido en el contrato y lo que hacía el código.

**Why:** los facts de un goal describen comportamiento que se supone verificado, pero un fact
puede quedar contradicho por código escrito después sin que nadie vuelva a leerlo — el autoreporte
de cierre del goal no lo detectó porque nadie corrió `SELECT count(*) FROM projects` antes/después
de la suite.

**How to apply:** ante cualquier fact sobre "se conserva X" o "no se borra X", verifica con una
consulta directa a la base antes y después de la operación, no confíes en que el código hace lo
que el nombre del test sugiere. Ver [[conservacion-de-proyectos-e2e-por-runid]] para la corrección.
