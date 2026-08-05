---
tipo: mapa
estado: vigente
fecha: 2026-08-05
areas: [proceso]
fuente: goals/
resumen: "Qué goal está abierto, cerrado o absorbido, y qué dejó cada uno"
---
# Estado de los goals

Ocho carpetas en `goals/`, más la auditoría suelta
[[goals/AUDITORIA-FACT-BY-FACT-2026-08-04|fact-by-fact del 2026-08-04]], que auditó los siete goals
anteriores contra el código real y disparó el octavo goal (`cierre-auditoria-goals`) para resolver lo encontrado.

| Goal | Estado | Qué dejó |
|---|---|---|
| [[goals/cierre-auditoria-goals/goal|cierre-auditoria-goals]] | cerrado | Ejecutó la corrección de la auditoría: clasificación de familias (`activityFamily.ts`), conservación de proyectos E2E, arrastre de jerarquía persistente, errores de importación visibles en la app; acta en `cierre.md` con 79 suites / 586 tests y 50 E2E en verde |
| [[goals/optimize-gantt-recalculation/goal|optimize-gantt-recalculation]] | cerrado | Índices locales en `projectCalendar.ts` para ambos motores de cálculo; benchmark sintético p95 ~13,9 ms, muy debajo del umbral de 250 ms; sin evidencia con `.mpp` real ni test de autosave/deshacer |
| [[goals/predecessors-use-row-id/goal|predecessors-use-row-id]] | cerrado | Las columnas Predecesora/Sucesora usan el ID de fila (no el UID) tanto al mostrar como al editar, con traducción cubierta por tests y verificado en Docker/E2E |
| [[goals/correcciones-gantt-matriz-evidencia/goal|correcciones-gantt-matriz-evidencia]] | abierto | La auditoría encontró 7 facts que no cumplen y 9 parciales; `cierre-auditoria-goals` resolvió la clasificación de familias y la conservación de proyectos E2E, pero el goal como tal sigue sin acta de cierre |
| [[goals/paridad-visor-10/goal|paridad-visor-10]] | cerrado | Declarado `completed`; la auditoría marcó el criterio 6 (banner) como incompleto, pero `cierre-auditoria-goals` corrigió el hallazgo como falso positivo — el elemento ya existía como `gantt-project-meta-strip` |
| [[goals/production-e2e-gantt-benchmarks/goal|production-e2e-gantt-benchmarks]] | abierto | Mecanismo de benchmark de producción correcto, pero su ejecución depende de `PRODUCTION_SSH_HOST` y no es re-verificable desde este entorno; sin acta de cierre |
| [[goals/server-side-mpp-import/goal|server-side-mpp-import]] | abierto | La auditoría encontró un bug de manejo de errores; corregido en `fix(import): permitir reintentar con el mismo archivo tras un error`, pero el goal sigue sin acta de cierre propia |
| [[goals/top5-ui-ux-business-improvements-gantt/goal|top5-ui-ux-business-improvements-gantt]] | abierto | Editor Gantt diferencial con dos rondas de facts/plan e interviews; la auditoría marcó 6 parciales de 33 conductuales; sin acta de cierre |
