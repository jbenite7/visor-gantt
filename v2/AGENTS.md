# Frontend v2 — override técnico

## Stack y límites

- Esta carpeta contiene la aplicación viva: Next.js 16 App Router, React 19, TypeScript estricto, Tailwind CSS 4 y PostgreSQL mediante `pg`.
- Hereda los contratos del `AGENTS.md` raíz. Este archivo precisa arquitectura y verificación; no redefine goals ni relaja invariantes de importación, scheduling, Matriz–Gantt o persistencia.
- El flujo integrado corre con Docker Compose desde la raíz. Para pruebas aisladas en `v2/`, declara qué dependencias externas fueron simuladas y no presentes un resultado host-only como prueba del runtime servido.

## Arquitectura y datos

- `src/app/` contiene rutas, layouts, Server Actions y Route Handlers; `src/components/` contiene UI; `src/lib/` concentra dominio, integración, estado y acceso a datos.
- Usa Server Components por defecto. Añade `"use client"` solo donde sean necesarios estado, efectos, eventos o APIs del navegador; mantén objetos no serializables y secretos fuera del boundary cliente.
- Ejecuta consultas PostgreSQL únicamente en código server-side mediante los helpers de `src/lib/db.ts` o una capa server-only equivalente. No introduzcas otro cliente de datos ni acceso directo a DB desde componentes cliente.
- Usa Server Actions para mutaciones acotadas desde la UI. Usa Route Handlers para multipart, archivos grandes, endpoints HTTP o integraciones; extrae lógica compartida a helpers server-only en vez de importar una acción `"use server"` como capa de dominio.
- `projects.project_data` es `JSONB` y representa el agregado persistido. Conserva compatibilidad al leer proyectos existentes; valida defaults y campos opcionales antes de asumir una forma nueva.
- `scripts/init-schema.sql` es el bootstrap de una base limpia, montado por Compose. Un cambio para bases existentes requiere migración separada, prueba de upgrade y rollback/restore.

## Convenciones de implementación

- Mantén `strict: true`. Evita `any`; cuando el dato externo sea incierto usa `unknown`, validación y narrowing. No fuerces tipos para ocultar deriva de schema.
- Usa el alias `@/*` para imports entre dominios o rutas profundas. Dentro del mismo módulo, imports relativos cortos como `./scheduleEngine` son válidos y preferibles cuando aclaran cohesión.
- Mantén funciones de dominio puras y testeables para importación, scheduling, Matriz y transformaciones. La UI orquesta esas funciones; no dupliques reglas de cálculo en componentes.
- Centraliza tokens y estilos compartidos en `src/app/globals.css`; conserva accesibilidad, modo claro/oscuro, layout responsive y ausencia de overflow. No hardcodees variantes que ya tengan token o contrato canónico.
- Errores de importación, permisos, parser o persistencia deben ser recuperables y comprensibles; no crees proyectos parciales ni ocultes fallos server-side con fallbacks silenciosos.

## Verificación enfocada

- Desde `v2/`, ejecuta Jest sobre los archivos afectados con `npm test -- --runInBand <rutas>`; luego `npm run lint` y `npm run build` cuando el riesgo lo justifique.
- Importación/API: prueba `src/app/api/import-mpp/route.test.ts`, `src/lib/import/mpp-project.test.ts` y el cliente del parser cuando cambien sus contratos.
- Scheduling e identidad: prueba `src/lib/scheduling/`, `src/lib/gantt/dependencyEditing.test.ts`, `src/lib/gantt/taskIds.ts` y consumidores visibles de Row ID/Unique ID.
- Matriz: prueba `matrixFromGantt`, `matrixGenerator` y `matrixSync` en conjunto si cambia cualquiera de las direcciones.
- Estado/persistencia: prueba `ProjectContext`, acciones de proyecto y la vista afectada; completa con guardar → recargar → reabrir sobre PostgreSQL real.
- UI: añade tests de componente y Playwright para interacciones, persistencia o regresiones visuales. Verifica consola, red, hidratación, viewport relevante y que el contenedor frontend corresponde al código actual.
- Benchmarks: no mezcles resultados sintéticos y reales ni cambies fixture, warm-up, repeticiones o umbral sin documentarlo.
